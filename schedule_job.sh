#!/bin/bash

# 1. Configura il risveglio del Mac alle 00:11 (un minuto prima del cron job)
# Nota: richiede i privilegi di amministratore (sudo)
echo "Configuro il risveglio automatico del Mac alle 00:11..."
sudo pmset repeat wakeorpoweron MTWRFSU 00:11:00

# 2. Percorso assoluto del tuo script di aggiornamento (MODIFICA QUESTO PERCORSO)
SCRIPT_PATH="$HOME/Documents/ping/aggiorna_dati.sh"

# Verifica che lo script aggiorna_dati.sh esista
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "⚠️ Attenzione: Non ho trovato lo script in $SCRIPT_PATH"
    echo "Modifica la variabile SCRIPT_PATH dentro questo file con il percorso corretto!"
    exit 1
fi

# Rende eseguibile lo script di destinazione se non lo è già
chmod +x "$SCRIPT_PATH"

# 3. Definizione del Cron Job (Tutti i giorni alle 00:12)
# Sintassi cron: Minuto(12) Ora(0) Giorno(*) Mese(*) GiornoSettimana(*)
CRON_JOB="12 0 * * * \"$SCRIPT_PATH\" >> \"$HOME/Documents/ping/aggiorna_dati_scheduled.log\" 2>&1"

# 4. Aggiunge il cron job al crontab senza duplicarlo
(crontab -l 2>/dev/null | grep -v "$SCRIPT_PATH"; echo "$CRON_JOB") | crontab -

echo "✅ Configurazione completata con successo!"
echo "• Sveglia Mac impostata: Ogni giorno alle 00:11"
echo "• Cron Job impostato: Ogni giorno alle 00:12"
echo "• I log dell'esecuzione verranno salvati in: $HOME/Documents/ping/aggiorna_dati_scheduled.log"


### to check the scheduled jobs, you can run:
# sudo pmset -g sched 
# crontab -l 