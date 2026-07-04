#!/usr/bin/env python3
import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

LIST_COLUMNS = {"categories", "tags", "atleti"}
INT_COLUMNS = {"view_count", "like_count", "duration"}


def load_dotenv_file(path):
    if not path or not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue

            if "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()

            if not key:
                continue

            if len(value) >= 2 and ((value[0] == '"' and value[-1] == '"') or (value[0] == "'" and value[-1] == "'")):
                value = value[1:-1]

            # Keep explicit environment variables as priority over .env values.
            if key not in os.environ:
                os.environ[key] = value


def to_nullable_string(value):
    if value is None:
        return None
    text = str(value).strip()
    return text if text != "" else None


def to_nullable_int(value):
    text = to_nullable_string(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def to_list(value):
    text = to_nullable_string(value)
    if text is None:
        return []
    return [part.strip() for part in text.split(" | ") if part.strip()]


def normalize_row(raw_row):
    row = {}
    for key, value in raw_row.items():
        if key in LIST_COLUMNS:
            row[key] = to_list(value)
        elif key in INT_COLUMNS:
            row[key] = to_nullable_int(value)
        elif key == "upload_date":
            # Keep date as compact string yyyymmdd for compatibility with existing data.
            row[key] = to_nullable_string(value)
        else:
            row[key] = to_nullable_string(value)

    if not row.get("id"):
        return None

    return row


def read_csv_rows(csv_path):
    rows = []
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for raw in reader:
            row = normalize_row(raw)
            if row is not None:
                rows.append(row)
    return rows


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def post_batch(base_url, table_name, api_key, rows, conflict_column, conflict_action):
    params = urllib.parse.urlencode({"on_conflict": conflict_column})
    url = f"{base_url}/rest/v1/{table_name}?{params}"

    prefer_resolution = "ignore-duplicates" if conflict_action == "ignore" else "merge-duplicates"

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Prefer": f"resolution={prefer_resolution},return=minimal",
    }

    payload = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(request) as response:
            return response.status, ""
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body
    except urllib.error.URLError as e:
        reason = getattr(e, "reason", e)
        return None, f"NETWORK_ERROR: {reason}"


def main():
    parser = argparse.ArgumentParser(
        description=(
            "UPSERT CSV data to Supabase in batches. "
            "Default behavior ignores duplicate ids (inserts only new rows)."
        )
    )
    parser.add_argument("--csv", default="output.csv", help="Path to CSV file (default: output.csv)")
    parser.add_argument("--table", default="ping-video", help="Supabase REST table name (default: ping-video)")
    parser.add_argument("--batch-size", type=int, default=200, help="Batch size for uploads (default: 200)")
    parser.add_argument("--conflict-column", default="id", help="Conflict column for UPSERT (default: id)")
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Path to .env file to load before reading environment variables (default: .env)",
    )
    parser.add_argument(
        "--conflict-action",
        choices=["ignore", "merge"],
        default="ignore",
        help="On conflict: ignore duplicates or merge/update them (default: ignore)",
    )

    args = parser.parse_args()

    load_dotenv_file(args.env_file)

    base_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    api_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_API_KEY")

    if not base_url:
        print("Errore: imposta SUPABASE_URL nell'ambiente.", file=sys.stderr)
        sys.exit(1)

    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        print(
            "Errore: SUPABASE_URL non valido. Usa il formato https://<project-ref>.supabase.co",
            file=sys.stderr,
        )
        sys.exit(1)

    # Accept accidental values like https://<ref>.supabase.co/rest/v1 and normalize to project root.
    if parsed.path.startswith("/rest/"):
        base_url = f"{parsed.scheme}://{parsed.netloc}"

    if not api_key:
        print("Errore: imposta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_API_KEY) nell'ambiente.", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(args.csv):
        print(f"Errore: CSV non trovato: {args.csv}", file=sys.stderr)
        sys.exit(1)

    rows = read_csv_rows(args.csv)
    if not rows:
        print("Nessuna riga valida da inviare.")
        sys.exit(0)

    print(f"Caricate {len(rows)} righe dal CSV. Invio a Supabase in batch da {args.batch_size}...")

    sent = 0
    for index, batch in enumerate(chunked(rows, args.batch_size), start=1):
        status, error_body = post_batch(
            base_url=base_url,
            table_name=args.table,
            api_key=api_key,
            rows=batch,
            conflict_column=args.conflict_column,
            conflict_action=args.conflict_action,
        )

        if status is None:
            print(f"Errore batch {index}: connessione fallita.", file=sys.stderr)
            if error_body:
                print(error_body, file=sys.stderr)
            print(
                "Controlla SUPABASE_URL, DNS/rete e che il progetto Supabase sia raggiungibile.",
                file=sys.stderr,
            )
            sys.exit(1)

        if status < 200 or status >= 300:
            print(f"Errore batch {index}: HTTP {status}", file=sys.stderr)
            if error_body:
                print(error_body, file=sys.stderr)
            sys.exit(1)

        sent += len(batch)
        pct = (sent / len(rows)) * 100
        print(f"Batch {index}: {sent}/{len(rows)} ({pct:.1f}%)")

    print("Completato con successo.")
    if args.conflict_action == "ignore":
        print("Modalita attiva: duplicate su id ignorate, vengono inserite solo righe nuove.")
    else:
        print("Modalita attiva: duplicate su id aggiornate (merge).")


if __name__ == "__main__":
    main()
