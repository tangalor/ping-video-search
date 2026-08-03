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
DISABLE_PROGRESS_BARS="${DISABLE_PROGRESS_BARS:-}"
PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"
PSQL_MAX_RETRIES="${PSQL_MAX_RETRIES:-4}"
PSQL_RETRY_DELAY_SEC="${PSQL_RETRY_DELAY_SEC:-3}"
FORCE_IPV4_ON_NETWORK_ERROR="${FORCE_IPV4_ON_NETWORK_ERROR:-1}"

if [[ -z "$DISABLE_PROGRESS_BARS" ]]; then
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    DISABLE_PROGRESS_BARS=1
  else
    DISABLE_PROGRESS_BARS=0
  fi
fi

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

extract_host_from_pg_url() {
  local url="$1"
  # postgres://user:pass@host:5432/db -> host
  printf '%s' "$url" | sed -E 's#^[^:]+://[^@/]*@([^:/?]+).*#\1#'
}

resolve_ipv4_for_host() {
  local host="$1"
  local ip=""

  if command -v getent >/dev/null 2>&1; then
    ip="$(getent ahostsv4 "$host" 2>/dev/null | awk 'NR==1 {print $1}')"
  fi

  if [[ -z "$ip" ]] && command -v dig >/dev/null 2>&1; then
    ip="$(dig +short A "$host" 2>/dev/null | head -n 1)"
  fi

  printf '%s' "$ip"
}

run_psql_with_retries() {
  local sql_file="$1"
  local tmp_output="$2"
  local attempt=1
  local forced_ipv4=0
  local host ip sleep_sec

  while [[ "$attempt" -le "$PSQL_MAX_RETRIES" ]]; do
    if psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$sql_file" >"$tmp_output" 2>&1; then
      return 0
    fi

    if [[ "$FORCE_IPV4_ON_NETWORK_ERROR" == "1" ]] && [[ "$forced_ipv4" -eq 0 ]] && grep -qi "Network is unreachable" "$tmp_output"; then
      host="$(extract_host_from_pg_url "$SUPABASE_DB_URL")"
      ip="$(resolve_ipv4_for_host "$host")"
      if [[ -n "$ip" ]]; then
        export PGHOSTADDR="$ip"
        forced_ipv4=1
        print_status "WARN" "Rete IPv6 non raggiungibile, forzo IPv4 su $host ($ip)" "$COLOR_YELLOW"
      else
        print_status "WARN" "Rete IPv6 non raggiungibile e impossibile risolvere IPv4 per $host" "$COLOR_YELLOW"
      fi
    fi

    if [[ "$attempt" -lt "$PSQL_MAX_RETRIES" ]]; then
      sleep_sec=$(( PSQL_RETRY_DELAY_SEC * attempt ))
      print_status "WARN" "Tentativo $attempt/$PSQL_MAX_RETRIES fallito per $(basename "$sql_file"). Retry tra ${sleep_sec}s..." "$COLOR_YELLOW"
      sleep "$sleep_sec"
    fi

    attempt=$((attempt + 1))
  done

  return 1
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
  if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
    return
  fi

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

export PGCONNECT_TIMEOUT

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

  if run_psql_with_retries "$sql_file" "$tmp_output"; then
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