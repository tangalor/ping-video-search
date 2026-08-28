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
  - Modalita canali supportate:
    - default: genera `YT_CHANNEL_SPECS` dal report RSS usando solo la colonna `video`.
    - custom: se imposti `YT_CHANNEL_SPECS_FILE`, usa un file nel formato `numero|url`.
    - custom (rapida): con `--use-custom-channel-specs` usa automaticamente `scripts/youtube_channel_specs.custom.example.txt`.
  - Prima del download stampa sempre a console (e nel log verboso) l'elenco finale `numero|url` dei canali selezionati.
  - Regole di precedenza:
    - con `--use-custom-channel-specs` viene forzato il file custom fisso;
    - senza flag, se `YT_CHANNEL_SPECS_FILE` e impostata usa quel file;
    - altrimenti usa il report RSS (`YT_CHANNEL_REPORT_DAYS`, default `3`).
  - Variabili utili:
    - `YT_CHANNEL_REPORT_DAYS` default `3`
    - `YT_CHANNELS_FILE` default `scripts/youtube_channels.txt`
    - `YT_CHANNEL_SPECS_FILE` opzionale per liste custom complete

- `report_youtube_recent_channels.sh`
  - Legge la lista canali da `scripts/youtube_channels.txt` (o da `--channels-file`) e usa i feed RSS YouTube per contare i contenuti recenti.
  - Distingue `video` e `shorts` in base alla URL dell'entry del feed.
  - Opzioni utili:
    - `--days N` per impostare la finestra temporale.
    - `--channels-file FILE` per cambiare lista canali sorgente.
    - `--emit-specs` per produrre solo righe `numero|url`, usate da `aggiorna_dati.sh`.
  - Regola su `--emit-specs`: se il numero video calcolato e `15`, emette `50|url` per approfondire la scansione; per gli altri valori emette il numero calcolato.

- `youtube_channels.txt`
  - Lista statica condivisa dei canali YouTube di default.

- `youtube_channel_specs.custom.example.txt`
  - Esempio di file custom nel formato `numero|url` per prime scansioni complete.
  - In CI viene usato automaticamente quando `use_custom_channel_specs=true`.

- `.github/workflows/aggiorna-dati.yml`
  - In `workflow_dispatch` espone:
    - `use_custom_channel_specs` (checkbox): usa il file custom fisso.
    - `channel_report_days`: usato solo quando il checkbox e disattivato.

- `esegui_upsert_chunks_psql.sh`
  - Esegue i file in `output_upsert_chunks/output_upsert_from_csv_part_*.sql`.
  - Usa `SUPABASE_DB_URL` da `.env`.

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

Usando il report RSS sugli ultimi 5 giorni:

```bash
YT_CHANNEL_REPORT_DAYS=5 bash scripts/aggiorna_dati.sh
```

Usando una lista custom `numero|url`:

```bash
YT_CHANNEL_SPECS_FILE=scripts/youtube_channel_specs.custom.example.txt bash scripts/aggiorna_dati.sh
```

Usando il file custom fisso senza specificare path:

```bash
bash scripts/aggiorna_dati.sh --use-custom-channel-specs
```

Solo report RSS con tabella finale:

```bash
bash scripts/report_youtube_recent_channels.sh --days 3
```

Solo generazione della lista `numero|url` per la pipeline dati:

```bash
bash scripts/report_youtube_recent_channels.sh --days 3 --emit-specs
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
