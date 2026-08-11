#!/usr/bin/env bash
set -euo pipefail

# scripts/check_youtube_feeds.sh
# Quick diagnostic script: for each channel input (file or single), resolve channel_id and check the official feed.
# Usage: ./scripts/check_youtube_feeds.sh [channels_file]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHANNELS_FILE="${1:-$SCRIPT_DIR/youtube_channels.txt}"
USER_AGENT="${USER_AGENT:-Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36}"

if [[ ! -f "$CHANNELS_FILE" ]]; then
  echo "File canali non trovato: $CHANNELS_FILE" >&2
  exit 2
fi

any_alert=0

resolve_channel_id() {
  local input="$1"
  python3 - "$input" "$USER_AGENT" <<'PY'
import re, sys, urllib.request
in_val = sys.argv[1].strip()
user_agent = sys.argv[2]
# direct UC
m = re.match(r'^(UC[0-9A-Za-z_-]{20,})$', in_val)
if m:
    print(m.group(1)); sys.exit(0)
# candidates
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
    except Exception:
        continue
    for p in patterns:
        mm = re.search(p, html)
        if mm:
            print(mm.group(1)); sys.exit(0)
m = re.search(r'(UC[0-9A-Za-z_-]{20,})', in_val)
if m:
    print(m.group(1)); sys.exit(0)
# nothing found => print empty
sys.exit(0)
PY
}

check_feed() {
  local cid="$1"
  python3 - "$cid" <<'PY'
import sys, urllib.request, urllib.error, xml.etree.ElementTree as ET
cid = sys.argv[1]
if not cid:
    print('ERROR\tno-channel-id')
    sys.exit(2)
feed_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}'
req = urllib.request.Request(feed_url, headers={'User-Agent': '"$USER_AGENT"'.strip('"')})
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        data = r.read()
        code = r.getcode()
except urllib.error.HTTPError as e:
    print(f'ERROR\tHTTP {e.code} {feed_url}')
    sys.exit(2)
except Exception as e:
    print(f'ERROR\t{e} {feed_url}')
    sys.exit(2)
try:
    root = ET.fromstring(data)
except Exception as e:
    print(f'ERROR\tXML parse error: {e} {feed_url}')
    sys.exit(2)
entries = root.findall('{http://www.w3.org/2005/Atom}entry')
print(f'OK\tfeed_http={code}\tentries={len(entries)}\t{feed_url}')
PY
}

printf 'Starting check of channels in %s\n' "$CHANNELS_FILE"
while IFS= read -r line || [[ -n "$line" ]]; do
  [ -n "${line:-}" ] || continue
  case "$line" in
    \#*) continue ;;
  esac
  input="$line"
  printf 'Checking: %s\n' "$input"
  cid=$(resolve_channel_id "$input" )
  if [[ -z "$cid" ]]; then
    alert_msg="Impossibile risolvere channel_id per: $input"
    printf 'ALERT\t%s\n' "$alert_msg"
    any_alert=1
    continue
  fi
  printf 'Resolved channel_id: %s\n' "$cid"
  out=$(check_feed "$cid" ) || true
  if [[ "$out" == ERROR* ]]; then
    printf 'ALERT\t%s -> %s\n' "$input" "$out"
    any_alert=1
  else
    printf '%s\n' "$out"
  fi
done < <(grep -Ev '^[[:space:]]*($|#)' "$CHANNELS_FILE")

if [[ "$any_alert" -ne 0 ]]; then
  printf '\nOne or more ALERTs were detected.\n' >&2
  exit 3
fi

printf '\nAll checks OK.\n'
exit 0
