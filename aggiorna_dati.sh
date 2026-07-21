#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
SKIP_DOWNLOAD=0

mkdir -p "$BACKUP_ROOT" "dati_grezzi" "letture_pulite" "$LOG_DIR"

usage() {
  cat <<'EOF'
Uso: ./aggiorna_dati.sh [opzioni]

Opzioni:
  --skip-download    Salta step 1-3 (backup/pulizia/download) e parte dallo step 4.
  -h, --help         Mostra questo aiuto.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --skip-download)
      SKIP_DOWNLOAD=1
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

if [ -t 1 ]; then
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
  if [ -t 1 ]; then
    # Clear whole line before writing to avoid leftover characters from previous longer content.
    printf '\r\033[2K%s\n' "$text"
  else
    printf '%s\n' "$text"
  fi
}

render_yt_panel() {
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

  if [ "$YT_PANEL_RENDERED" -eq 1 ] && [ -t 1 ]; then
    printf '\033[%sA' "$YT_PANEL_LINES"
  fi

  line1="${COLOR_CYAN}Canali${COLOR_RESET} [${COLOR_CYAN}${channel_bar}${COLOR_RESET}] $(printf '%3d' "$channel_pct")% (${channel_index}/${total_channels}) ${COLOR_MAGENTA}ETA totale: $(format_duration "$total_eta")${COLOR_RESET}"
  line2="${COLOR_GREEN}Video ${COLOR_RESET} [${COLOR_GREEN}${video_bar}${COLOR_RESET}] $(printf '%3d' "$video_pct")% (${video_index}/${video_total}) ${COLOR_MAGENTA}ETA canale: $(format_duration "$channel_eta")${COLOR_RESET}"
  line3="${COLOR_YELLOW}Video corrente:${COLOR_RESET} $(trim_line "$video_info")"
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
  local video_info="In elaborazione"
  local last_log="Avvio yt-dlp"
  local yt_exit_code=0
  local channel_start_sec channel_elapsed total_elapsed now_sec
  local channel_eta total_eta
  local total_units_done total_units_total
  local last_render_sec=-1

  log_msg "Inizio canale ${channel_index}/${total_channels}: ${channel_url} (playlist-end=${playlist_end})"

  channel_start_sec="$SECONDS"
  channel_eta=-1
  total_eta=-1

  render_yt_panel "$channel_index" "$total_channels" "$channel_label" 0 "$fallback_total" "Canale avviato: ${channel_label}" "Preparazione..." "$channel_eta" "$total_eta"
  last_render_sec="$SECONDS"

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
      video_info="Elemento ${current_video}/${detected_total}"
      last_log="$clean_line"
      should_render=1
      force_render=1
    elif [[ "$clean_line" =~ ^\[warning\]|^ERROR:|^WARNING: ]]; then
      last_log="$clean_line"
      should_render=1
      force_render=1
    fi

    if [ "$should_render" -eq 0 ]; then
      continue
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

    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$current_video" "$detected_total" "$video_info" "$last_log" "$channel_eta" "$total_eta"
  done < <(
    set +e
    yt-dlp --playlist-end "$playlist_end" --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "$channel_url" 2>&1
    printf '__YT_EXIT__:%s\n' "$?"
  )

  if [ "$yt_exit_code" -eq 0 ]; then
    now_sec="$SECONDS"
    total_elapsed=$(( now_sec - YT_COLLECTION_START_SEC ))
    total_units_done=$(( channel_index * 1000 ))
    total_units_total=$(( total_channels * 1000 ))
    total_eta="$(estimate_eta_seconds "$total_elapsed" "$total_units_done" "$total_units_total")"
    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$detected_total" "$detected_total" "Canale completato" "Completato" 0 "$total_eta"
    log_msg "Canale completato: ${channel_url}"
  else
    now_sec="$SECONDS"
    total_elapsed=$(( now_sec - YT_COLLECTION_START_SEC ))
    total_units_done=$(( (channel_index - 1) * 1000 + ( current_video * 1000 / (detected_total > 0 ? detected_total : 1) ) ))
    total_units_total=$(( total_channels * 1000 ))
    total_eta="$(estimate_eta_seconds "$total_elapsed" "$total_units_done" "$total_units_total")"
    render_yt_panel "$channel_index" "$total_channels" "$channel_label" "$current_video" "$detected_total" "Errore durante il canale" "Errore (exit ${yt_exit_code})" "$channel_eta" "$total_eta"
    log_msg "Errore canale (exit ${yt_exit_code}): ${channel_url}"
    echo " - ATTENZIONE: comando fallito, continuo comunque:" >&2
    echo "   yt-dlp --playlist-end $playlist_end ... $channel_url" >&2
  fi
}

run_logged_step() {
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

log_msg "Avvio script aggiorna_dati.sh"
log_msg "Log verboso: ${VERBOSE_LOG_FILE}"

echo "Log verboso: $VERBOSE_LOG_FILE"

if [ "$SKIP_DOWNLOAD" -eq 0 ]; then
  echo "[1/6] Backup cartelle..."
  log_msg "[1/6] Backup cartelle"
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

  echo "[2/6] Svuoto cartelle dati_grezzi e letture_pulite..."
  log_msg "[2/6] Pulizia cartelle dati"
  find dati_grezzi -mindepth 1 -delete
  find letture_pulite -mindepth 1 -delete

  echo "[3/6] Raccolta dati con yt-dlp..."
  log_msg "[3/6] Raccolta dati con yt-dlp"
  YT_CHANNEL_SPECS=(
  "40|https://www.youtube.com/@pingpongstyles"
  "60|https://www.youtube.com/@Fitetofficial"
  "60|https://www.youtube.com/@wttglobal"
  "1400|https://www.youtube.com/@ettutvofficial"
  "1000|https://www.youtube.com/@Learn_TableTennis"
  "30|https://www.youtube.com/@MilanoSportTT"
  "1000|https://www.youtube.com/@tt-topspinmessina7289"
  "1000|https://www.youtube.com/@tennistavolosassari3889"
  "1000|https://www.youtube.com/@tennistavolovigevano"
  "1000|https://www.youtube.com/@ttnulvi"
  "1000|https://www.youtube.com/@muraveratennistavolo8062"
  "1000|https://www.youtube.com/@ASDNewTTPieveEmanuele"
  "1000|https://www.youtube.com/@videotttorino8111"
  "1000|https://www.youtube.com/@tennistavolocastelgoffredo3697"
  "30|https://www.youtube.com/@YouPongOfficial"
  "30|https://www.youtube.com/@tabletennis69"
  "30|https://www.youtube.com/@GiacomoCerea"
  "30|https://www.youtube.com/@FilippoCantellaTT"
  "30|https://www.youtube.com/@mitsutabletennis"
  "30|https://www.youtube.com/@Top8TT"
  "30|https://www.youtube.com/@TableSkills"
  "30|https://www.youtube.com/@LucaLaNotteTTplayer"
  "30|https://www.youtube.com/@Simoneleotta0"
  "50|https://www.youtube.com/@TableTennisDaily"
  "50|https://www.youtube.com/@tabletennisindependent3737"
  "50|https://www.youtube.com/@TTtrix"
  "50|https://www.youtube.com/@BeyondThePodiumOfficial"
  "50|https://www.youtube.com/@giacomoizzo2007"
  "1000|https://www.youtube.com/@ZeroNet-TTCARTURA"
  "200|https://www.youtube.com/@Dr.PsyPong" # Filippo Marchese
  "3500|https://www.youtube.com/@ITTFWorld"
  "1800|https://www.youtube.com/@TableTennisEngland"
  "200|https://www.youtube.com/@AndreasLevenko"
  "400|https://www.youtube.com/@tabletennisdailyplus"
  "100|https://www.youtube.com/@TableTennisDailyCast"
  "150|https://www.youtube.com/@PongFoxTabletennis"
  "100|https://www.youtube.com/@World.Table.Tennis"
  "100|https://www.youtube.com/@SpinClips"
  "4500|https://www.youtube.com/@TtblDe" # bundesliga
  "1400|https://www.youtube.com/@malonfanmadechannel" # ma long fan made channel
  "1800|https://www.youtube.com/@ttlondon2012" 
  "150|https://www.youtube.com/@MagnusEffectTT"
  "1200|https://www.youtube.com/@DiegoTTTube"
  "300|https://www.youtube.com/@ttjapan3023"
  "80|https://www.youtube.com/@perdagermo734" #alcuni video sono da cancellare perchè riguardano concerti
  "450|https://www.youtube.com/@GecaPhoenix" 
  "50|https://www.youtube.com/@GecaPhoenix2"
  "500|https://www.youtube.com/@ttstars"
  "1400|https://www.youtube.com/@TTSTARSERIES" 
  "10|https://www.youtube.com/@TTCrazyShot"

  


  )

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
  echo "[1-3/6] Download saltato (--skip-download). Parto dallo step 4..."
  log_msg "[1-3/6] Download saltato (--skip-download)"
fi


run_logged_step_live "[4/6] Elaborazione dati con ytp.py..." "[4/6] Avvio ytp.py" \
  python3 -u ytp.py

run_logged_step "[5/6] Generazione script SQL upsert da CSV best effort..." "[5/6] Avvio csv_to_supabase_upsert_sql.py" \
  python3 csv_to_supabase_upsert_sql.py

run_logged_step "[6/6] Validazione caratteri SQL + creazione chunk per Supabase..." "[6/6] Avvio split_upsert_sql_chunks.py" \
  python3 split_upsert_sql_chunks.py --input "$SQL_SOURCE_FILE" --out-dir "$SQL_CHUNK_DIR" --chunk-size "$SQL_CHUNK_SIZE"

echo "Completato."
echo "Log verboso salvato in: $VERBOSE_LOG_FILE"
log_msg "Script completato con successo"
