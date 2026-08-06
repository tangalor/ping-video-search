#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DAYS=3
USER_AGENT="${USER_AGENT:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36}"
CHANNELS_FILE="${CHANNELS_FILE:-$SCRIPT_DIR/youtube_channels.txt}"
EMIT_SPECS_ONLY=0

usage() {
  cat <<'EOF'
Uso: ./scripts/report_youtube_recent_channels.sh [opzioni]

Opzioni:
  --days N             Intervallo giorni: 0=today, 1=ieri+oggi, 2=2 giorni+oggi, ...
  --channels-file FILE File statico con la lista URL canali
  --emit-specs         Stampa solo righe machine-readable nel formato numero|url
  -h, --help           Mostra questo aiuto

Ambiente:
  USER_AGENT           User-Agent per le richieste HTTP verso YouTube
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --days)
      DAYS="${2:-}"
      shift 2
      ;;
    --channels-file)
      CHANNELS_FILE="${2:-}"
      shift 2
      ;;
    --emit-specs)
      EMIT_SPECS_ONLY=1
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

if ! command -v python3 >/dev/null 2>&1; then
  echo "Errore: python3 non trovato nel PATH." >&2
  exit 1
fi

if [[ ! -f "$CHANNELS_FILE" ]]; then
  echo "Errore: file canali non trovato: $CHANNELS_FILE" >&2
  exit 1
fi

if ! [[ "$DAYS" =~ ^[0-9]+$ ]]; then
  echo "Errore: --days deve essere un intero >= 0." >&2
  exit 1
fi

RANGE_START_DATE="$(python3 - "$DAYS" <<'PY'
import sys
from datetime import datetime, timedelta

days = int(sys.argv[1])
start = datetime.now().astimezone().date() - timedelta(days=days)
print(start.strftime("%Y%m%d"))
PY
)"

RANGE_END_DATE="$(python3 <<'PY'
from datetime import datetime

print(datetime.now().astimezone().date().strftime("%Y%m%d"))
PY
)"

START_HUMAN="$(python3 - "$RANGE_START_DATE" <<'PY'
import sys
from datetime import datetime

print(datetime.strptime(sys.argv[1], "%Y%m%d").strftime("%d/%m/%Y"))
PY
)"

END_HUMAN="$(python3 - "$RANGE_END_DATE" <<'PY'
import sys
from datetime import datetime

print(datetime.strptime(sys.argv[1], "%Y%m%d").strftime("%d/%m/%Y"))
PY
)"

resolve_channel_id() {
  local url="$1"
  python3 - "$url" "$USER_AGENT" <<'PY'
import re
import sys
import urllib.request

url = sys.argv[1].rstrip('/') + '/videos'
user_agent = sys.argv[2]
request = urllib.request.Request(
    url,
    headers={
        'User-Agent': user_agent,
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
    },
)

try:
    with urllib.request.urlopen(request, timeout=20) as response:
        html = response.read().decode('utf-8', errors='replace')
except Exception as exc:
    print(f'ERROR\t{exc}')
    sys.exit(2)

patterns = [
    r'"channelId":"(UC[^"]+)"',
    r'"externalId":"(UC[^"]+)"',
    r'"browseId":"(UC[^"]+)"',
]

for pattern in patterns:
    match = re.search(pattern, html)
    if match:
        print(match.group(1))
        sys.exit(0)

print('ERROR\tchannelId not found')
sys.exit(1)
PY
}

count_recent_items_from_feed() {
  local channel_id="$1"
  python3 - "$channel_id" "$RANGE_START_DATE" "$RANGE_END_DATE" "$USER_AGENT" <<'PY'
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

channel_id = sys.argv[1]
start_date = datetime.strptime(sys.argv[2], '%Y%m%d').date()
end_date = datetime.strptime(sys.argv[3], '%Y%m%d').date()
user_agent = sys.argv[4]
feed_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}'

request = urllib.request.Request(
    feed_url,
    headers={
        'User-Agent': user_agent,
        'Accept': 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
    },
)

try:
    with urllib.request.urlopen(request, timeout=20) as response:
        xml_data = response.read()
except Exception as exc:
    print(f'ERROR\t{exc}')
    sys.exit(2)

root = ET.fromstring(xml_data)
namespace = {'atom': 'http://www.w3.org/2005/Atom'}
video_count = 0
short_count = 0

for entry in root.findall('atom:entry', namespace):
    published = entry.findtext('atom:published', default='', namespaces=namespace)
    if not published:
        continue
    if published.endswith('Z'):
        published = published[:-1] + '+00:00'
    try:
        published_dt = datetime.fromisoformat(published)
    except ValueError:
        continue

    published_date = published_dt.astimezone().date()
    if not (start_date <= published_date <= end_date):
        continue

    link = ''
    for link_node in entry.findall('atom:link', namespace):
        href = link_node.attrib.get('href', '').strip()
        if href:
            link = href
            break

    if '/shorts/' in link:
        short_count += 1
    else:
        video_count += 1

print(f'{video_count}\t{short_count}')
PY
}

mapfile -t YT_CHANNEL_SPECS < <(
  grep -Ev '^[[:space:]]*($|#)' "$CHANNELS_FILE"
)

if [[ "$EMIT_SPECS_ONLY" != "1" ]]; then
  printf 'Canali YouTube con video nel range %s -> %s\n' "$START_HUMAN" "$END_HUMAN"
  printf 'Scansiono la lista canali, risolvo il channel_id ogni volta e conto i video tramite feed RSS.\n'
fi

RESULTS_FILE="$(mktemp)"
trap 'rm -f "$RESULTS_FILE"' EXIT

matched_channels=0
total_recent_videos=0
total_recent_shorts=0
channel_index=0
total_channels="${#YT_CHANNEL_SPECS[@]}"

while IFS= read -r url; do
  [ -n "${url:-}" ] || continue
  case "$url" in
    \#*) continue ;;
  esac

  channel_index=$((channel_index + 1))
  channel_label="${url##*/}"
  channel_label="${channel_label#@}"

  if [[ "$EMIT_SPECS_ONLY" != "1" ]]; then
    printf '[%s/%s] Risolvo channel_id per @%s...\n' "$channel_index" "$total_channels" "$channel_label"
  fi
  channel_id_output="$(resolve_channel_id "$url")" || true
  if [[ "$channel_id_output" == ERROR$'\t'* ]]; then
    echo "ATTENZIONE: non sono riuscito a trovare il channel_id di @${channel_label} (${url})" >&2
    printf '  dettaglio: %s\n' "${channel_id_output#ERROR$'\t'}" >&2
    continue
  fi
  if [[ -z "$channel_id_output" ]]; then
    echo "ATTENZIONE: non sono riuscito a trovare il channel_id di @${channel_label} (${url}) — nessun output dal resolver" >&2
    continue
  fi

  channel_id="$channel_id_output"
  if [[ "$EMIT_SPECS_ONLY" != "1" ]]; then
    printf '[%s/%s] channel_id: %s\n' "$channel_index" "$total_channels" "$channel_id"
    printf '[%s/%s] Leggo feed RSS e conto i video nel range...\n' "$channel_index" "$total_channels"
  fi

  feed_count_output="$(count_recent_items_from_feed "$channel_id")" || true
  if [[ "$feed_count_output" == ERROR$'\t'* ]]; then
    echo "ATTENZIONE: impossibile leggere il feed RSS per ${url}" >&2
    printf '  %s\n' "${feed_count_output#ERROR$'\t'}" >&2
    continue
  fi

  IFS=$'\t' read -r recent_videos recent_shorts <<< "$feed_count_output"
  recent_videos="${recent_videos:-0}"
  recent_shorts="${recent_shorts:-0}"
  if [[ "$EMIT_SPECS_ONLY" != "1" ]]; then
    printf '[%s/%s] @%s -> %s video, %s shorts nel range\n' "$channel_index" "$total_channels" "$channel_label" "$recent_videos" "$recent_shorts"
  fi

  if [ "$recent_videos" -gt 0 ] || [ "$recent_shorts" -gt 0 ]; then
    matched_channels=$((matched_channels + 1))
    total_recent_videos=$((total_recent_videos + recent_videos))
    total_recent_shorts=$((total_recent_shorts + recent_shorts))
    printf '%s\t%s\t%s\n' "@${channel_label}" "$recent_videos" "$recent_shorts" >> "$RESULTS_FILE"
    if [[ "$EMIT_SPECS_ONLY" == "1" && "$recent_videos" -gt 0 ]]; then
      playlist_depth="$recent_videos"
      if [ "$playlist_depth" -eq 15 ]; then
        playlist_depth=50
      fi
      printf '%s|%s\n' "$playlist_depth" "$url"
    fi
  fi
done < <(printf '%s\n' "${YT_CHANNEL_SPECS[@]}")

if [[ "$EMIT_SPECS_ONLY" == "1" ]]; then
  exit 0
fi

printf '\nReport finale ordinato per numero di video pubblicati nel range:\n'
printf '%-28s %8s %8s\n' 'Canale' 'video' 'shorts'
printf '%-28s %8s %8s\n' '------' '-----' '------'

if [ -s "$RESULTS_FILE" ]; then
  sort -t $'\t' -k2,2nr -k3,3nr -k1,1 "$RESULTS_FILE" | while IFS=$'\t' read -r channel_name video_count short_count; do
    printf '%-28s %8s %8s\n' "$channel_name" "$video_count" "$short_count"
  done
else
  printf 'Nessun canale ha pubblicato video nel range richiesto.\n'
fi

printf '\nTotale canali con video recenti: %s\n' "$matched_channels"
printf 'Totale video recenti trovati: %s\n' "$total_recent_videos"
printf 'Totale shorts recenti trovati: %s\n' "$total_recent_shorts"