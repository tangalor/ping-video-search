# Scripts

Questa cartella contiene tutti gli script shell e Python del progetto.

## Script principali

- `aggiorna_dati.sh`
  - Orchestratore completo della pipeline dati.
  - Flusso:
    1. Backup cartelle dati (`backup/...`)
    2. Pulizia `dati_grezzi/` e `letture_pulite/`
    3. Download metadati YouTube con `yt-dlp`
    4. Trasformazione/traduzione con `ytp.py`
    5. Generazione SQL con `csv_to_supabase_upsert_sql.py`
    6. Split SQL in chunk con `split_upsert_sql_chunks.py`
    7. Esecuzione chunk con `esegui_upsert_chunks_psql.sh`
  - Invia anche una mail di fine esecuzione usando il log terminale (se `mail`/`sendmail` sono disponibili).

- `esegui_upsert_chunks_psql.sh`
  - Esegue i file in `output_upsert_chunks/output_upsert_from_csv_part_*.sql`.
  - Usa `SUPABASE_DB_URL` da `.env`.

- `schedule_job.sh`
  - Configura wake-up Mac + cron per avvio giornaliero della pipeline.

## Script Python

- `ytp.py`
  - Legge i JSON da `dati_grezzi/`, traduce e normalizza campi, rileva atleti, genera JSON puliti in `letture_pulite/` e `output.csv`.

- `csv_to_supabase_upsert_sql.py`
  - Converte `output.csv` in `output_upsert_from_csv.sql` (UPSERT su tabella `ping-video`).

- `split_upsert_sql_chunks.py`
  - Divide il file SQL monolitico in chunk per esecuzione piu robusta.

- `supabase_upsert_csv.py`
  - Alternativa via REST per inviare `output.csv` a Supabase in batch.

- `live_watcher.py`
  - Monitor live YouTube (utility separata dalla pipeline principale).

- `serve_spa.py`
  - Server locale semplice per test della SPA.

## Esecuzione rapida

Dalla root del progetto:

```bash
bash scripts/aggiorna_dati.sh
```

Solo da step 4 in poi:

```bash
bash scripts/aggiorna_dati.sh --skip-download
```

Solo applicazione SQL chunk:

```bash
bash scripts/esegui_upsert_chunks_psql.sh
```

## Prerequisiti

- `bash`
- `python3`
- `yt-dlp`
- `psql` (PostgreSQL client)
- package Python:
  - `langdetect`
  - `deep-translator`

## Configurazione `.env`

Variabili usate dagli script:

- `SUPABASE_DB_URL` (obbligatoria per `psql`)
- `SUPABASE_URL` (usata da script REST)
- `SUPABASE_SERVICE_ROLE_KEY` (usata da script REST)
- `SUPABASE_API_KEY` (fallback opzionale per script REST)

## Output principali

- `logs/`
  - log verbosi e log terminale per run
- `output.csv`
- `output_upsert_from_csv.sql`
- `output_upsert_chunks/`
- `backup/` (snapshot timestampati)
