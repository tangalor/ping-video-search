#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_ROOT="backup"
BACKUP_GREZZI_DIR="$BACKUP_ROOT/dati_grezzi_$TIMESTAMP"
BACKUP_PULITE_DIR="$BACKUP_ROOT/letture_pulite_$TIMESTAMP"

mkdir -p "$BACKUP_ROOT" "dati_grezzi" "letture_pulite"

echo "[1/4] Backup cartelle..."
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

echo "[2/4] Svuoto cartelle dati_grezzi e letture_pulite..."
find dati_grezzi -mindepth 1 -delete
find letture_pulite -mindepth 1 -delete

echo "[3/4] Raccolta dati con yt-dlp..."
yt-dlp --playlist-end 25 --ignore-errors --no-download --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@pingpongstyles"
yt-dlp --playlist-end 40 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@Fitetofficial"
yt-dlp --playlist-end 50 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@wttglobal"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@MilanoSportTT"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@YouPongOfficial"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@tabletennis69"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@GiacomoCerea"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@FilippoCantellaTT"
yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@mitsutabletennis"

yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@Top8TT"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TableSkills"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@LucaLaNotteTTplayer"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TableTennisDaily"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@tabletennisindependent3737"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TTtrix"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@BeyondThePodiumOfficial"
yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@giacomoizzo2007"


echo "[4/5] Elaborazione dati con ytp.py..."
python3 ytp.py

echo "[5/5] Generazione script SQL upsert da CSV (best effort)..."
# Mantiene solo l'artefatto SQL upsert attuale.
rm -f output_insert_new_only.sql
python3 csv_to_supabase_upsert_sql.py

echo "Completato."
