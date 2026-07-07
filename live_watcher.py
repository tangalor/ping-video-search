import subprocess
import json
import os
import time

# I canali di ping pong che vuoi monitorare
CANALI_DA_MONITORARE = [
    "@pingpongstyles",
    "@WTT",
    "UCi8t65aGk_T5M5n4hZ1S1Aw" # Funziona sia con l'handle che con l'ID canale
]

# File locale per ricordarsi le live di cui abbiamo già inviato la notifica
FILE_LIVE_NOTIFICATE = "live_notificate.txt"

def carica_live_notificate():
    if os.path.exists(FILE_LIVE_NOTIFICATE):
        with open(FILE_LIVE_NOTIFICATE, "r") as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def salva_nuova_live(id_live):
    with open(FILE_LIVE_NOTIFICATE, "a") as f:
        f.write(f"{id_live}\n")

def invia_notifica(canale, titolo, url):
    """
    Qui puoi inserire la logica per inviarti una notifica (Telegram, Email, Supabase).
    Per ora stampiamo a schermo un grosso avviso.
    """
    print("\n" + "="*50)
    print(f"🚨 NUOVA LIVE RILEVATA SUL CANALE: {canale}")
    print(f"📌 Titolo: {titolo}")
    print(f"🔗 Guarda qui: {url}")
    print("="*50 + "\n")
    
    # ESEMPIO: Se volessi salvarlo su Supabase come evento:
    # supabase.table('live_attive').insert({"channel": canale, "title": titolo, "url": url}).execute()

def controlla_canali():
    live_gia_notificate = carica_live_notificate()
    
    for canale in CANALI_DA_MONITORARE:
        url_live_canale = f"https://www.youtube.com/{canale}/live"
        
        # Chiediamo a yt-dlp solo i metadati essenziali dell'eventuale live attiva
        comando = [
            "yt-dlp", 
            "--simulate", 
            "--dump-json", 
            "--playlist-items", "1", 
            url_live_canale
        ]
        
        # Eseguiamo il comando nascondendo gli errori se il canale è semplicemente offline
        risultato = subprocess.run(comando, capture_output=True, text=True)
        
        if risultato.returncode == 0:
            # Se returncode è 0, significa che C'È una live attiva o appena conclusa
            try:
                dati_live = json.loads(risultato.stdout)
                id_live = dati_live.get("id")
                is_live = dati_live.get("is_live", False)
                titolo = dati_live.get("title")
                url_video = dati_live.get("webpage_url")
                
                # Verifichiamo che sia effettivamente in corso e non già notificata
                if is_live and id_live not in live_gia_notificate:
                    invia_notifica(canale, titolo, url_video)
                    salva_nuova_live(id_live)
                    live_gia_notificate.add(id_live)
                    
            except Exception as e:
                print(f"Errore nel parsing dei dati per {canale}: {e}")

if __name__ == "__main__":
    print("👀 Avvio del monitoraggio live di YouTube...")
    # Questo ciclo fa girare il controllo all'infinito ogni 3 minuti (180 secondi)
    while True:
        try:
            controlla_canali()
        except KeyboardInterrupt:
            print("\nMonitoraggio interrotto dall'utente.")
            break
        except Exception as e:
            print(f"Errore generico nel ciclo: {e}")
            
        print("Riposo... prossimo controllo tra 3 minuti.")
        time.write(180)