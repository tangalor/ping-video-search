#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
CHUNK_DIR="${CHUNK_DIR:-$ROOT_DIR/output_upsert_chunks}"
FILE_GLOB="output_upsert_from_csv_part_*.sql"
PROGRESS_BAR_WIDTH="${PROGRESS_BAR_WIDTH:-28}"
PANEL_LINES=2
PANEL_RENDERED=0

if [[ -t 1 ]]; then
  COLOR_RESET=$'\033[0m'
  COLOR_CYAN=$'\033[36m'
  COLOR_GREEN=$'\033[32m'
  COLOR_RED=$'\033[31m'
  COLOR_YELLOW=$'\033[33m'
else
  COLOR_RESET=""
  COLOR_CYAN=""
  COLOR_GREEN=""
  COLOR_RED=""
  COLOR_YELLOW=""
fi

progress_bar() {
  local current="$1"
  local total="$2"
  local width="$3"
  local filled empty bar=""

  if [[ "$total" -le 0 ]]; then
    total=1
  fi

  filled=$(( current * width / total ))
  empty=$(( width - filled ))

  for ((i=0; i<filled; i++)); do
    bar+="#"
  done
  for ((i=0; i<empty; i++)); do
    bar+="-"
  done

  printf "%s" "$bar"
}

progress_pct() {
  local current="$1"
  local total="$2"
  if [[ "$total" -le 0 ]]; then
    total=1
  fi
  printf "%d" $(( current * 100 / total ))
}

print_status() {
  local level="$1"
  local message="$2"
  local color="$3"
  printf "%s[%s]%s %s\n" "$color" "$level" "$COLOR_RESET" "$message"
}

print_panel_line() {
  local text="$1"
  if [[ -t 1 ]]; then
    printf '\r\033[2K%s\n' "$text"
  else
    printf '%s\n' "$text"
  fi
}

render_progress_panel() {
  local current="$1"
  local total="$2"
  local file_name="$3"
  local status_text="$4"
  local bar pct line1 line2

  bar="$(progress_bar "$current" "$total" "$PROGRESS_BAR_WIDTH")"
  pct="$(progress_pct "$current" "$total")"

  if [[ "$PANEL_RENDERED" -eq 1 && -t 1 ]]; then
    printf '\033[%sA' "$PANEL_LINES"
  fi

  line1="${COLOR_CYAN}Chunk SQL${COLOR_RESET} [${COLOR_CYAN}${bar}${COLOR_RESET}] $(printf '%3d' "$pct")% (${current}/${total})"
  line2="${COLOR_YELLOW}File corrente:${COLOR_RESET} ${file_name} ${COLOR_GREEN}${status_text}${COLOR_RESET}"

  print_panel_line "$line1"
  print_panel_line "$line2"
  PANEL_RENDERED=1
}

if ! command -v psql >/dev/null 2>&1; then
  echo "Errore: psql non trovato nel PATH." >&2
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Errore: SUPABASE_DB_URL non impostata (imposta la variabile ambiente o definiscila in $ENV_FILE)" >&2
  exit 1
fi

if [[ ! -d "$CHUNK_DIR" ]]; then
  echo "Errore: cartella chunk non trovata: $CHUNK_DIR" >&2
  exit 1
fi

shopt -s nullglob
sql_files=("$CHUNK_DIR"/$FILE_GLOB)
shopt -u nullglob

if [[ ${#sql_files[@]} -eq 0 ]]; then
  echo "Errore: nessun file SQL trovato in $CHUNK_DIR con pattern $FILE_GLOB" >&2
  exit 1
fi

echo "Trovati ${#sql_files[@]} file SQL da eseguire."

total_files="${#sql_files[@]}"

for index in "${!sql_files[@]}"; do
  sql_file="${sql_files[$index]}"
  file_name="$(basename "$sql_file")"
  current=$((index + 1))
  tmp_output="$(mktemp)"

  render_progress_panel "$current" "$total_files" "$file_name" "(in esecuzione)"

  if psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$sql_file" >"$tmp_output" 2>&1; then
    render_progress_panel "$current" "$total_files" "$file_name" "${COLOR_GREEN}[success]${COLOR_RESET}"
  else
    render_progress_panel "$current" "$total_files" "$file_name" "${COLOR_RED}[errore]${COLOR_RESET}"
    print_status "ERRORE" "$file_name -> esecuzione fallita" "$COLOR_RED"
    cat "$tmp_output" >&2
    rm -f "$tmp_output"
    exit 1
  fi

  rm -f "$tmp_output"
done

if [[ "$PANEL_RENDERED" -eq 1 ]]; then
  printf '\n'
fi

print_status "OK" "Tutti i chunk SQL sono stati eseguiti con successo." "$COLOR_GREEN"