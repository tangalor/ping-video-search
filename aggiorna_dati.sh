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

mkdir -p "$BACKUP_ROOT" "dati_grezzi" "letture_pulite"

run_yt() {
  if ! "$@"; then
    echo " - ATTENZIONE: comando fallito, continuo comunque:" >&2
    echo "   $*" >&2
  fi
}

echo "[1/6] Backup cartelle..."
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
find dati_grezzi -mindepth 1 -delete
find letture_pulite -mindepth 1 -delete

echo "[3/6] Raccolta dati con yt-dlp..."
run_yt yt-dlp --playlist-end 25 --ignore-errors --no-download --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@pingpongstyles"
run_yt yt-dlp --playlist-end 40 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@Fitetofficial"
run_yt yt-dlp --playlist-end 50 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@wttglobal"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@MilanoSportTT"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@YouPongOfficial"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@tabletennis69"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@GiacomoCerea"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@FilippoCantellaTT"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@mitsutabletennis"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@Top8TT"
run_yt yt-dlp --playlist-end 20 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TableSkills"
run_yt yt-dlp --playlist-end 10 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@LucaLaNotteTTplayer"
run_yt yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TableTennisDaily"
run_yt yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@tabletennisindependent3737"
run_yt yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@TTtrix"
run_yt yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@BeyondThePodiumOfficial"
run_yt yt-dlp --playlist-end 1000 --ignore-errors --no-download -t sleep --write-info-json --output "dati_grezzi/%(id)s" "https://www.youtube.com/@giacomoizzo2007"

#da rifare
#TableTennisDaily e tttrix e seguenti

#Grazie mille a questi canali YouTube:
#ttlondon2012, ping-pong, ro-ning team RNG, GECA, lasha margveshvili, 
#www.bokett.com, MtTheportal, ttstars, ttPoster, ttImposible, PavelTableTennis, MaLongFanMadeChannel, TableTennisEvents


echo "[4/6] Elaborazione dati con ytp.py..."
python3 ytp.py

echo "[5/6] Generazione script SQL upsert da CSV (best effort)..."
# Mantiene solo l'artefatto SQL upsert attuale.
#rm -f output_insert_new_only.sql
python3 csv_to_supabase_upsert_sql.py

echo "[6/6] Validazione caratteri SQL + creazione chunk per Supabase..."
python3 split_upsert_sql_chunks.py --input "$SQL_SOURCE_FILE" --out-dir "$SQL_CHUNK_DIR" --chunk-size "$SQL_CHUNK_SIZE"

echo "Completato."
