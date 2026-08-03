#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DAYS=1
USER_AGENT="${USER_AGENT:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36}"

YT_CHANNEL_SPECS=(
  "https://www.youtube.com/@pingpongstyles"
  "https://www.youtube.com/@Fitetofficial"
  "https://www.youtube.com/@wttglobal"
  "https://www.youtube.com/@ettutvofficial"
  "https://www.youtube.com/@Learn_TableTennis"
  "https://www.youtube.com/@MilanoSportTT"
  "https://www.youtube.com/@tt-topspinmessina7289"
  "https://www.youtube.com/@tennistavolosassari3889"
  "https://www.youtube.com/@tennistavolovigevano"
  "https://www.youtube.com/@ttnulvi"
  "https://www.youtube.com/@muraveratennistavolo8062"
  "https://www.youtube.com/@ASDNewTTPieveEmanuele"
  "https://www.youtube.com/@videotttorino8111"
  "https://www.youtube.com/@tennistavolocastelgoffredo3697"
  "https://www.youtube.com/@YouPongOfficial"
  "https://www.youtube.com/@tabletennis69"
  "https://www.youtube.com/@GiacomoCerea"
  "https://www.youtube.com/@FilippoCantellaTT"
  "https://www.youtube.com/@mitsutabletennis"
  "https://www.youtube.com/@Top8TT"
  "https://www.youtube.com/@TableSkills"
  "https://www.youtube.com/@LucaLaNotteTTplayer"
  "https://www.youtube.com/@Simoneleotta0"
  "https://www.youtube.com/@TableTennisDaily"
  "https://www.youtube.com/@tabletennisindependent3737"
  "https://www.youtube.com/@TTtrix"
  "https://www.youtube.com/@BeyondThePodiumOfficial"
  "https://www.youtube.com/@giacomoizzo2007"
  "https://www.youtube.com/@ZeroNet-TTCARTURA"
  "https://www.youtube.com/@Dr.PsyPong"
  "https://www.youtube.com/@ITTFWorld"
  "https://www.youtube.com/@TableTennisEngland"
  "https://www.youtube.com/@AndreasLevenko"
  "https://www.youtube.com/@tabletennisdailyplus"
  "https://www.youtube.com/@TableTennisDailyCast"
  "https://www.youtube.com/@PongFoxTabletennis"
  "https://www.youtube.com/@World.Table.Tennis"
  "https://www.youtube.com/@SpinClips"
  "https://www.youtube.com/@ttlondon2012"
  "https://www.youtube.com/@MagnusEffectTT"
  "https://www.youtube.com/@DiegoTTTube"
  "https://www.youtube.com/@ttjapan3023"
  "https://www.youtube.com/@perdagermo734"
  "https://www.youtube.com/@GecaPhoenix"
  "https://www.youtube.com/@GecaPhoenix2"
  "https://www.youtube.com/@ttstars"
  "https://www.youtube.com/@TTSTARSERIES"
  "https://www.youtube.com/@TTCrazyShot"
  "https://www.youtube.com/@OlavKTTT"
  "https://www.youtube.com/@pingponggoris"
  "https://www.youtube.com/@VideoTTMondovi"
  "https://www.youtube.com/@pierluigiloi9961"
  "https://www.youtube.com/@TtblDe"
  "https://www.youtube.com/@AugustinePingPong"
  "https://www.youtube.com/@samuel_piatanesi"
  "https://www.youtube.com/@ChulongNieTableTennis"
  "https://www.youtube.com/@conhuang0"
)

usage() {
  cat <<'EOF'
Uso: ./scripts/report_youtube_recent_channels.sh [opzioni]

Opzioni:
  --days N             Intervallo giorni: 0=today, 1=ieri+oggi, 2=2 giorni+oggi, ...
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

printf 'Canali YouTube con video nel range %s -> %s\n' "$START_HUMAN" "$END_HUMAN"
printf 'Scansiono la lista canali, risolvo il channel_id ogni volta e conto i video tramite feed RSS.\n'

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

  printf '[%s/%s] Risolvo channel_id per @%s...\n' "$channel_index" "$total_channels" "$channel_label"
  channel_id_output="$(resolve_channel_id "$url")"
  if [[ "$channel_id_output" == ERROR$'\t'* ]]; then
    echo "ATTENZIONE: impossibile risolvere channel_id per ${url}" >&2
    printf '  %s\n' "${channel_id_output#ERROR$'\t'}" >&2
    continue
  fi

  channel_id="$channel_id_output"
  printf '[%s/%s] channel_id: %s\n' "$channel_index" "$total_channels" "$channel_id"
  printf '[%s/%s] Leggo feed RSS e conto i video nel range...\n' "$channel_index" "$total_channels"

  feed_count_output="$(count_recent_items_from_feed "$channel_id")"
  if [[ "$feed_count_output" == ERROR$'\t'* ]]; then
    echo "ATTENZIONE: impossibile leggere il feed RSS per ${url}" >&2
    printf '  %s\n' "${feed_count_output#ERROR$'\t'}" >&2
    continue
  fi

  IFS=$'\t' read -r recent_videos recent_shorts <<< "$feed_count_output"
  recent_videos="${recent_videos:-0}"
  recent_shorts="${recent_shorts:-0}"
  printf '[%s/%s] @%s -> %s video, %s shorts nel range\n' "$channel_index" "$total_channels" "$channel_label" "$recent_videos" "$recent_shorts"

  if [ "$recent_videos" -gt 0 ] || [ "$recent_shorts" -gt 0 ]; then
    matched_channels=$((matched_channels + 1))
    total_recent_videos=$((total_recent_videos + recent_videos))
    total_recent_shorts=$((total_recent_shorts + recent_shorts))
    printf '%s\t%s\t%s\n' "@${channel_label}" "$recent_videos" "$recent_shorts" >> "$RESULTS_FILE"
  fi
done < <(printf '%s\n' "${YT_CHANNEL_SPECS[@]}")

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