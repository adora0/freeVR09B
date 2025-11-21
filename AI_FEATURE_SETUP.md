# Integrazione Groq LLM - Guida Configurazione

## Panoramica
Questa app ora supporta la generazione automatica di preset sintetizzatore tramite AI (Groq), permettendo agli utenti di descrivere un suono in linguaggio naturale e ottenere parametri sintetizzatore ottimizzati per la Roland VR-09B.

## Requisiti
- **Account Groq**: Registrati su https://groq.com/
- **API Key Groq**: Crea una chiave API dal dashboard Groq
- **Browser**: Chrome, Firefox, Safari, Edge (supportano fetch API)

## Setup Iniziale

### 1. Ottenere API Key Groq
1. Vai a https://groq.com/
2. Accedi o registrati
3. Vai a **API Keys** nel dashboard
4. Crea una nuova API Key
5. Copia la chiave (non sarà più visibile dopo)

### 2. Configurare Groq nell'app
1. Apri l'app VR-09B
2. Clicca il menu (☰) nell'header
3. Seleziona **Parametri**
4. Inserisci:
   - **Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
   - **API Key**: La tua chiave Groq
   - **Modello**: `mixtral-8x7b-32768` (veloce e preciso, consigliato) o altri disponibili
5. Clicca **Testa connessione** per verificare
6. Clicca **Salva** per memorizzare

Le credenziali vengono salvate in localStorage del browser e riutilizzate automaticamente.

## Utilizzo

### Generare Preset con AI
1. Nella sezione **AI Prompt** (sotto il banner, sopra i tab)
2. Descrivi il suono desiderato, es:
   - "synth pad caldo e ampio con filtro lentamente aperto"
   - "bass aggressivo e corposo con oscillatore a dente di sega"
   - "lead brillante e metallico con LFO modulante la tonalità"
3. Clicca **Genera con AI**
4. Attendere l'elaborazione (pochi secondi)
5. Il preset viene **automaticamente applicato**:
   - I parametri dell'oscillatore si aggiornano
   - Gli switch cambiano in base ai preset (osc attivi/inattivi)
   - I parametri filter, LFO, amp si applicano
   - I valori vengono inviati automaticamente al sintetizzatore MIDI

### Modellare il Preset
Dopo aver generato un preset, puoi:
- Regolare manualmente i parametri nei tab
- Testare con il piano keyboard
- Attivare/disattivare oscillatori
- Salvare il preset finale con **Presets** > **Salva preset**

## Architettura VR-09B nel Prompt

Il system prompt dell'AI conosce:

### Oscillatori (3x)
- Forme d'onda: SAW (0), SQUARE (1), SINE (2)
- Pitch: -24 a +24 semitoni (valore 0-127, centro 64)
- Detune: -50 a +50 cents (valore 0-127, centro 64)
- Pulse Width: 10-90% (valore 0-127, centro 64)
- Volume: 0-127
- Pitch Envelope: Attack, Decay, Depth

### Filtro (Multi-mode)
- Mode: LPF (0), HPF (1), BPF (2)
- Slope: 12dB (0) o 24dB (1)
- Cutoff: 0-127 (0=chiuso, 127=aperto)
- Resonance: 0-127
- Keyfollow: -100 a +100 (valore 0-127, centro 64)
- Envelope: Attack, Decay, Sustain, Release, Depth

### LFO
- Shape: SINE (0), TRIANGLE (1), SAW (2), SQUARE (3), RANDOM (4)
- Rate: 0.1-100 Hz (valore 0-127)
- Depths per Pitch, Filter, Amp (0-127, centro 64=neutro)

### Amplitude Envelope
- Attack, Decay, Sustain, Release: 0-127
- Pan: 0-127 (0=sinistra, 64=centro, 127=destra)

## Modelli Groq Disponibili
- **mixtral-8x7b-32768** (consigliato): Veloce, buona qualità, 32K token context
- **llama-2-70b-chat**: Più potente, più lento
- **gemma-7b-it**: Leggero, veloce

[Consulta lista aggiornata: https://console.groq.com/docs/models]

## Limitazioni e Note
1. **Rate Limiting**: Groq ha limiti di richieste. Per la tier free, ca. 300-500 richieste/giorno
2. **Qualità**: La descrizione è importante. Descrizioni più specifiche → preset migliori
3. **Offline**: L'app funziona senza AI (usa preset salvati), ma la generazione richiede internet
4. **Sicurezza**: L'API Key è salvata in localStorage. Non usare su computer condivisi.
5. **Validazione**: Se il JSON ricevuto non è valido, l'operazione fallisce (vedi logs)

## Troubleshooting

### "Errore: Configura Groq nel menu Parametri"
→ Salva l'API Key nel menu Parametri prima di usare l'AI

### "Errore di connessione" dal test connessione
→ Controlla:
  - Endpoint URL corretto
  - API Key valida (con spazi?)
  - Modello disponibile
  - Connessione internet attiva

### "Invalid preset JSON structure"
→ La risposta dell'AI non contiene JSON valido. Riprova con una descrizione diversa o controlla i logs.

### Preset non si applica
→ Controlla:
  - Console logs (F12 > Console) per errori
  - Che il sintetizzatore MIDI sia connesso
  - Che il JSON struttura sia corretta

## Feedback e Sviluppi Futuri
- [ ] Supporto per altri provider LLM (OpenAI, Claude, Ollama)
- [ ] Memorizzare cronologia preset generati
- [ ] Preview interattivo prima di applicare
- [ ] Fine-tuning automatico del prompt basato su feedback
- [ ] Integrazione con machine learning per migliorare mapping parametri

## References
- Roland VR-09B Manual: Parameter structure
- Groq API Docs: https://groq.com/
- SysEx Format: Roland VR-09B communication protocol
