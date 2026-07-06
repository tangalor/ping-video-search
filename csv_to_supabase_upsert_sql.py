#!/usr/bin/env python3
import csv
import datetime
import json
import pathlib

CSV_PATH = pathlib.Path("output.csv")
SQL_PATH = pathlib.Path("output_upsert_from_csv.sql")
TABLE_NAME = "ping-video"
EXCLUDED_COLUMNS = {"update_at", "updated_at"}

LIST_COLUMNS = {"categories", "tags", "atleti"}
INT_COLUMNS = {"view_count", "like_count", "duration"}


def to_nullable_string(value):
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


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


def normalize_row(raw):
    row = {}
    for key, value in raw.items():
        if key in EXCLUDED_COLUMNS:
            continue
        if key in LIST_COLUMNS:
            row[key] = to_list(value)
        elif key in INT_COLUMNS:
            row[key] = to_nullable_int(value)
        else:
            row[key] = to_nullable_string(value)
    return row if row.get("id") else None


def pg_quote_ident(name):
    return '"' + str(name).replace('"', '""') + '"'


def pg_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)

    text = json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else str(value)
    return "'" + text.replace("'", "''") + "'"


def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV non trovato: {CSV_PATH}")

    rows = []
    with CSV_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for raw in reader:
            row = normalize_row(raw)
            if row is not None:
                rows.append(row)

    if not rows:
        raise RuntimeError("Nessuna riga valida nel CSV")

    columns = []
    for row in rows:
        for key in row.keys():
            if key not in columns:
                columns.append(key)

    col_sql = ", ".join(pg_quote_ident(col) for col in columns)
    update_cols = [col for col in columns if col != "id"]
    set_sql = ", ".join(
        f"{pg_quote_ident(col)} = EXCLUDED.{pg_quote_ident(col)}" for col in update_cols
    )

    lines = [
        "-- Auto-generated from output.csv",
        f"-- Generated at {datetime.datetime.now().isoformat(timespec='seconds')}",
        "BEGIN;",
    ]

    for row in rows:
        values = ", ".join(pg_literal(row.get(col)) for col in columns)
        lines.append(
            f"INSERT INTO public.\"{TABLE_NAME}\" ({col_sql}) VALUES ({values}) "
            f"ON CONFLICT (id) DO UPDATE SET {set_sql};"
        )

    lines.append("COMMIT;")
    SQL_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"SQL generato: {SQL_PATH} ({len(rows)} righe)")


if __name__ == "__main__":
    main()
