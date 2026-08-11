#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CHANNELS_INPUT_FILE="${1:-$SCRIPT_DIR/youtube_channels.txt}"
USER_AGENT="${USER_AGENT:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36}"
YT_API_KEY="${YT_API_KEY:-}"

if [[ ! -f "$CHANNELS_INPUT_FILE" ]]; then
  echo "File canali non trovato: $CHANNELS_INPUT_FILE" >&2
  exit 1
fi

# helper: alert to stderr with prefix
alert() {
  local msg="$*"
  printf 'ALERT: %s\n' "$msg" >&2
}

# resolve using same logic as report_youtube_recent_channels but return only id or empty
resolve_channel_id_quick() {
  local input="$1"
  python3 - "$input" "$USER_AGENT" <<'PY'
import re, sys, urllib.request, urllib.error

in_val = sys.argv[1].strip()
user_agent = sys.argv[2]

m = re.match(r'^(UC[0-9A-Za-z_-]{20,})$', in_val)
if m:
    print(m.group(1))
    sys.exit(0)

candidates = []
if in_val.startswith('http://') or in_val.startswith('https://'):
    base = in_val.rstrip('/')
    candidates = [base, base + '/videos', base + '/about']
else:
    if in_val.startswith('@'):
        candidates = [f'https://www.youtube.com/{in_val}', f'https://www.youtube.com/{in_val}/videos']
    else:
        candidates = [f'https://www.youtube.com/{in_val}', f'https://www.youtube.com/{in_val}/videos']

patterns = [r'"channelId":"(UC[0-9A-Za-z_-]+)"', r'"externalId":"(UC[0-9A-Za-z_-]+)"', r'"browseId":"(UC[0-9A-Za-z_-]+)"']

for candidate in candidates:
    try:
        req = urllib.request.Request(candidate, headers={'User-Agent': user_agent, 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'})
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8', errors='replace')
    except Exception as exc:
        continue
    for p in patterns:
        mm = re.search(p, html)
        if mm:
            print(mm.group(1))
            sys.exit(0)

m = re.search(r'(UC[0-9A-Za-z_-]{20,})', in_val)
if m:
    print(m.group(1))
    sys.exit(0)

# nothing
sys.exit(0)
PY
}

# fetch feed and validate
check_feed() {
  local channel_id="$1"
  python3 - "$channel_id" <<'PY'
import sys, urllib.request, urllib.error, xml.etree.ElementTree as ET
from datetime import datetime

channel_id = sys.argv[1]
feed_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}'
req = urllib.request.Request(feed_url, headers={'User-Agent': '