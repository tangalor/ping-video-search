#!/usr/bin/env python3
from __future__ import annotations

import argparse
import unicodedata
from pathlib import Path


def parse_sql_statements(sql_text: str) -> list[str]:
    statements: list[str] = []
    buf: list[str] = []
    in_single_quote = False
    i = 0

    while i < len(sql_text):
        ch = sql_text[i]
        buf.append(ch)

        if ch == "'":
            if in_single_quote and i + 1 < len(sql_text) and sql_text[i + 1] == "'":
                buf.append("'")
                i += 1
            else:
                in_single_quote = not in_single_quote
        elif ch == ";" and not in_single_quote:
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []

        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)

    return statements


def find_unbalanced_single_quotes(text: str) -> bool:
    in_single_quote = False
    i = 0
    while i < len(text):
        ch = text[i]
        if ch == "'":
            if in_single_quote and i + 1 < len(text) and text[i + 1] == "'":
                i += 2
                continue
            in_single_quote = not in_single_quote
        i += 1
    return in_single_quote


def find_disallowed_chars(text: str) -> list[tuple[int, str, str]]:
    bad: list[tuple[int, str, str]] = []
    for idx, ch in enumerate(text, start=1):
        if ch in ("\n", "\r", "\t"):
            continue
        category = unicodedata.category(ch)
        if category.startswith("C") or category in ("Zl", "Zp"):
            bad.append((idx, f"U+{ord(ch):04X}", category))
    return bad


def validate_insert_statements(insert_statements: list[str], max_reports: int = 20) -> None:
    report_count = 0
    issues: list[str] = []

    for stmt_idx, stmt in enumerate(insert_statements, start=1):
        stmt_upper = stmt.upper()

        if not stmt_upper.startswith("INSERT INTO "):
            issues.append(f" - statement #{stmt_idx}: statement non INSERT")
            report_count += 1

        if " VALUES (" not in stmt_upper:
            issues.append(f" - statement #{stmt_idx}: manca clausola VALUES")
            report_count += 1

        if " ON CONFLICT " not in stmt_upper or " DO UPDATE SET " not in stmt_upper:
            issues.append(f" - statement #{stmt_idx}: manca clausola UPSERT (ON CONFLICT ... DO UPDATE SET)")
            report_count += 1

        if find_unbalanced_single_quotes(stmt):
            issues.append(f" - statement #{stmt_idx}: apici singoli non bilanciati")
            report_count += 1

        bad_chars = find_disallowed_chars(stmt)
        if bad_chars:
            preview = ", ".join([f"pos {pos} ({code}, {cat})" for pos, code, cat in bad_chars[:5]])
            issues.append(f" - statement #{stmt_idx}: caratteri controllo non ammessi ({preview})")
            report_count += 1

        if report_count >= max_reports:
            break

    if issues:
        details = "\n".join(issues)
        raise SystemExit(
            "Errore validazione SQL: trovati caratteri anomali o stringhe non valide che possono rompere INSERT/UPSERT.\n"
            f"{details}\n"
            "Rigenera il file SQL dalla sorgente pulita prima di procedere."
        )


def write_chunks(statements: list[str], out_dir: Path, source_name: str, chunk_size: int) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)

    for old in out_dir.glob("output_upsert_from_csv_part_*.sql"):
        old.unlink()

    chunk_count = 0
    total = len(statements)

    for chunk_count, start in enumerate(range(0, total, chunk_size), start=1):
        part = statements[start : start + chunk_size]
        file_path = out_dir / f"output_upsert_from_csv_part_{chunk_count:03d}.sql"

        lines = [
            f"-- Auto-split from {source_name}",
            f"-- Statements {start + 1}..{start + len(part)} of {total}",
            "BEGIN;",
        ]
        lines.extend(part)
        lines.append("COMMIT;")
        lines.append("")

        file_path.write_text("\n".join(lines), encoding="utf-8")

    return chunk_count


def main() -> int:
    parser = argparse.ArgumentParser(description="Split upsert SQL into chunk files for easier Supabase execution")
    parser.add_argument("--input", default="output_upsert_from_csv.sql", help="Input SQL file")
    parser.add_argument("--out-dir", default="output_upsert_chunks", help="Output directory for chunks")
    parser.add_argument("--chunk-size", type=int, default=100, help="Statements per chunk")
    args = parser.parse_args()

    if args.chunk_size <= 0:
        raise SystemExit("Errore: --chunk-size deve essere > 0")

    src = Path(args.input)
    out_dir = Path(args.out_dir)

    if not src.exists():
        raise SystemExit(f"Errore: file input non trovato: {src}")

    try:
        sql_text = src.read_text(encoding="utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise SystemExit(
            "Errore validazione SQL: file non UTF-8 valido, possibile presenza di byte anomali "
            f"(offset {exc.start})."
        )

    statements = parse_sql_statements(sql_text)
    insert_statements = [s for s in statements if s.lstrip().upper().startswith("INSERT INTO ")]

    if not insert_statements:
        raise SystemExit("Errore: nessuno statement INSERT trovato nel file input")

    validate_insert_statements(insert_statements)

    chunk_count = write_chunks(insert_statements, out_dir, src.name, args.chunk_size)

    print(f"Creati {chunk_count} chunk in {out_dir}")
    print(f"Statement INSERT totali: {len(insert_statements)}")
    print(f"Statement per chunk: {args.chunk_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
