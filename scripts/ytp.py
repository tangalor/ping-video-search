import json
import os
import glob
import csv
import sys
import time
import datetime
import unicodedata
from langdetect import detect, DetectorFactory
from deep_translator import GoogleTranslator

# Evita che il rilevatore di lingua dia risultati diversi a ogni avvio
DetectorFactory.seed = 0

cartella_grezza = "dati_grezzi"
cartella_pulita = "letture_pulite"
os.makedirs(cartella_pulita, exist_ok=True)

# Il nostro database di atleti di riferimento per il controllo testuale
DIZIONARIO_ATLETI = [
    # --- LA TUA LISTA INIZIALE ---
    "Ma Long", "Timo Boll", "Fan Zhendong", "Wang Chuqin", "Tomokazu Harimoto",
    "Jan-Ove Waldner", "Jörgen Persson", "Jean-Michel Saive", "Hugo Calderano",
    "Truls Moregard", "Felix Lebrun", "Alexis Lebrun", "Sun Yingsha", "Chen Meng",

    # --- ALTRI TOP PLAYER INTERNAZIONALI (MASCHILI) ---
    "Lin Gaoyuan", "Liang Jingkun", "Xu Xin", "Zhang Jike", "Wang Liqin", # Leggende e big cinesi
    "Dimitrij Ovtcharov", "Patrick Franziska", "Dang Qiu", "Darko Jorgic", # Top europei
    "Lin Yun-Ju", "Jang Woojin", "Lim Jonghoon", "Shunsuke Togami", # Top asiatici (Taiwan/Corea/Giappone)
    "Simon Gauzy", "Marcos Freitas", "Liam Pitchford", "Jonathan Groth", # Altri europei di rilievo
    "Quadri Aruna", "Omar Assar", # Top Africa

    # --- TOP PLAYER INTERNAZIONALI (FEMMINILI) ---
    "Wang Manyu", "Wang Yidi", "Hina Hayata", "Mima Ito", "Miu Hirano",
    "Cheng I-Ching", "Shin Yubin", "Bernadette Szocs", "Sofia Polcanova",
    "Xiaona Shan", "Jia Nan Yuan", "Adriana Diaz", "Bruna Takahashi",

    # --- GIOCATORI TOP ITALIANI (MASCHILI - ATTUALI E STORICI) ---
    "Niagol Stoyanov", "Mihai Bobocica", "Matteo Mutti", "John Oyebode", # Nazionali attuali
    "Tommaso Giovannetti", "Andrea Puppo", "Carlo Rossi", "Federico Vallino Costassa", # Giovani promesse
    "Massimiliano Mondello", "Yang Min", "Francesco Lucesoli", "Valentino Piacentini", # Storici / Leggende italiane

    # --- GIOCATRICI TOP ITALIANE (FEMMINILI - ATTUALI E STORICHE) ---
    "Giorgia Piccolin", "Debora Vivarelli", "Nikoleta Stefanova", "Gaia Monfardini", # Nazionali e Olimpioniche
    "Nicole Arlia", "Miriam Carnovale", "Valentina Roncallo",
    "Alessia Turrini", "Laura Negrisoli", "Wang Yu" # Storiche / Pilastri del movimento
]

PERCORSO_ATLETI_EXTRA = "atleti_italiani.txt"
PERCORSO_ATLETI_EXTRA_INVERTITI = "atleti_italiani_invertiti.txt"
TRANSLATION_BAR_WIDTH = 34
TRANSLATION_PANEL_LINES = 2
translation_panel_rendered = False
last_non_tty_pct_reported = -1
translation_progress_stream = None
TRANSLATION_RETRIES = int(os.environ.get("TRANSLATION_RETRIES", "3"))
TRANSLATION_RETRY_DELAY = float(os.environ.get("TRANSLATION_RETRY_DELAY", "1.25"))
TRANSLATION_ERROR_LOG_LIMIT = int(os.environ.get("TRANSLATION_ERROR_LOG_LIMIT", "5"))
translation_error_count = 0
translation_error_log_count = 0

LIVE_STATUS_VALUES = {"is_live", "is_upcoming", "post_live", "was_live"}


def to_int_safe(value):
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def to_bool_safe(value):
    if isinstance(value, bool):
        return value
    if value is None or value == "":
        return False
    if isinstance(value, (int, float)):
        return value != 0

    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "t", "yes", "y"}


def to_iso8601_utc(value):
    timestamp = to_int_safe(value)
    if timestamp is None:
        return None

    return datetime.datetime.fromtimestamp(
        timestamp,
        tz=datetime.timezone.utc,
    ).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def is_live_content(grezzo):
    live_status = str(grezzo.get("live_status") or "").strip().lower()
    return (
        to_bool_safe(grezzo.get("is_live"))
        or to_bool_safe(grezzo.get("was_live"))
        or live_status in LIVE_STATUS_VALUES
    )


def is_short_content(grezzo):
    playlist_markers = [
        grezzo.get("playlist_webpage_url"),
        grezzo.get("playlist_title"),
        grezzo.get("playlist"),
    ]
    for candidate in playlist_markers:
        if "/shorts" in str(candidate or "").lower() or "shorts" in str(candidate or "").lower():
            return True

    url_candidates = [
        grezzo.get("webpage_url"),
        grezzo.get("original_url"),
        grezzo.get("url"),
    ]
    for candidate in url_candidates:
        if "/shorts/" in str(candidate or ""):
            return True

    return False


def derive_content_type(grezzo):
    if grezzo.get("_type") != "video":
        return None
    if is_live_content(grezzo):
        return "live"
    if is_short_content(grezzo):
        return "short"
    return "video"


def extract_live_metadata(grezzo):
    if not is_live_content(grezzo):
        return None

    keep_exact = {
        "availability",
        "channel_is_verified",
        "comment_count",
        "concurrent_view_count",
        "duration",
        "duration_string",
        "heatmap",
        "id",
        "is_live",
        "like_count",
        "live_status",
        "release_date",
        "release_timestamp",
        "timestamp",
        "title",
        "upload_date",
        "view_count",
        "was_live",
        "webpage_url",
    }

    metadata = {}
    for key, value in grezzo.items():
        if key in keep_exact or any(token in key for token in ("live", "release", "timestamp", "start", "end", "upload")):
            metadata[key] = value

    metadata["derived_live_started_at"] = to_iso8601_utc(grezzo.get("release_timestamp"))
    metadata["derived_live_published_at"] = to_iso8601_utc(grezzo.get("timestamp"))
    return metadata


def build_output_record(grezzo):
    content_type = derive_content_type(grezzo)
    if content_type is None:
        return None

    id_video = grezzo.get("id")
    if not id_video:
        return None

    titolo_originale = grezzo.get("title", "")
    descrizione_originale = grezzo.get("description", "")

    # Elaboriamo le lingue per titolo e descrizione
    titolo_it, titolo_en = gestisci_lingue(titolo_originale)
    descrizione_it, description_en = gestisci_lingue(descrizione_originale)

    # Estrazione atleti
    testo_per_atleti = f"{titolo_originale} {descrizione_originale}"
    atleti_rilevati = estrai_atleti(testo_per_atleti)

    live_metadata = extract_live_metadata(grezzo)
    is_live_row = content_type == "live"

    return {
        "id": id_video,
        "webpage_url": grezzo.get("webpage_url"),
        "upload_date": grezzo.get("upload_date"),
        "channel_id": grezzo.get("channel_id"),
        "channel": grezzo.get("channel"),
        "thumbnail": grezzo.get("thumbnail"),
        "view_count": grezzo.get("view_count", 0),
        "like_count": grezzo.get("like_count", 0),
        "duration": grezzo.get("duration", 0),
        "categories": grezzo.get("categories", []),
        "tags": grezzo.get("tags", []),
        "atleti": atleti_rilevati,
        "content_type": content_type,
        "is_short": content_type == "short",
        "is_live_now": to_bool_safe(grezzo.get("is_live")) if is_live_row else False,
        "was_live": to_bool_safe(grezzo.get("was_live")) if is_live_row else False,
        "live_status": grezzo.get("live_status") if is_live_row else None,
        "live_started_at": to_iso8601_utc(grezzo.get("release_timestamp")) if is_live_row else None,
        "live_published_at": to_iso8601_utc(grezzo.get("timestamp")) if is_live_row else None,
        "live_concurrent_view_count": to_int_safe(grezzo.get("concurrent_view_count")) if is_live_row else None,
        "live_metadata": live_metadata if is_live_row else None,

        # 🇮🇹 Campi in Italiano
        "title_it": titolo_it,
        "description_it": descrizione_it,

        # 🇬🇧 Campi in Inglese
        "title_en": titolo_en,
        "description_en": description_en,
    }


def carica_atleti_extra(percorso_file):
    """Carica nomi atleta da file testo (uno per riga), ignorando righe vuote."""
    if not os.path.exists(percorso_file):
        return []

    atleti = []
    with open(percorso_file, "r", encoding="utf-8") as f:
        for riga in f:
            nome = " ".join(riga.strip().split())
            if nome:
                atleti.append(nome)
    return atleti


# Unisce lista base + liste esterne (normale/invertita), mantenendo ordine e rimuovendo duplicati.
DIZIONARIO_ATLETI = list(dict.fromkeys(
    DIZIONARIO_ATLETI
    + carica_atleti_extra(PERCORSO_ATLETI_EXTRA)
    + carica_atleti_extra(PERCORSO_ATLETI_EXTRA_INVERTITI)
))


def estrai_atleti(testo):
    if not testo:
        return []

    atleti_trovati = []
    testo_normalizzato = normalizza_testo_per_confronto(testo)

    for atleta in DIZIONARIO_ATLETI:
        varianti = genera_varianti_nome_atleta(atleta)
        if any(variante in testo_normalizzato for variante in varianti) and atleta not in atleti_trovati:
            atleti_trovati.append(atleta)

    return atleti_trovati


def normalizza_testo_per_confronto(testo):
    testo_base = str(testo or "")
    testo_senza_accenti = "".join(
        c for c in unicodedata.normalize("NFD", testo_base)
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(testo_senza_accenti.lower().split())


def genera_varianti_nome_atleta(nome_atleta):
    """Ritorna nome originale normalizzato e variante invertita (nome cognome)."""
    originale = normalizza_testo_per_confronto(nome_atleta)
    if not originale:
        return []

    parole = originale.split()
    varianti = [originale]

    if len(parole) >= 2:
        invertito = " ".join([parole[-1], *parole[:-1]])
        if invertito not in varianti:
            varianti.append(invertito)

    return varianti


def progress_bar(current, total, width=TRANSLATION_BAR_WIDTH):
    total = max(1, int(total or 1))
    current = max(0, min(int(current or 0), total))
    filled = int(current * width / total)
    return "#" * filled + "-" * (width - filled)


def progress_pct(current, total):
    total = max(1, int(total or 1))
    current = max(0, min(int(current or 0), total))
    return int(current * 100 / total)


def trim_line(text, max_len=120):
    testo = str(text or "")
    if len(testo) <= max_len:
        return testo
    return f"{testo[:max_len - 3]}..."


def get_progress_stream():
    global translation_progress_stream

    if translation_progress_stream is not None:
        return translation_progress_stream

    if sys.stdout.isatty():
        translation_progress_stream = sys.stdout
        return translation_progress_stream

    try:
        tty_stream = open("/dev/tty", "w", encoding="utf-8", buffering=1)
        if tty_stream.isatty():
            translation_progress_stream = tty_stream
            return translation_progress_stream
    except OSError:
        pass

    translation_progress_stream = None
    return None


def render_translation_panel(current, total, video_id, status):
    global translation_panel_rendered
    global last_non_tty_pct_reported

    barra = progress_bar(current, total)
    pct = progress_pct(current, total)
    line1 = f"Traduzioni [{barra}] {pct:3d}% ({current}/{total})"
    line2 = f"Video: {trim_line(video_id, 40)} | Stato: {trim_line(status, 72)}"

    progress_stream = get_progress_stream()

    if progress_stream is not None:
        if translation_panel_rendered:
            progress_stream.write(f"\x1b[{TRANSLATION_PANEL_LINES}A")
        progress_stream.write(f"\r\x1b[2K{line1}\n")
        progress_stream.write(f"\r\x1b[2K{line2}\n")
        progress_stream.flush()
        translation_panel_rendered = True
    else:
        should_print = (
            current == 0
            or current == total
            or pct >= (last_non_tty_pct_reported + 2)
        )
        if should_print:
            print(f"{line1} | {line2}", flush=True)
            last_non_tty_pct_reported = pct


def _safe_translate(testo, source_lang, target_lang):
    last_exc = None
    for attempt in range(1, max(1, TRANSLATION_RETRIES) + 1):
        try:
            return GoogleTranslator(source=source_lang, target=target_lang).translate(testo)
        except Exception as exc:
            last_exc = exc
            if attempt < max(1, TRANSLATION_RETRIES):
                time.sleep(TRANSLATION_RETRY_DELAY * attempt)
    raise last_exc


def _is_noise_text(testo):
    # Avoid hitting translator for values that are mostly URLs, numbers, symbols, or separators.
    normalized = (testo or "").strip()
    if not normalized:
        return True
    letters = sum(1 for ch in normalized if ch.isalpha())
    if letters < 3:
        return True
    ratio = letters / max(1, len(normalized))
    return ratio < 0.18


def _is_error_text(testo):
    # Identify error messages from API/translator failures
    error_patterns = ["Error 500", "Server Error", "error", "failed", "exception"]
    testo_lower = (testo or "").lower()
    return any(pattern.lower() in testo_lower for pattern in error_patterns)

def gestisci_lingue(testo):
    """Rileva la lingua e restituisce una tupla con la versione (italiano, inglese)"""
    global translation_error_count
    global translation_error_log_count

    if not testo or testo.strip() == "":
        return "", ""

    if _is_noise_text(testo):
        return testo, testo

    # 1. Rilevamento della lingua
    try:
        lingua_rilevata = detect(testo)
    except Exception:
        lingua_rilevata = "en" # Fallback se il testo contiene solo emoji o numeri

    # 2. Traduzione speculare
    try:
        if lingua_rilevata == "it":
            italiano = testo
            inglese = _safe_translate(testo, "it", "en")
        else:
            # Se è inglese (o qualsiasi altra lingua come cinese o tedesco), traduciamo in italiano
            inglese = testo if lingua_rilevata == "en" else _safe_translate(testo, "auto", "en")
            italiano = _safe_translate(testo, "auto", "it")
        
        # Check if results contain error messages — use original text as fallback
        if _is_error_text(italiano):
            italiano = testo
        if _is_error_text(inglese):
            inglese = testo
            
    except Exception as e:
        translation_error_count += 1
        if translation_error_log_count < TRANSLATION_ERROR_LOG_LIMIT:
            print(f"Errore di traduzione, uso il testo originale come fallback: {e}")
            translation_error_log_count += 1
        italiano, inglese = testo, testo

    return italiano, inglese

def main():
    file_grezzi = glob.glob(os.path.join(cartella_grezza, "*.info.json"))
    print(f"Elaborazione, traduzione e pulizia di {len(file_grezzi)} file in corso...")
    totale_file = len(file_grezzi)
    record_saltati = 0

    if totale_file:
        render_translation_panel(0, totale_file, "-", "In attesa")

    for indice, percorso_file in enumerate(file_grezzi, start=1):
        with open(percorso_file, 'r', encoding='utf-8') as f:
            grezzo = json.load(f)

        id_video = grezzo.get("id") or os.path.basename(percorso_file)
        render_translation_panel(indice - 1, totale_file, id_video, "Analisi metadati")

        json_su_misura = build_output_record(grezzo)
        if json_su_misura is None:
            record_saltati += 1
            render_translation_panel(indice, totale_file, id_video, "Saltato: record playlist/canale")
            continue

        nome_file_uscita = os.path.join(cartella_pulita, f"{json_su_misura['id']}.json")
        with open(nome_file_uscita, 'w', encoding='utf-8') as f_out:
            json.dump(json_su_misura, f_out, ensure_ascii=False, indent=4)

        render_translation_panel(indice, totale_file, json_su_misura["id"], "Completato")

    if totale_file and sys.stdout.isatty():
        stream = get_progress_stream()
        if stream is not None:
            stream.write("\n")
            stream.flush()

    if translation_error_count > 0:
        suppressed = max(0, translation_error_count - translation_error_log_count)
        print(
            f"Traduzioni con fallback: {translation_error_count}"
            f" (messaggi mostrati: {translation_error_log_count}, nascosti: {suppressed})"
        )

    if record_saltati:
        print(f"Record non-video saltati: {record_saltati}")

    print(f"✅ Fatto! File multilingua salvati in '{cartella_pulita}'.")

    # Unione finale di tutti i JSON puliti in un CSV con separatore ';'
    percorso_csv_uscita = "output.csv"
    file_puliti = sorted(glob.glob(os.path.join(cartella_pulita, "*.json")))

    righe_csv = []
    for percorso_file in file_puliti:
        with open(percorso_file, 'r', encoding='utf-8') as f:
            record = json.load(f)
            righe_csv.append(record)

    if righe_csv:
        intestazioni = []
        for riga in righe_csv:
            for chiave in riga.keys():
                if chiave not in intestazioni:
                    intestazioni.append(chiave)

        with open(percorso_csv_uscita, 'w', encoding='utf-8', newline='') as f_csv:
            writer = csv.DictWriter(f_csv, fieldnames=intestazioni, delimiter=';')
            writer.writeheader()
            for riga in righe_csv:
                riga_normalizzata = {}
                for chiave in intestazioni:
                    valore = riga.get(chiave, "")
                    if isinstance(valore, list):
                        riga_normalizzata[chiave] = " | ".join(str(item) for item in valore)
                    elif isinstance(valore, dict):
                        riga_normalizzata[chiave] = json.dumps(valore, ensure_ascii=False)
                    elif valore is None:
                        riga_normalizzata[chiave] = ""
                    else:
                        riga_normalizzata[chiave] = valore
                writer.writerow(riga_normalizzata)

        print(f"✅ CSV generato: '{percorso_csv_uscita}' ({len(righe_csv)} righe), separatore ';'.")
    else:
        print("⚠️ Nessun file JSON trovato in 'letture_pulite': CSV non generato.")


if __name__ == "__main__":
    main()
