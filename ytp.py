import json
import os
import glob
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


def estrai_atleti(testo):
    if not testo: return []
    atleti_trovati = []
    testo_lower = testo.lower()
    for atleta in DIZIONARIO_ATLETI:
        if atleta.lower() in testo_lower and atleta not in atleti_trovati:
            atleti_trovati.append(atleta)
    return atleti_trovati

def gestisci_lingue(testo):
    """Rileva la lingua e restituisce una tupla con la versione (italiano, inglese)"""
    if not testo or testo.strip() == "":
        return "", ""

    # 1. Rilevamento della lingua
    try:
        lingua_rilevata = detect(testo)
    except:
        lingua_rilevata = "en" # Fallback se il testo contiene solo emoji o numeri

    # 2. Traduzione speculare
    try:
        if lingua_rilevata == "it":
            italiano = testo
            inglese = GoogleTranslator(source='it', target='en').translate(testo)
        else:
            # Se è inglese (o qualsiasi altra lingua come cinese o tedesco), traduciamo in italiano
            inglese = testo if lingua_rilevata == "en" else GoogleTranslator(source='auto', target='en').translate(testo)
            italiano = GoogleTranslator(source='auto', target='it').translate(testo)
    except Exception as e:
        print(f"Errore di traduzione, uso il testo originale come fallback: {e}")
        italiano, inglese = testo, testo

    return italiano, inglese

# Inizio elaborazione
file_grezzi = glob.glob(os.path.join(cartella_grezza, "*.info.json"))
print(f"Elaborazione, traduzione e pulizia di {len(file_grezzi)} file in corso...")

for percorso_file in file_grezzi:
    with open(percorso_file, 'r', encoding='utf-8') as f:
        grezzo = json.load(f)

    id_video = grezzo.get("id")
    titolo_originale = grezzo.get("title", "")
    descrizione_originale = grezzo.get("description", "")

    print(f"Traduzione video: {id_video}...")

    # Elaboriamo le lingue per titolo e descrizione
    titolo_it, titolo_en = gestisci_lingue(titolo_originale)
    descrizione_it, description_en = gestisci_lingue(descrizione_originale)

    # Estrazione atleti
    testo_per_atleti = f"{titolo_originale} {descrizione_originale}"
    atleti_rilevati = estrai_atleti(testo_per_atleti)

    # Struttura finale del JSON sdoppiata in due lingue
    json_su_misura = {
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

        # 🇮🇹 Campi in Italiano
        "title_it": titolo_it,
        "description_it": descrizione_it,

        # 🇬🇧 Campi in Inglese
        "title_en": titolo_en,
        "description_en": description_en
    }

    nome_file_uscita = os.path.join(cartella_pulita, f"{id_video}.json")
    with open(nome_file_uscita, 'w', encoding='utf-8') as f_out:
        json.dump(json_su_misura, f_out, ensure_ascii=False, indent=4)

print(f"✅ Fatto! File multilingua salvati in '{cartella_pulita}'.")
