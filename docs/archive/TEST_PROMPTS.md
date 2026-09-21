# Test Prompts per AI Preset Generator

Questi sono esempi di prompt che funzionano bene con Groq per generare preset sintetizzatore.

## Pad Synth

### Prompt 1: Pad caldo e morbido
```
synth pad caldo e morbido, ambient, con attacco lento, corpo pieno,
filtro leggermente aperto, no modulazione LFO
```

**Caratteristiche attese**:
- OSC1 attivo: onda SAW, volume medio-alto (70-90)
- Pitch Envelope: attack lento (40-60), decay medio (50-80)
- Filter: LPF, cutoff medio (80-100), no resonance forte, envelope lento
- Amp: attack slow (40-60), sustain 100-127

### Prompt 2: Pad spaziale con modulazione
```
pad atmosferico e spaziale, onda triangolare o sine,
lfo modulante il filtro con rata lenta, sustain infinito,
detune fra oscillatori per larghezza
```

## Bass

### Prompt 3: Bass profondo e corposo
```
bass basso e profondo, onda a dente di sega,
filtro chiuso inizialmente, envelope del filtro che apre, niente risonanza,
volume forte, attacco percussivo
```

**Caratteristiche attese**:
- OSC1: SAW, pitch -2 a -4, volume alto (100+)
- Filter: LPF, cutoff basso (30-50), envelope attack rapido (0-10), release lungo
- Amp: attack rapido (0-10), sustain 100-127, release medio (50-80)

### Prompt 4: Bass aggressivo sub
```
sub bass aggressivo, frequenza molto bassa, onda rettangolo,
pulse width modulato, volume massimo, pulsa il filtro
```

## Lead

### Prompt 5: Lead brillante e metallico
```
lead sintetico brillante e metallico, onda rettangolo, pitch alto,
lfo modulante la tonalità velocemente per vibrato, risonanza del filtro forte,
attacco percussivo, decay rapido
```

**Caratteristiche attese**:
- OSC1: SQUARE, pitch medio-alto (70-80), volume alto
- Pitch Envelope depth: alto (90+)
- Filter: LPF, resonance alta (70-100), envelope attack rapido (0-15)
- LFO: fast rate (80-100), pitch-depth alto (80-100) per vibrato

### Prompt 6: Lead dolce e singing
```
lead dolce quasi vocale, sine wave, pitch centrale,
lfo lento che modula il filtro per expressione dinamica,
attacco lento, sustain costante, release lungo
```

## Arps e Sequences

### Prompt 7: Synth arpa luminosa
```
suono arpa sintetica luminosa, oscillatori multipli con detune,
percussivo, decay veloce, breve durata,
niente LFO, filtro aperto, decadimento veloce
```

## Ambient e Effects

### Prompt 8: Texture ambient
```
texture ambient fredda e minimalista, mix di oscillatori,
lfo a rata molto lenta che modula tutto (pitch, filtro, volume),
cutoff del filtro medio, niente risonanza marcata,
attacco e release lunghissimi
```

### Prompt 9: Bell / FM-like
```
suono di campana sintetico, oscillatori ad alta frequenza,
forte risonanza del filtro, decay lungo e naturale,
no lfo, niente modulazione, filtro leggermente risonante
```

## Complex / Experimental

### Prompt 10: Drone oscuro
```
drone oscuro e minaccioso, frequenze basse e intermedie,
lfo modulante lentamente il filtro e l'ampiezza,
uso di detune fra oscillatori per battimenti,
sustain infinito, attacco invisibile
```

### Prompt 11: Synth vocale "aaah"
```
suono vocale sintetico "aaah" scuro, oscillatori con detune vocale,
filtro con banda passante stretta, modulazione lfo del filtro,
attacco rapido, sustain lungo, release lungo
```

## Test Framework

Per ogni prompt, verifica:
1. ✅ Risposta JSON è valida (prova JSON.parse)
2. ✅ Tutti i campi obbligatori presenti (oscillators, filter, lfo, amp)
3. ✅ Valori nell'intervallo 0-127 (eccetto "is-active": "0"/"1")
4. ✅ Preset applicato: UI aggiornata, valori visualizzati
5. ✅ Se MIDI connesso: parametri inviati al sintetizzatore
6. ✅ Oscillatori attivi corrispondono a switch aggiornati

## Suggerimenti per Buoni Prompts

❌ Scarso: "synth"
✅ Buono: "warm ambient pad con lfo lento"

❌ Scarso: "bass veloce"
✅ Buono: "sub bass profondo attacco percussivo, filtro chiuso all'inizio"

❌ Scarso: "suono" 
✅ Buono: "lead lead brillante con vibrato veloce e resonanza forte"

**Regole d'oro**:
1. Descrivi il **carattere sonoro** (caldo, freddo, brillante, scuro, etc.)
2. Specifica **l'intenzione musicale** (pad, bass, lead, effetto, etc.)
3. Nomina **componenti specifici** se importanti (filtro, LFO, envelope, etc.)
4. Indica **intenzione dinamica** (percussivo, lento, pulsante, etc.)

## Performance

Groq è veloce:
- Richiesta tipica: < 1 secondo
- Generazione JSON: < 2 secondi totali
- Token usage per prompt: ca. 200-400 token input, 300-500 output
