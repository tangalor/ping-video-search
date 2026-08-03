# PingTV Project

Repository per raccolta, normalizzazione e pubblicazione dati video (YouTube ping pong) con frontend di ricerca e pipeline automatizzata.

## Quick Start

1. Configura le variabili in `.env` (puoi partire da `.env.example`).
1. Esegui la pipeline completa:

```bash
bash scripts/aggiorna_dati.sh
```

1. Avvia la SPA in locale:

```bash
python3 scripts/serve_spa.py --port 5501
```

## Panoramica

Il progetto ha due aree principali:

1. **Data pipeline**: scarica metadati YouTube, traduce/normalizza, genera SQL, applica UPSERT su Supabase.
2. **Frontend SPA**: interfaccia HTML/CSS/JS per filtrare e cercare i video pubblicati.

## Struttura repository

- `scripts/`
  - Tutti gli script `.sh` e `.py`.
  - Vedi documentazione dettagliata in `scripts/README.md`.

- `dati_grezzi/`
  - JSON originali prodotti da `yt-dlp`.

- `letture_pulite/`
  - JSON trasformati e arricchiti.

- `backup/`
  - Backup timestampati delle cartelle dati.

- `logs/`
  - Log esecuzioni pipeline.

- `output.csv`
  - Dataset finale tabellare usato per generazione SQL.

- `output_upsert_from_csv.sql`
  - SQL UPSERT completo.

- `output_upsert_chunks/`
  - SQL diviso in chunk (`output_upsert_from_csv_part_*.sql`).

- `index.html`, `styles.css`, `script.js`
  - Frontend della web app.

- `config.local.js`
  - Config locale frontend (non mettere segreti qui).

- `.env`, `.env.example`
  - Config runtime per script.

- `.github/workflows/aggiorna-dati.yml`
  - Pipeline GitHub Actions.

## Flusso dati end-to-end

```mermaid
flowchart TD
  A[YouTube channels] --> B[scripts/aggiorna_dati.sh]
  B --> C[dati_grezzi/*.info.json]
  C --> D[scripts/ytp.py]
  D --> E[letture_pulite/*.json]
  E --> F[output.csv]
  F --> G[scripts/csv_to_supabase_upsert_sql.py]
  G --> H[output_upsert_from_csv.sql]
  H --> I[scripts/split_upsert_sql_chunks.py]
  I --> J[output_upsert_chunks/*.sql]
  J --> K[scripts/esegui_upsert_chunks_psql.sh]
  K --> L[(Supabase ping-video)]
```

## Esecuzione locale

Pipeline completa:

```bash
bash scripts/aggiorna_dati.sh
```

Pipeline completa con finestra custom per i canali recenti:

```bash
YT_CHANNEL_REPORT_DAYS=5 bash scripts/aggiorna_dati.sh
```

Pipeline completa con lista custom nel vecchio formato `numero|url`:

```bash
YT_CHANNEL_SPECS_FILE=scripts/youtube_channel_specs.custom.example.txt bash scripts/aggiorna_dati.sh
```

Pipeline completa con file custom fisso (senza specificare path):

```bash
bash scripts/aggiorna_dati.sh --use-custom-channel-specs
```

Saltando download (da step 4):

```bash
bash scripts/aggiorna_dati.sh --skip-download
```

### Selezione canali (locale)

La pipeline supporta due modalita per costruire `YT_CHANNEL_SPECS`:

- **Modalita report RSS (default)**
  - lancia `scripts/report_youtube_recent_channels.sh`
  - usa `scripts/youtube_channels.txt` come sorgente URL (o `YT_CHANNELS_FILE` se impostata)
  - include solo i canali con `video > 0` nella finestra `YT_CHANNEL_REPORT_DAYS` (default `3`)
  - quando genera le righe `numero|url` per la pipeline, applica la regola: se `numero == 15` allora usa `50`; per gli altri valori usa il numero calcolato
  - stampa sempre a terminale l'elenco finale `numero|url` dei canali selezionati prima del download

- **Modalita custom fissa**
  - con `--use-custom-channel-specs` usa automaticamente `scripts/youtube_channel_specs.custom.example.txt`
  - utile per prime scansioni complete in formato legacy `numero|url`

Precedenza locale:

- se passi `--use-custom-channel-specs`, viene forzato il file custom fisso
- se non passi il flag, resta il comportamento default RSS
- in alternativa al flag, puoi ancora impostare manualmente `YT_CHANNEL_SPECS_FILE=/path/file`

Server locale SPA:

```bash
python3 scripts/serve_spa.py --port 5501
```

## CI/CD con GitHub Actions

Workflow: `.github/workflows/aggiorna-dati.yml`

Trigger supportati:

- `workflow_dispatch` (manuale)
- `schedule` (cron)

Input utili nel trigger manuale:

- `skip_download`
- `channel_report_days`
- `use_custom_channel_specs`

Comportamento:

- se `use_custom_channel_specs` e `false`, la pipeline genera la lista canali dal report RSS usando `channel_report_days`
- se `use_custom_channel_specs` e `true`, usa automaticamente `scripts/youtube_channel_specs.custom.example.txt` nel formato `numero|url` per una scansione custom completa
- in entrambi i casi, prima del download viene stampato a log/console l'elenco effettivo `numero|url` usato dalla pipeline

Note operative CI:

- il checkbox `use_custom_channel_specs` e l'equivalente CI del flag locale `--use-custom-channel-specs`
- se il checkbox e `false`, `channel_report_days` e attivo
- se il checkbox e `true`, `channel_report_days` viene ignorato per la selezione canali
- nei run schedulati (`schedule`) il checkbox non e impostabile e si usa il comportamento di default (report RSS)

Artifact caricati a fine run:

- Log (`logs/`)
- Output SQL (`output_upsert_from_csv.sql` + `output_upsert_chunks/`)

## Secrets GitHub richiesti

- `SUPABASE_DB_URL` (obbligatorio)
- `SUPABASE_URL` (consigliato)
- `SUPABASE_SERVICE_ROLE_KEY` (consigliato)

Note:

- I secrets non devono essere committati.
- Usa sempre branch protetti e accessi limitati al repository.

## Dipendenze

Sistema:

- `bash`
- `python3`
- `yt-dlp`
- `psql`

Python package:

- `langdetect`
- `deep-translator`

## File utili

- `appunti.txt`
  - note operative/manuali.

- `scripts/youtube_channels.txt`
  - lista statica condivisa dei canali YouTube usata come default dal report RSS.

- `scripts/youtube_channel_specs.custom.example.txt`
  - esempio di lista custom nel vecchio formato `numero|url` per prime scansioni complete di canali.

- `atleti_italiani.txt`
- `atleti_italiani_invertiti.txt`
  - liste di supporto per riconoscimento atleti in `ytp.py`.
