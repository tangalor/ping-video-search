#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_COOKIE_FILE="$PWD/cookies.txt"
SECRET_KEY_NAME="YTDLP_COOKIES_B64"
SECRET_MAX_CHARS=65000

usage() {
  cat <<'EOF'
Uso:
  ./scripts/genera_cookie_secret.sh [percorso_cookies.txt]

Esempi:
  ./scripts/genera_cookie_secret.sh
  ./scripts/genera_cookie_secret.sh ~/Downloads/cookies.txt

Output:
  Stampa a video il valore base64 da incollare nel secret GitHub:
  YTDLP_COOKIES_B64
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

COOKIE_FILE="${1:-$DEFAULT_COOKIE_FILE}"

if ! command -v base64 >/dev/null 2>&1; then
  echo "Errore: comando base64 non trovato nel PATH." >&2
  exit 1
fi

if [[ ! -f "$COOKIE_FILE" ]]; then
  echo "Errore: file cookie non trovato: $COOKIE_FILE" >&2
  exit 1
fi

if [[ ! -s "$COOKIE_FILE" ]]; then
  echo "Errore: file cookie vuoto: $COOKIE_FILE" >&2
  exit 1
fi

if ! grep -qi "youtube" "$COOKIE_FILE"; then
  echo "Attenzione: nel file non vedo riferimenti a YouTube. Controlla di aver esportato il file corretto." >&2
fi

FILTERED_COOKIE_FILE="$(mktemp)"
trap 'rm -f "$FILTERED_COOKIE_FILE"' EXIT

# Keep Netscape header/comments and only domains useful for yt-dlp on YouTube.
awk '
  /^#/ { print; next }
  NF < 7 { next }
  {
    domain = $1
    if (domain ~ /(youtube\\.com|google\\.com|googlevideo\\.com|ytimg\\.com)$/) {
      print
    }
  }
' "$COOKIE_FILE" > "$FILTERED_COOKIE_FILE"

FILTERED_LINES="$(grep -vc '^#' "$FILTERED_COOKIE_FILE" || true)"
if [[ "$FILTERED_LINES" -le 0 ]]; then
  # Fallback: accept any line containing target domains, regardless of exact export layout.
  grep -Ei '(^#)|youtube\.com|google\.com|googlevideo\.com|ytimg\.com' "$COOKIE_FILE" > "$FILTERED_COOKIE_FILE" || true
  FILTERED_LINES="$(grep -vc '^#' "$FILTERED_COOKIE_FILE" || true)"
fi

if [[ "$FILTERED_LINES" -le 0 ]]; then
  echo "Attenzione: nessun cookie dominio YouTube rilevato con i filtri automatici." >&2
  echo "Procedo usando il file originale senza filtro per evitare blocchi inutili." >&2
  cp "$COOKIE_FILE" "$FILTERED_COOKIE_FILE"
  FILTERED_LINES="$(grep -vc '^#' "$FILTERED_COOKIE_FILE" || true)"
fi

B64_VALUE="$(base64 < "$FILTERED_COOKIE_FILE" | tr -d '\n')"

if [[ -z "$B64_VALUE" ]]; then
  echo "Errore: valore base64 vuoto. Controlla il file cookie." >&2
  exit 1
fi

echo ""
echo "Chiave secret: $SECRET_KEY_NAME"
echo "Valore pronto da incollare:"
echo ""
echo "$B64_VALUE"
echo ""
echo "Cookie utili inclusi: $FILTERED_LINES"
echo "Lunghezza valore: ${#B64_VALUE} caratteri"

if [[ "${#B64_VALUE}" -ge "$SECRET_MAX_CHARS" ]]; then
  echo ""
  echo "ATTENZIONE: il valore e molto lungo e potrebbe superare il limite GitHub Secrets." >&2
  echo "Riesporta i cookie e riduci i domini non necessari, poi rigenera il valore." >&2
fi

if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$B64_VALUE" | pbcopy
  echo "Copiato anche negli appunti (pbcopy)."
fi

echo ""
echo "Suggerimento: non committare cookies.txt o questo valore nel repository."
