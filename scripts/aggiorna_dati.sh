#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_ROOT="backup"
BACKUP_GREZZI_DIR="$BACKUP_ROOT/dati_grezzi_$TIMESTAMP"
BACKUP_PULITE_DIR="$BACKUP_ROOT/letture_pulite_$TIMESTAMP"
SQL_SOURCE_FILE="output_upsert_from_csv.sql"
SQL_CHUNK_DIR="output_upsert_chunks"
SQL_CHUNK_SIZE="${SQL_CHUNK_SIZE:-100}"
LOG_DIR="logs"
VERBOSE_LOG_FILE="$LOG_DIR/aggiorna_dati_${TIMESTAMP}.log"
TERMINAL_LOG_FILE="$LOG_DIR/aggiorna_dati_terminal_${TIMESTAMP}.log"
SKIP_DOWNLOAD=0
NOTIFY_EMAIL_TO="tangalor@gmail.com"
NOTIFY_EMAIL_SUBJECT="PingTV / script di aggiunta video completato"
DISABLE_PROGRESS_BARS="${DISABLE_PROGRESS_BARS:-}"
YTDLP_COOKIES_FILE="${YTDLP_COOKIES_FILE:-$ROOT_DIR/.yt-dlp-cookies.txt}"
YTDLP_EXTRACTOR_ARGS="${YTDLP_EXTRACTOR_ARGS:-youtube:player_client=android,mweb}"
YTDLP_USER_AGENT="${YTDLP_USER_AGENT:-}"
YTDLP_SLEEP_REQUESTS="${YTDLP_SLEEP_REQUESTS:-0.75}"
YT_CHANNELS_FILE="${YT_CHANNELS_FILE:-$ROOT_DIR/scripts/youtube_channels.txt}"
YT_CHANNEL_SPECS_FILE="${YT_CHANNEL_SPECS_FILE:-}"
DEFAULT_CUSTOM_CHANNEL_SPECS_FILE="$ROOT_DIR/scripts/youtube_channel_specs.custom.example.txt"
YT_CHANNEL_REPORT_DAYS="${YT_CHANNEL_REPORT_DAYS:-3}"
PROGRESS_FD=1
PROGRESS_IS_TTY=0
mkdir -p "$BACKUP_ROOT" "dati_grezzi" "letture_pulite" "$LOG_DIR"

# Optional: YouTube Data API key — not required for feed download, but available
# if present can be used by resolvers; we still prefer scraping the /videos page.
YT_API_KEY="${YT_API_KEY:-}"

if [[ -z "$DISABLE_PROGRESS_BARS" ]]; then
  if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
    DISABLE_PROGRESS_BARS=1
  else
    DISABLE_PROGRESS_BARS=0
  fi
fi

# When stdout is piped via tee, render progress on the real terminal for in-place updates.
if [[ "$DISABLE_PROGRESS_BARS" != "1" ]] && [[ -z "${GITHUB_ACTIONS:-}" ]] && [[ -e /dev/tty ]]; then
  if exec 3>/dev/tty; then
    PROGRESS_FD=3
    PROGRESS_IS_TTY=1
  fi
fi

# Capture only what is printed to terminal (stdout/stderr) in a dedicated log.
exec > >(tee -a "$TERMINAL_LOG_FILE") 2>&1

usage() {
  cat <<'EOF'
Uso: ./scripts/aggiorna_dati.sh [opzioni]

Opzioni:
  --skip-download    Salta step 1-3 (backup/pulizia/download) e parte dallo step 4.
  --use-custom-channel-specs
                     Usa automaticamente scripts/youtube_channel_specs.custom.example.txt.
  -h, --help         Mostra questo aiuto.

Ambiente:
  YT_API_KEY         (opzionale) YouTube Data API key — non richiesta per scaricare il feed RSS
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-download)
      SKIP_DOWNLOAD=1
      shift
      ;;
    --use-custom-channel-specs)
      YT_CHANNEL_SPECS_FILE="$DEFAULT_CUSTOM_CHANNEL_SPECS_FILE"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opzione non riconosciuta: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

log_msg() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$VERBOSE_LOG_FILE"
}

run_yt() {
  if ! "$@"; then
    echo " - ATTENZIONE: comando fallito, continuo comunque:" >&2
    echo "   $*" >&2
  fi
}

PROGRESS_BAR_WIDTH=34
YT_PANEL_LINES=4
YT_PANEL_RENDERED=0
YT_COLLECTION_START_SEC=0
YT_MIN_UPDATE_INTERVAL=1

if [[ "$PROGRESS_IS_TTY" -eq 1 ]] || [ -t 1 ]; then
  COLOR_RESET=$'\033[0m'
  COLOR_CYAN=$'\033[36m'
  COLOR_GREEN=$'\033[32m'
  COLOR_YELLOW=$'\033[33m'
  COLOR_MAGENTA=$'\033[35m'
  COLOR_DIM=$'\033[2m'
else
  COLOR_RESET=""
  COLOR_CYAN=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_MAGENTA=""
  COLOR_DIM=""
fi

progress_bar() {
  local current="$1"
  local total="$2"
  local width="${3:-$PROGRESS_BAR_WIDTH}"
  local filled empty bar=""

  if [ "$total" -le 0 ]; then
    total=1
  fi
  if [ "$current" -lt 0 ]; then
    current=0
  fi
  if [ "$current" -gt "$total" ]; then
    current="$total"
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
  if [ "$total" -le 0 ]; then
    total=1
  fi
  if [ "$current" -lt 0 ]; then
    current=0
  fi
  if [ "$current" -gt "$total" ]; then
    current="$total"
  fi
  printf "%d" $(( current * 100 / total ))
}

trim_line() {
  local text="$1"
  local max_len="${2:-120}"

  if [ "${#text}" -le "$max_len" ]; then
    printf "%s" "$text"
    return
  fi

  printf "%s..." "${text:0:max_len-3}"
}

format_duration() {
  local total_seconds="$1"
  local hours minutes seconds

  if [ "$total_seconds" -lt 0 ]; then
    printf '%s' '--:--:--'
    return
  fi

  hours=$(( total_seconds / 3600 ))
  minutes=$(( (total_seconds % 3600) / 60 ))
  seconds=$(( total_seconds % 60 ))
  printf "%02d:%02d:%02d" "$hours" "$minutes" "$seconds"
}

estimate_eta_seconds() {
  local elapsed="$1"
  local done_units="$2"
  local total_units="$3"

  if [ "$done_units" -le 0 ] || [ "$total_units" -le 0 ] || [ "$done_units" -gt "$total_units" ]; then
    printf "%d" -1
    return
  fi

  printf "%d" $(( elapsed * (total_units - done_units) / done_units ))
}

print_panel_line() {
  local text="$1"
  if [[ "$PROGRESS_IS_TTY" -eq 1 ]]; then
    printf '\r\033[2K%s\n' "$text" >&3
  elif [ -t 1 ]; then
    # Clear whole line before writing to avoid leftover characters from previous longer content.
    printf '\r\033[2K%s\n' "$text"
  else
    printf '%s\n' "$text"
  fi
}

render_yt_panel() {
  if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
    return
  fi

  local channel_index="$1"
  local total_channels="$2"
  local channel_label="$3"
  local video_index="$4"
  local video_total="$5"
  local video_info="$6"
  local last_log="$7"
  local channel_eta="$8"
  local total_eta="$9"

  local channel_bar channel_pct video_bar video_pct
  local line1 line2 line3 line4
  channel_bar="$(progress_bar "$channel_index" "$total_channels")"
  channel_pct="$(progress_pct "$channel_index" "$total_channels")"
  video_bar="$(progress_bar "$video_index" "$video_total")"
  video_pct="$(progress_pct "$video_index" "$video_total")"

  if [ "$YT_PANEL_RENDERED" -eq 1 ] && [[ "$PROGRESS_IS_TTY" -eq 1 ]]; then
    printf '\033[%sA' "$YT_PANEL_LINES" >&3
  elif [ "$YT_PANEL_RENDERED" -eq 1 ] && [ -t 1 ]; then
    printf '\033[%sA' "$YT_PANEL_LINES"
  fi

  line1="${COLOR_CYAN}Canali${COLOR_RESET} [${COLOR_CYAN}${channel_bar}${COLOR_RESET}] $(printf '%3d' "$channel_pct")% (${channel_index}/${total_channels}) ${COLOR_MAGENTA}ETA totale: $(format_duration ${total_eta:-0})${COLOR_RESET}"
  line2="${COLOR_GREEN}Video ${COLOR_RESET} [${COLOR_GREEN}${video_bar}${COLOR_RESET}] $(printf '%3d' "$video_pct")% (${video_index}/${video_total}) ${COLOR_MAGENTA}ETA canale: $(format_duration ${channel_eta:-0})${COLOR_RESET}"
  line3="${COLOR_YELLOW}Canale corrente:${COLOR_RESET} $(trim_line "$video_info")"
  line4="${COLOR_DIM}Log:${COLOR_RESET} $(trim_line "$last_log")"

  print_panel_line "$line1"
  print_panel_line "$line2"
  print_panel_line "$line3"
  print_panel_line "$line4"

  YT_PANEL_RENDERED=1
}

run_yt_channel_with_progress() {
  local playlist_end="$1"
  local channel_url="$2"
  local channel_index="$3"
  local total_channels="$4"
  local channel_label="${channel_url##*/}"
  local fallback_total="$playlist_end"
  local current_video=0
  local detected_total="$fallback_total"
  local channel_info="Canale in elaborazione: ${channel_label}"
  local last_log="Avvio yt-dlp"
  local yt_exit_code=0
  local channel_start_sec channel_elapsed total_elapsed now_sec
  local channel_eta total_eta
  local total_units_done total_units_total
  local last_render_sec=-1
  local hidden_warning_count=0
  local -a yt_cmd

  log_msg "Inizio canale ${channel_index}/${total_channels}: ${channel_url} (playlist-end=${playlist_end})"

  if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
    echo " - canale ${channel_index}/${total_channels}: ${channel_url} (playlist-end=${playlist_end})"
  fi

  channel_start_sec="$SECONDS"
  channel_eta=-1
  total_eta=-1

  render_yt_panel "$channel_index" "$total_channels" "$channel_label" 0 "$fallback_total" "$channel_info" "Preparazione..." "$channel_eta" "$total_eta"
  last_render_sec="$SECONDS"

  yt_cmd=(
    yt-dlp
    --playlist-end "$playlist_end"
    --ignore-errors
    --ignore-no-formats-error
    --no-download
    -t sleep
    --sleep-requests "$YTDLP_SLEEP_REQUESTS"
    --write-info-json
    --output "dati_grezzi/%(id)s"
  )

  if [ -f "$YTDLP_COOKIES_FILE" ]; then
    yt_cmd+=(--cookies "$YTDLP_COOKIES_FILE")
    log_msg "yt-dlp: cookies attivi da $YTDLP_COOKIES_FILE"
  fi

  if [ -n "$YTDLP_EXTRACTOR_ARGS" ]; then
    yt_cmd+=(--extractor-args "$YTDLP_EXTRACTOR_ARGS")
  fi

  if [ -n "$YTDLP_USER_AGENT" ]; then
    yt_cmd+=(--user-agent "$YTDLP_USER_AGENT")
  fi

  yt_cmd+=("$channel_url")

  while IFS= read -r line; do
    local should_render=0
    local force_render=0
    local clean_line

    clean_line="${line//$'\r'/}"
    clean_line="${clean_line//$'\033'/}"

    if [[ "$clean_line" =~ ^__YT_EXIT__:([0-9]+)$ ]]; then
      yt_exit_code="${BASH_REMATCH[1]}"
      break
    fi

    printf '%s\n' "$clean_line" >> "$VERBOSE_LOG_FILE"

    if [[ "$clean_line" =~ Downloading[[:space:]]+(video|item)[[:space:]]+([0-9]+)[[:space:]]+of[[:space:]]+([0-9]+) ]]; then
      current_video="${BASH_REMATCH[2]}"
      detected_total="${BASH_REMATCH[3]}"
      last_log="$clean_line"
      should_render=1
      force_render=1
    elif [[ "$clean_line" =~ ^\[warning\]|^ERROR:|^WARNING: ]]; then
      last_log="$clean_line"
      should_render=1
      force_render=1
      hidden_warning_count=$((hidden_warning_count + 1))
    fi

    if [ "$should_render" -eq 0 ]; then
      continue
    fi

    if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
      if [[ "$clean_line" =~ ^\[warning\]|^ERROR:|^WARNING: ]]; then
        continue
      fi
      printf '   [%s/%s %s] %s\n' "$channel_index" "$total_channels" "$channel_label" "$clean_line"
    fi

    now_sec="$SECONDS"
    if [ "$force_render" -eq 0 ] && [ "$last_render_sec" -ge 0 ] && [ $(( now_sec - last_render_sec )) -lt "$YT_MIN_UPDATE_INTERVAL" ]; then
      continue
    fi
    last_render_sec="$now_sec"

    channel_elapsed=$(( now_sec - channel_start_sec ))
    total_elapsed=$(( now_sec - YT_COLLECTION_START_SEC ))

    channel_eta="$(estimate_eta_seconds "$channel_elapsed" "$current_video" "$detected_total")"

    total_units_done=$(( (channel_index - 1) * 1000 + ( current_video * 1000 / (detected_total > 0 ? detected_total : 1) ) ))
    total_units_total=$(( total_channels * 1000 ))
    total_eta="$(estimate_eta_seconds "$total_elapsed" "$total_units_done" "$total_units_total")"

    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$current_video" "$detected_total" "$channel_info" "$last_log" "$channel_eta" "$total_eta"
  done < <(
    set +e
    "${yt_cmd[@]}" 2>&1
    printf '__YT_EXIT__:%s\n' "$?"
  )

  if [ "$yt_exit_code" -eq 0 ]; then
    if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
      echo "   [${channel_index}/${total_channels} ${channel_label}] completato"
      if [ "$hidden_warning_count" -gt 0 ]; then
        echo "   [${channel_index}/${total_channels} ${channel_label}] avvisi nascosti: ${hidden_warning_count} (dettagli nel log verboso)"
      fi
    fi
    now_sec="$SECONDS"
    total_elapsed=$(( now_sec - YT_COLLECTION_START_SEC ))
    total_units_done=$(( channel_index * 1000 ))
    total_units_total=$(( total_channels * 1000 ))
    total_eta="$(estimate_eta_seconds "$total_elapsed" "$total_units_done" "$total_units_total")"
    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$detected_total" "$detected_total" "$channel_info" "Completato" 0 "$total_eta"
    log_msg "Canale completato: ${channel_url}"
  else
    if [[ "$DISABLE_PROGRESS_BARS" == "1" ]]; then
      echo "   [${channel_index}/${total_channels} ${channel_label}] fallito (exit ${yt_exit_code})"
      echo "   [${channel_index}/${total_channels} ${channel_label}] ultimo evento: ${last_log}"
      if [ "$hidden_warning_count" -gt 0 ]; then
        echo "   [${channel_index}/${total_channels} ${channel_label}] avvisi nascosti: ${hidden_warning_count} (dettagli nel log verboso)"
      fi
    fi
    now_sec="$SECONDS"
    total_elapsed=$(( now_sec - YT_COLLECTION_START_SEC ))
    total_units_done=$(( (channel_index - 1) * 1000 + ( current_video * 1000 / (detected_total > 0 ? detected_total : 1) ) ))
    total_units_total=$(( total_channels * 1000 ))
    total_eta="$(estimate_eta_seconds "$total_elapsed" "$total_units_done" "$total_units_total")"
    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$current_video" "$detected_total" "$channel_info" "Errore (exit ${yt_exit_code})" "$channel_eta" "$total_eta"
    log_msg "Errore canale (exit ${yt_exit_code}): ${channel_url}"
    echo " - ATTENZIONE: comando fallito, continuo comunque:" >&2
    echo "   yt-dlp --playlist-end $playlist_end ... $channel_url" >&2
  fi
}

run_logged_step() {
  if [ "$#" -lt 3 ]; then
    echo "Errore interno: run_logged_step richiede almeno 3 argomenti (label, descrizione, comando)." >&2
    exit 1
  fi

  local step_label="$1"
  local command_desc="$2"
  shift 2

  echo "$step_label"
  log_msg "$command_desc"

  if ! "$@" >> "$VERBOSE_LOG_FILE" 2>&1; then
    log_msg "Errore: ${command_desc}"
    echo "Errore durante: ${command_desc}. Dettagli nel log: $VERBOSE_LOG_FILE" >&2
    exit 1
  fi
}

run_logged_step_live() {
  if [ "$#" -lt 3 ]; then
    echo "Errore interno: run_logged_step_live richiede almeno 3 argomenti (label, descrizione, comando)." >&2
    exit 1
  fi

  local step_label="$1"
  local command_desc="$2"
  shift 2

  echo "$step_label"
  log_msg "$command_desc"

  if ! "$@" 2>&1 | tee -a "$VERBOSE_LOG_FILE"; then
    log_msg "Errore: ${command_desc}"
    echo "Errore durante: ${command_desc}. Dettagli nel log: $VERBOSE_LOG_FILE" >&2
    exit 1
  fi
}

print_generation_summary() {
  local csv_records sql_inserts

  csv_records="$({
    python3 - "$ROOT_DIR/output.csv" <<'PY'
import csv
import sys

path = sys.argv[1]
count = 0
with open(path, newline='', encoding='utf-8') as handle:
    reader = csv.reader(handle, delimiter=';')
    next(reader, None)
    for _ in reader:
        count += 1
print(count)
PY
  } 2>/dev/null || printf 'N/D')"

  sql_inserts="$({ grep -c '^INSERT INTO' "$SQL_SOURCE_FILE"; } 2>/dev/null || printf 'N/D')"

  echo "[5/7] Confronto volumi generati: CSV record=${csv_records}, SQL INSERT=${sql_inserts}"
  log_msg "[5/7] Confronto volumi generati: CSV record=${csv_records}, SQL INSERT=${sql_inserts}"
}

send_completion_email() {
  local recipient="$1"
  local subject="$2"
  local body_file="$3"

  if [ ! -s "$body_file" ]; then
    log_msg "Invio mail saltato: log vuoto o non disponibile ($body_file)"
    return 0
  fi

  if command -v mail >/dev/null 2>&1; then
    if mail -s "$subject" "$recipient" < "$body_file"; then
      log_msg "Mail inviata con successo a $recipient tramite comando mail"
      echo "Notifica email inviata a $recipient"
      return 0
    fi
    log_msg "Tentativo invio mail tramite comando mail fallito"
  fi

  if command -v sendmail >/dev/null 2>&1; then
    {
      printf 'To: %s\n' "$recipient"
      printf 'Subject: %s\n' "$subject"
      printf 'Content-Type: text/plain; charset=UTF-8\n'
      printf '\n'
      cat "$body_file"
    } | sendmail -t

    if [ "$?" -eq 0 ]; then
      log_msg "Mail inviata con successo a $recipient tramite comando sendmail"
      echo "Notifica email inviata a $recipient"
      return 0
    fi

    log_msg "Tentativo invio mail tramite comando sendmail fallito"
  fi

  echo "ATTENZIONE: impossibile inviare la mail (mail/sendmail non disponibili o errore invio)." >&2
  log_msg "Invio mail non riuscito: nessun transport disponibile o errore invio"
  return 1
}

log_msg "Avvio script aggiorna_dati.sh"
log_msg "Log verboso: ${VERBOSE_LOG_FILE}"

echo "Log terminale: $TERMINAL_LOG_FILE"
echo "Log verboso: $VERBOSE_LOG_FILE"

if [ "$SKIP_DOWNLOAD" -eq 0 ]; then
  echo "[1/7] Backup cartelle..."
  log_msg "[1/7] Backup cartelle"
  if [ -n "$(find "dati_grezzi" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    mkdir -p "$BACKUP_GREZZI_DIR"
    cp -a dati_grezzi/. "$BACKUP_GREZZI_DIR/"
  else
    echo " - dati_grezzi vuota: nessun file da salvare"
  fi

  if [ -n "$(find "letture_pulite" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    mkdir -p "$BACKUP_PULITE_DIR"
    cp -a letture_pulite/. "$BACKUP_PULITE_DIR/"
  else
    echo " - letture_pulite vuota: nessun file da salvare"
  fi

  echo "[2/7] Svuoto cartelle dati_grezzi e letture_pulite..."
  log_msg "[2/7] Pulizia cartelle dati"
  find dati_grezzi -mindepth 1 -delete
  find letture_pulite -mindepth 1 -delete

  echo "[3/7] Raccolta dati con yt-dlp..."
  log_msg "[3/7] Raccolta dati con yt-dlp"
  if [[ -n "$YT_CHANNEL_SPECS_FILE" ]]; then
    echo " - uso lista custom numero|url da: $YT_CHANNEL_SPECS_FILE"
    log_msg "[3/7] Uso lista custom YT_CHANNEL_SPECS da $YT_CHANNEL_SPECS_FILE"

    if [[ ! -f "$YT_CHANNEL_SPECS_FILE" ]]; then
      log_msg "Errore: file custom YT_CHANNEL_SPECS non trovato: $YT_CHANNEL_SPECS_FILE"
      echo "Errore: file custom YT_CHANNEL_SPECS non trovato: $YT_CHANNEL_SPECS_FILE" >&2
      exit 1
    fi

    mapfile -t YT_CHANNEL_SPECS < <(grep -Ev '^[[:space:]]*($|#)' "$YT_CHANNEL_SPECS_FILE")
  else
    echo " - aggiorno YT_CHANNEL_SPECS dal report RSS (${YT_CHANNEL_REPORT_DAYS} giorni, solo colonna video)"
    log_msg "[3/7] Generazione YT_CHANNEL_SPECS dal report RSS"

    report_specs_file="$(mktemp)"
    if ! YT_API_KEY="$YT_API_KEY" bash scripts/report_youtube_recent_channels.sh \
      --days "$YT_CHANNEL_REPORT_DAYS" \
      --channels-file "$YT_CHANNELS_FILE" \
      --emit-specs > "$report_specs_file"; then
      rm -f "$report_specs_file"
      log_msg "Errore: generazione YT_CHANNEL_SPECS dal report RSS"
      echo "Errore durante la generazione della lista canali attivi dal report RSS." >&2
      exit 1
    fi

    mapfile -t YT_CHANNEL_SPECS < "$report_specs_file"
    rm -f "$report_specs_file"
  fi

  for spec in "${YT_CHANNEL_SPECS[@]}"; do
    if [[ ! "$spec" =~ ^[0-9]+\|https://www\.youtube\.com/ ]]; then
      log_msg "Errore: riga YT_CHANNEL_SPECS non valida: $spec"
      echo "Errore: riga YT_CHANNEL_SPECS non valida: $spec" >&2
      exit 1
    fi
  done

  if [ "${#YT_CHANNEL_SPECS[@]}" -gt 0 ]; then
    echo " - canali selezionati (numero|url):"
    log_msg "[3/7] Elenco canali selezionati (numero|url):"
    for spec in "${YT_CHANNEL_SPECS[@]}"; do
      echo "   $spec"
      log_msg "[3/7]   $spec"
    done
  fi

  if [ "${#YT_CHANNEL_SPECS[@]}" -eq 0 ]; then
    echo " - nessun canale con video classici nel range richiesto: salto il download YouTube"
    log_msg "[3/7] Nessun canale con video classici nel range richiesto"
  fi

  YT_COLLECTION_START_SEC="$SECONDS"

  for index in "${!YT_CHANNEL_SPECS[@]}"; do
    spec="${YT_CHANNEL_SPECS[$index]}"
    IFS='|' read -r playlist_end channel_url <<< "$spec"
    channel_position=$((index + 1))

    run_yt_channel_with_progress "$playlist_end" "$channel_url" "$channel_position" "${#YT_CHANNEL_SPECS[@]}"
  done

  if [ "$YT_PANEL_RENDERED" -eq 1 ]; then
    printf "\n"
  fi
else
  echo "[1-3/7] Download saltato (--skip-download). Parto dallo step 4..."
  log_msg "[1-3/7] Download saltato (--skip-download)"
fi


run_logged_step_live "[4/7] Elaborazione dati con ytp.py..." "[4/7] Avvio ytp.py" python3 -u scripts/ytp.py

run_logged_step "[5/7] Generazione script SQL upsert da CSV best effort..." "[5/7] Avvio csv_to_supabase_upsert_sql.py" python3 scripts/csv_to_supabase_upsert_sql.py

print_generation_summary

run_logged_step "[6/7] Validazione caratteri SQL + creazione chunk per Supabase..." "[6/7] Avvio split_upsert_sql_chunks.py" python3 scripts/split_upsert_sql_chunks.py --input "$SQL_SOURCE_FILE" [...]

run_logged_step_live "[7/7] Esecuzione chunk SQL su Supabase via psql..." "[7/7] Avvio esegui_upsert_chunks_psql.sh" bash scripts/esegui_upsert_chunks_psql.sh

echo "✅ Completato."
echo "Log terminale salvato in: $TERMINAL_LOG_FILE"
echo "Log verboso salvato in: $VERBOSE_LOG_FILE"
log_msg "✅ Script completato con successo"

send_completion_email "$NOTIFY_EMAIL_TO" "$NOTIFY_EMAIL_SUBJECT" "$TERMINAL_LOG_FILE" || true
