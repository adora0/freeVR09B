// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const statusEl = document.getElementById('status');
const sendAllBtn = document.getElementById('send-all-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const logsContainer = document.querySelector('.logs');

const rdosc1 = document.getElementById('radioosc1');
const rdosc2 = document.getElementById('radioosc2');
const rdosc3 = document.getElementById('radioosc3');
// Preset modal elements
const openPresetDialogBtn = document.getElementById('open-preset-dialog');
const presetStatusMessage = document.getElementById('preset-status-message');
const presetOkBtn = document.getElementById('preset-ok-btn');
const presetModal = document.getElementById('preset-modal');
const logModal = document.getElementById('log-modal');
const openMenuBtn = document.getElementById('open-menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const menuConnect = document.getElementById('menu-connect');
const menuReset = document.getElementById('menu-reset');
const menuSendAll = document.getElementById('menu-sendall');
const menuPresets = document.getElementById('menu-presets');
const menuParameters = document.getElementById('menu-parameters');
const menuLogs = document.getElementById('menu-logs');
const savePresetBtn = document.getElementById('save-preset-btn');
const loadPresetBtn = document.getElementById('load-preset-btn');
const presetFileInput = document.getElementById('preset-file-input');

// (AI/Groq rimossi — le costanti seguenti restano null per compatibilità eventuali)
const aiPromptSection = null;
const aiPromptToggle = null;
const aiPromptContent = null;
const aiPromptTextarea = null;
const aiGenerateBtn = null;
const aiStatusIndicator = null;
const parametersModal = document.getElementById('parameters-modal');
const groqEndpointInput = null;
const groqApiKeyInput = null;
const groqModelInput = null;
const saveParametersBtn = null;
const testGroqBtn = null;
const parametersStatusEl = document.getElementById('parameters-status');

rdosc1.disabled = true;
rdosc2.disabled = true;
rdosc3.disabled = true;

// MIDI variables
let testMode = false; // Flag per abilitare la modalità test
console.log('TestMode:', testMode);
let midiAccess = null;
let midiOutput = null;
const ROLAND_MANUFACTURER_ID = 0x41;
const DEVICE_ID = 0x10;
const MODEL_ID = [0x00, 0x00, 0x71];
const COMMAND_ID = 0x12;
// Part SysEx: base Temporary Synth Tone (PDF p.12)
// Upper1 = 19 41, Upper2 = 19 21, Lower = 1A 21
const PARTS = {
    'upper1': { id: [0x19, 0x41], label: 'Upper1', arpChannel: 3 },
    'upper2': { id: [0x19, 0x21], label: 'Upper2', arpChannel: 1 },
    'lower': { id: [0x1A, 0x21], label: 'Lower', arpChannel: 2 }
};
let currentPart = localStorage.getItem('vr09b_part') || 'upper1';
if (!PARTS[currentPart]) currentPart = 'upper1';
// Partial (oscillatore) -> terzo byte indirizzo (PDF: 00 01 00 / 00 02 00 / 00 03 00)
const PARTIAL_IDS = { '1': 0x01, '2': 0x02, '3': 0x03 };
// Offset interruttori Partial in Tone Common (00 19 / 00 1B / 00 1D)
const PARTIAL_SWITCH_OFFSETS = { '1': 0x19, '2': 0x1B, '3': 0x1D };
// Retro-compat: UPPER_ID = Upper1
const UPPER_ID = PARTS['upper1'].id;
let OSCILLATOR_ID = 0x00;

// --- SysEx helpers (checksum Roland: solo address+data, cf. PDF p.14) ---
function rolandChecksum(addressBytes, dataBytes) {
    let sum = 0;
    addressBytes.forEach(b => sum += b);
    dataBytes.forEach(b => sum += b);
    const rem = sum % 128;
    return rem === 0 ? 0 : 128 - rem;
}
function buildDt1(addressBytes, dataBytes) {
    const cks = rolandChecksum(addressBytes, dataBytes);
    return [0xF0, ROLAND_MANUFACTURER_ID, DEVICE_ID, ...MODEL_ID, COMMAND_ID,
        ...addressBytes, ...dataBytes, cks, 0xF7];
}
// Coda SysEx: il PDF impone >=40ms tra pacchetti DT1 consecutivi.
// Coalescing: per stessa chiave indirizzo si tiene solo l'ultimo valore.
const SYSEX_GAP_MS = 40;
let sysexQueue = [];
let sysexProcessing = false;
let lastSysexTime = 0;
function enqueueSysEx(bytes, key) {
    if (key) {
        sysexQueue = sysexQueue.filter(e => e.key !== key);
    }
    sysexQueue.push({ bytes, key });
    processSysexQueue();
}
function processSysexQueue() {
    if (sysexProcessing) return;
    sysexProcessing = true;
    const step = () => {
        if (!sysexQueue.length) { sysexProcessing = false; return; }
        const now = performance.now();
        const wait = Math.max(0, SYSEX_GAP_MS - (now - lastSysexTime));
        setTimeout(() => {
            const entry = sysexQueue.shift();
            lastSysexTime = performance.now();
            if (entry) {
                if (testMode) {
                    console.log('TestMode SysEx:', formatSysEx(entry.bytes));
                } else if (midiOutput) {
                    try { midiOutput.send(new Uint8Array(entry.bytes)); } catch (e) { logMessage('Errore invio SysEx: ' + e.message, 'error'); }
                }
            }
            step();
        }, wait);
    };
    step();
}

// (Sezione AI rimossa — vedi docs/archive/ per implementazione futura)

// Arpeggiatore variables
let arpeggiatorActive = false;
let arpeggiatorMode = 'chord'; // 'chord' o 'arpeggio'
let arpeggiatorSequenceType = 'up';
let arpeggiatorRate = 64; // Velocità arpeggiatore (0-127)
let arpeggiatorPlayingNotes = new Set(); // Tiene traccia delle note attualmente in riproduzione
let arpeggiatorInterval = null; // Timer per la sequenza
let arpeggiatorIndex = 0; // Indice per la sequenza corrente


// Parameters mapping
const parameterAddresses = {
    // Oscillator parameters    
    'osc-wave': 0x00,
    'osc-wave-variation': 0x01,
    'osc-pitch': 0x03,
    'osc-detune': 0x04,
    'osc-pw-mod-depth': 0x05,
    'osc-pw': 0x06,
    'osc-pitch-env-attack': 0x07,
    'osc-pitch-env-decay': 0x08,
    'osc-pitch-env-depth': 0x09,

    // Filter parameters
    'filter-mode': 0x0A,
    'filter-slope': 0x0B,
    'filter-cutoff': 0x0C,
    'filter-cutoff-keyfollow': 0x0D,
    'filter-resonance': 0x0F,
    'filter-env-attack': 0x10,
    'filter-env-decay': 0x11,
    'filter-env-sustain': 0x12,
    'filter-env-release': 0x13,
    'filter-env-depth': 0x14,

    // LFO parameters
    'lfo-shape': 0x1C,
    'lfo-rate': 0x1D,
    'lfo-tempo-sync': 0x1E,
    'lfo-tempo-sync-note': 0x1F,
    'lfo-fade-time': 0x20,
    'lfo-pitch-depth': 0x22,
    'lfo-filter-depth': 0x23,
    'lfo-amp-depth': 0x24,

    // Modulation LFO parameters
    'mod-lfo-shape': 0x26,
    'mod-lfo-rate': 0x27,
    'mod-lfo-tempo-sync': 0x28,
    'mod-lfo-tempo-sync-note': 0x29,
    'mod-lfo-pitch-depth': 0x2C,
    'mod-lfo-filter-depth': 0x2D,
    'mod-lfo-amp-depth': 0x2E,

    //Amp parameters
    'osc-volume': 0x15,
    'amp-vel-sens': 0x16,
    'amp-volume-env-attack': 0x17,
    'amp-volume-env-decay': 0x18,
    'amp-volume-env-sustain': 0x19,
    'amp-volume-env-release': 0x1A,
    'amp-pan': 0x1B,

    // Hidden partial params (PDF p.13)
    'super-saw-detune': 0x3A,
    'mod-lfo-rate-ctrl': 0x3B
};





const oscillatorStates = {
    '0': {}, // osc1
    '1': {}, // osc2
    '2': {}  // osc3
};

let activeOscId = '0'; // Oscillatore iniziale

// Inizializza tutti i valori a 0
Object.keys(oscillatorStates).forEach(oscId => {
    Object.keys(parameterAddresses).forEach(paramId => {
        oscillatorStates[oscId][paramId] = 0;
    });
});


// Bidirectional parameters (convert between display and actual values)
const bidirectionalParams = [
    'osc-pitch', 'osc-detune', 'osc-pitch-env-depth',
    'filter-cutoff-keyfollow', 'filter-env-depth',
    'lfo-pitch-depth', 'lfo-filter-depth', 'lfo-amp-depth',
    'mod-lfo-pitch-depth', 'mod-lfo-filter-depth', 'mod-lfo-amp-depth',
    'amp-vel-sens', 'mod-lfo-rate-ctrl'
];


// Initialize all range inputs to update their displayed values
document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valueEl = document.getElementById(`${slider.id}-value`);
    if (!valueEl) return;

    // Set initial value
    if (bidirectionalParams.includes(slider.id)) {
        const centerValue = (parseInt(slider.min) + parseInt(slider.max)) / 2;
        valueEl.textContent = Math.round(parseInt(slider.value) - centerValue);
    } else {
        valueEl.textContent = slider.value;
    }

    // Add event listener
    slider.addEventListener('input', () => {
        if (bidirectionalParams.includes(slider.id)) {
            const centerValue = (parseInt(slider.min) + parseInt(slider.max)) / 2;
            valueEl.textContent = Math.round(parseInt(slider.value) - centerValue);
        } else {
            valueEl.textContent = slider.value;
        }
    });
});



// Tab switching
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabId = button.getAttribute('data-tab');

        // Update active button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Show active panel
        tabPanels.forEach(panel => {
            panel.style.display = panel.id === tabId ? 'block' : 'none';
        });
    });
});

// Connect to MIDI devices
connectBtn.addEventListener('click', async () => {
    try {
        if (!midiAccess) {
            if (navigator.requestMIDIAccess) {
                midiAccess = await navigator.requestMIDIAccess({ sysex: true });
                logMessage('Accesso MIDI ottenuto', 'success');
                statusEl.textContent = 'Stato: Connesso al sistema MIDI';
                connectBtn.textContent = 'Seleziona VR-09B';

                // Now list available MIDI outputs
                showMidiOutputSelection();
            } else {
                logMessage('Web MIDI API non supportata dal browser', 'error');
                statusEl.textContent = 'Stato: API MIDI non supportata';
            }
        } else if (!midiOutput) {
            showMidiOutputSelection();
        } else {
            // Already connected, do nothing or reconnect
            midiOutput = null;
            connectBtn.textContent = 'Seleziona VR-09B';
            statusEl.textContent = 'Stato: Disconnesso dalla VR-09B';
            showMidiOutputSelection();
        }
    } catch (err) {
        logMessage('Errore di connessione MIDI: ' + err.message, 'error');
        statusEl.textContent = 'Stato: Errore di connessione';
    }
});

// Show MIDI output selection dialog

function showMidiOutputSelection() {
    // Clear previous outputs list
    const existingSelect = document.getElementById('midi-output-select');
    if (existingSelect) {
        existingSelect.remove();
    }

    // Create select element
    const selectEl = document.createElement('select');
    selectEl.id = 'midi-output-select';
    selectEl.style.margin = '10px 0';
    selectEl.style.width = '100%';
    selectEl.style.padding = '8px';

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Seleziona dispositivo MIDI --';
    selectEl.appendChild(defaultOption);

    // Add options for each MIDI output
    let hasOutputs = false;
    midiAccess.outputs.forEach(output => {
        hasOutputs = true;
        const option = document.createElement('option');
        option.value = output.id;
        option.textContent = output.name || `Dispositivo ${output.id}`;
        selectEl.appendChild(option);
    });

    if (!hasOutputs) {
        logMessage('Nessun dispositivo MIDI di output trovato', 'error');
        return;
    }

    // Add to DOM before connect button
    connectBtn.parentNode.insertBefore(selectEl, connectBtn);

    // Add change event
    selectEl.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            midiOutput = midiAccess.outputs.get(selectedId);
            statusEl.textContent = `Stato: Connesso a ${midiOutput.name || 'VR-09B'}`;
            connectBtn.textContent = 'Disconnetti MIDI';
            logMessage(`Connesso a ${midiOutput.name || 'VR-09B'}`, 'success');
            selectEl.remove();
        }
    });
}

// Send parameter value to VR-09B (indirizzo: Part[2] + Partial[1] + offset[1])
function sendParameterValue(paramId, value, oscIdOverride, partOverride) {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return false;
    }

    const address = parameterAddresses[paramId];
    if (address === undefined) {
        logMessage(`Indirizzo parametro sconosciuto: ${paramId}`, 'error');
        return false;
    }

    try {
        // Determina il partial: override ('1'/'2'/'3') > radio selezionata > activeOscId
        let oscNum = null;
        if (oscIdOverride !== undefined && oscIdOverride !== null) {
            oscNum = String(oscIdOverride).replace(/[^1-3]/g, '') || String(oscIdOverride);
            // retro-compat: '25'->'1', '27'->'2', '29'->'3'
            if (oscNum === '25') oscNum = '1';
            if (oscNum === '27') oscNum = '2';
            if (oscNum === '29') oscNum = '3';
        } else {
            const oscSelected = document.querySelectorAll('input[name="osc-wave-variation"]:checked');
            if (oscSelected.length > 0) oscNum = oscSelected[0].value;
            else oscNum = activeOscId || '1';
        }
        const partialByte = PARTIAL_IDS[oscNum] || PARTIAL_IDS['1'];
        const partKey = partOverride || currentPart;
        const partBytes = (PARTS[partKey] || PARTS['upper1']).id;

        const addrBytes = [...partBytes, partialByte, address];
        const v = Math.max(0, Math.min(127, parseInt(value)));
        const sysexMessage = buildDt1(addrBytes, [v]);
        const key = `${partKey}:${partialByte}:${address}`;

        if (testMode) {
            console.log('TestMode: SysEx generato:', formatSysEx(sysexMessage));
        } else {
            enqueueSysEx(sysexMessage, key);
            logMessage(`Parametro inviato [${PARTS[partKey].label} P${oscNum}]: ${paramId} = ${v} — ` + formatSysEx(sysexMessage), 'info');
        }
        return true;
    } catch (error) {
        logMessage(`Errore nell'invio del parametro: ${error.message}`, 'error');
        return false;
    }
}

    // Calcola il delay (ms) dell'arpeggiatore a partire dal valore `rate` (0-127)
    // Mappa il valore rate su un intervallo BPM (minBpm..maxBpm) e ritorna i millisecondi per battito
    function calculateArpeggiatorDelay(rate) {
        const r = Number(rate) || 0;
        const minBpm = 30;   // BPM minimo
        const maxBpm = 300;  // BPM massimo
        const clamped = Math.max(0, Math.min(127, r));
        const bpm = Math.round(minBpm + (clamped / 127) * (maxBpm - minBpm));
        const delayMs = Math.round(60000 / bpm);
        // Impediamo valori troppo bassi
        return Math.max(20, delayMs);
    }
// accende o spegne il partial (Tone Common 00 19/1B/1D, cf. PDF p.12)
function setOscOn(osc, status, partOverride) {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return false;
    }
    let oscNum = String(osc).replace(/[^1-3]/g, '');
    if (!oscNum) {
        // retro-compat: '25'->'1', '27'->'2', '29'->'3'
        if (String(osc) === '25') oscNum = '1';
        else if (String(osc) === '27') oscNum = '2';
        else if (String(osc) === '29') oscNum = '3';
        else oscNum = '1';
    }
    const switchOffset = PARTIAL_SWITCH_OFFSETS[oscNum] || 0x19;
    const partKey = partOverride || currentPart;
    const partBytes = (PARTS[partKey] || PARTS['upper1']).id;
    OSCILLATOR_ID = switchOffset;
    try {
        // Indirizzo: Part[2] + 00 + switchOffset (es. 19 41 00 19 = Upper1 Partial1 Switch)
        const addrBytes = [...partBytes, 0x00, switchOffset];
        const sysexMessage = buildDt1(addrBytes, [parseInt(status) ? 1 : 0]);

        if (testMode) {
            console.log('TestMode: SysEx generato:', formatSysEx(sysexMessage));
            return true;
        }

        // Send the message (via coda 40ms)
        enqueueSysEx(sysexMessage, `sw:${partKey}:${oscNum}`);
        logMessage(`Oscillatore [${PARTS[partKey].label} P${oscNum}]: ${status} — ` + formatSysEx(sysexMessage), 'info');
        return true;
    } catch (error) {
        logMessage(`Errore nell'invio del parametro: ${error.message}`, 'error');
        return false;
    }
}

function formatSysEx(sysex) {
    return Array.from(sysex)
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase()) // Formatta ogni byte in esadecimale
        .join(' '); // Inserisce uno spazio tra i byte
}

// Invia un messaggio MIDI Note On (Mode 2 - Keyboard Sound Generator)
// channelIndex: 0-15 (0=Canale 1, 3=Canale 4, ecc.)
// noteNumber: 0-127 (numero della nota MIDI)
// velocity: 1-127 (velocità della nota, non usare 0 per Note On)
function sendMidiNoteOn(channelIndex, noteNumber, velocity = 95) {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return false;
    }

    try {
        // Formato Note On: 9nH kkH vvH
        // 9nH = 0x90 + channel index (0-15)
        // kkH = nota MIDI (0-127)
        // vvH = velocità (1-127, deve essere > 0 per Note On)
        const statusByte = 0x90 | (channelIndex & 0x0F);
        const midiNote = noteNumber & 0x7F;
        const midiVelocity = Math.max(1, Math.min(127, velocity)) & 0x7F;

        const midiMessage = [statusByte, midiNote, midiVelocity];

        if (testMode) {
            const hexMsg = midiMessage.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            console.log(`TestMode - Note On: ${hexMsg}`);
            logMessage(`[TEST] Note On - Ch:${channelIndex + 1} Note:${noteNumber} Vel:${midiVelocity}`, 'info');
            return true;
        }

        midiOutput.send(new Uint8Array(midiMessage));
        logMessage(`Note On - Canale:${channelIndex + 1} Nota:${noteNumber} Velocità:${midiVelocity}`, 'info');
        return true;
    } catch (error) {
        logMessage(`Errore nell'invio Note On: ${error.message}`, 'error');
        return false;
    }
}

// Invia un messaggio MIDI Note Off (Mode 2 - Keyboard Sound Generator)
// Usa il formato 8nH kkH vvH
// channelIndex: 0-15 (0=Canale 1, 3=Canale 4, ecc.)
// noteNumber: 0-127 (numero della nota MIDI)
function sendMidiNoteOff(channelIndex, noteNumber) {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return false;
    }

    try {
        // Formato Note Off: 8nH kkH vvH
        // 8nH = 0x80 + channel index (0-15)
        // kkH = nota MIDI (0-127)
        // vvH = velocità (ignorata dal VR-09, usiamo 64 per convenzione)
        const statusByte = 0x80 | (channelIndex & 0x0F);
        const midiNote = noteNumber & 0x7F;
        const midiVelocity = 64; // Valore standard, ignorato dal VR-09

        const midiMessage = [statusByte, midiNote, midiVelocity];

        if (testMode) {
            const hexMsg = midiMessage.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            console.log(`TestMode - Note Off: ${hexMsg}`);
            logMessage(`[TEST] Note Off - Ch:${channelIndex + 1} Nota:${noteNumber}`, 'info');
            return true;
        }

        midiOutput.send(new Uint8Array(midiMessage));
        logMessage(`Note Off - Canale:${channelIndex + 1} Nota:${noteNumber}`, 'info');
        return true;
    } catch (error) {
        logMessage(`Errore nell'invio Note Off: ${error.message}`, 'error');
        return false;
    }
}

// Core logic to send all parameters (callable without UI effects)
function sendAllParameters() {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    // invia i valori attuali della UI per l'oscillatore selezionato (solo params synth, no mirror/UI)
    Object.keys(parameterAddresses).forEach(paramId => {
        const element = document.getElementById(paramId);
        if (element) {
            const result = sendParameterValue(paramId, element.value);
            if (result) successCount++; else failCount++;
        }
    });

    logMessage(`Invio completato: ${successCount} parametri inviati, ${failCount} falliti`,
        failCount > 0 ? 'error' : 'success');
}

// Map oscillatore numerico (1/2/3) a partial SysEx (retro-compat: ritorna '1'/'2'/'3')
function mapOscNumberToSysExId(oscNumber) {
    const n = String(oscNumber);
    return (n === '2') ? '2' : (n === '3') ? '3' : '1';
}

// Panic: ferma LFO software, arpeggiatore e tutte le note
function panicAll() {
    try { stopAllSoftLFO(); } catch (_) {}
    try { if (typeof stopArpeggiatorGlobal === 'function') stopArpeggiatorGlobal(); } catch (_) {}
    if (midiOutput && !testMode) {
        // All Notes Off + All Sound Off sui canali keyboard
        [0, 1, 2, 3, 10, 15].forEach(ch => {
            try {
                midiOutput.send(new Uint8Array([0xB0 | ch, 123, 0]));
                midiOutput.send(new Uint8Array([0xB0 | ch, 120, 0]));
            } catch (_) {}
        });
    }
    sysexQueue = [];
    logMessage('PANIC: tutto fermato (note off + code svuotate)', 'success');
}

// ===== TIMER ROBUSTO via Web Worker (anti-throttle su rotate/background) =====
let robustWorker = null;
let robustHandlers = new Map();
let robustSeq = 0;
function getRobustWorker() {
    if (robustWorker) return robustWorker;
    try {
        const src = `let timers={};onmessage=e=>{const d=e.data;
if(d.cmd==='start'){if(timers[d.id])clearInterval(timers[d.id]);
timers[d.id]=setInterval(()=>postMessage({id:d.id,t:Date.now()}),d.ms);}
else if(d.cmd==='stop'){if(timers[d.id]){clearInterval(timers[d.id]);delete timers[d.id];}}};`;
        robustWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        robustWorker.onmessage = (e) => {
            const h = robustHandlers.get(e.data.id);
            if (h) h(e.data.t);
        };
    } catch (_) { robustWorker = null; }
    return robustWorker;
}
function robustSetInterval(cb, ms) {
    const w = getRobustWorker();
    if (!w) return setInterval(cb, ms);
    const id = 'r' + (++robustSeq);
    robustHandlers.set(id, cb);
    w.postMessage({ cmd: 'start', id, ms: Math.max(20, ms) });
    return id;
}
function robustClearInterval(id) {
    const w = getRobustWorker();
    if (!w || typeof id !== 'string' || !id.startsWith('r')) { clearInterval(id); return; }
    try { w.postMessage({ cmd: 'stop', id }); } catch (_) {}
    robustHandlers.delete(id);
}
// WakeLock + keep-alive su visibilitychange (Android/Chrome USB-OTG)
let wakeLockSentinel = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            if (wakeLockSentinel) { try { await wakeLockSentinel.release(); } catch (_) {} }
            wakeLockSentinel = await navigator.wakeLock.request('screen');
        }
    } catch (_) {}
}
function initRobustTimers() {
    requestWakeLock();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            requestWakeLock();
            // riallinea clock Soft-LFO e arpeggiatore per evitare salti
            softLFOEngine.rebase();
            if (typeof arpeggiatorRebase === 'function') arpeggiatorRebase();
        }
    });
    window.addEventListener('orientationchange', () => {
        // NON ricreare i timer: solo log + wake lock (la rotazione non deve fermare l'audio)
        setTimeout(() => requestWakeLock(), 300);
    });
}

// ===== SELETTORE PART (Upper1/Upper2/Lower) =====
function initPartSelector() {
    const sel = document.getElementById('part-select');
    const arpSel = document.getElementById('arp-midi-channel');
    if (sel) {
        sel.value = currentPart;
        sel.addEventListener('change', (e) => {
            currentPart = e.target.value;
            localStorage.setItem('vr09b_part', currentPart);
            logMessage(`Parte synth: ${PARTS[currentPart].label}`, 'success');
        });
    }
    // default canale arp coerente con la parte (modificabile comunque dall'utente)
    if (arpSel && !localStorage.getItem('vr09b_arp_ch')) {
        arpSel.value = String(PARTS[currentPart].arpChannel);
    }
    if (arpSel) arpSel.addEventListener('change', (e) => localStorage.setItem('vr09b_arp_ch', e.target.value));
}

// ===== SOFT-LFO: un LFO software per OGNI parametro =====
// Modulazione bipolare attorno al valore base dello slider.
// rate: 0.05..10 Hz | depth: 0..63 | shape: sine/tri/saw/sqr/s&h/random
const SOFT_LFO_TARGETS = [
    'osc-pitch', 'osc-detune', 'osc-pw', 'osc-pw-mod-depth',
    'osc-pitch-env-depth', 'super-saw-detune',
    'filter-cutoff', 'filter-resonance', 'filter-env-depth',
    'lfo-rate', 'lfo-pitch-depth', 'lfo-filter-depth', 'lfo-amp-depth',
    'mod-lfo-rate', 'mod-lfo-rate-ctrl',
    'osc-volume', 'amp-vel-sens', 'amp-pan'
];
let softLFOState = {}; // paramId -> {on, rate, depth, shape, phase, base, smooth}
SOFT_LFO_TARGETS.forEach(p => {
    softLFOState[p] = { on: false, rate: 1.0, depth: 20, shape: 'sine', phase: Math.random(), base: null, smooth: 0, shVal: 0 };
    try {
        const saved = JSON.parse(localStorage.getItem('softlfo_' + p) || 'null');
        if (saved) Object.assign(softLFOState[p], saved);
    } catch (_) {}
});
function softLfoWave(shape, phase) {
    const p = phase % 1;
    switch (shape) {
        case 'sine': return Math.sin(p * Math.PI * 2);
        case 'tri': return 4 * Math.abs(p - 0.5) - 1;
        case 'saw': return p * 2 - 1;
        case 'sqr': return p < 0.5 ? 1 : -1;
        case 's&h': return softLFOState._sh || 0;
        case 'random': return Math.random() * 2 - 1;
        default: return Math.sin(p * Math.PI * 2);
    }
}
const softLFOEngine = {
    timerId: null, lastTick: 0,
    start() {
        if (this.timerId) return;
        this.lastTick = performance.now();
        // tick 50ms via worker robusto (coerente con coda SysEx 40ms)
        this.timerId = robustSetInterval(() => this.tick(), 50);
    },
    stop() {
        if (!this.timerId) return;
        robustClearInterval(this.timerId);
        this.timerId = null;
    },
    rebase() { this.lastTick = performance.now(); },
    tick() {
        const now = performance.now();
        let dt = (now - this.lastTick) / 1000;
        this.lastTick = now;
        if (dt > 0.5) dt = 0.05; // tab nascosto a lungo: evita salti
        let anyOn = false;
        SOFT_LFO_TARGETS.forEach(paramId => {
            const st = softLFOState[paramId];
            if (!st || !st.on) return;
            anyOn = true;
            const el = document.getElementById(paramId);
            if (st.base === null || st.base === undefined) {
                st.base = el ? parseInt(el.value) : 64;
            }
            st.phase = (st.phase + dt * st.rate) % 1;
            if (st.shape === 's&h') {
                // nuovo valore ogni ciclo
                if (!st._acc) st._acc = 0;
                st._acc += dt * st.rate;
                if (st._acc >= 1) { st._acc = 0; st._shVal = Math.random() * 2 - 1; }
            }
            let v;
            if (st.shape === 's&h') v = st._shVal || 0;
            else v = softLfoWave(st.shape, st.phase);
            let target = Math.round(st.base + v * st.depth);
            const elMin = el ? parseInt(el.min) : 0;
            const elMax = el ? parseInt(el.max) : 127;
            target = Math.max(elMin, Math.min(elMax, target));
            // smoothing one-pole per evitare zipper su cutoff/volume
            if (st.smooth > 0) {
                st._sm = st._sm === undefined ? target : st._sm + (target - st._sm) * 0.4;
                target = Math.round(st._sm);
            }
            // aggiorna slider senza triggerare loop: invia SysEx diretto sul partial correntemente in edit
            if (el && document.activeElement !== el) {
                el.value = target;
                const valEl = document.getElementById(paramId + '-value');
                if (valEl) {
                    if (bidirectionalParams.includes(paramId)) {
                        const c = (parseInt(el.min) + parseInt(el.max)) / 2;
                        valEl.textContent = Math.round(target - c);
                    } else valEl.textContent = target;
                }
            }
            const oscSel = document.querySelector('input[name="osc-wave-variation"]:checked');
            const oscNum = oscSel ? oscSel.value : (activeOscId || '1');
            sendParameterValue(paramId, target, oscNum);
        });
        if (!anyOn) this.stop();
    }
};
function setSoftLFO(paramId, patch) {
    Object.assign(softLFOState[paramId], patch);
    try { localStorage.setItem('softlfo_' + paramId, JSON.stringify({ on: softLFOState[paramId].on, rate: softLFOState[paramId].rate, depth: softLFOState[paramId].depth, shape: softLFOState[paramId].shape })); } catch (_) {}
    const el = document.getElementById(paramId);
    if (patch.on && el) softLFOState[paramId].base = parseInt(el.value);
    if (patch.on) { softLFOEngine.start(); requestWakeLock(); }
}
function stopAllSoftLFO() {
    SOFT_LFO_TARGETS.forEach(p => { softLFOState[p].on = false; });
    softLFOEngine.stop();
    document.querySelectorAll('.softlfo-toggle.on').forEach(b => { b.classList.remove('on'); b.textContent = 'LFO off'; });
}
function initSoftLFOUI() {
    // Inietta un mini-toggle "~LFO" accanto a ogni slider target (se non esiste)
    SOFT_LFO_TARGETS.forEach(paramId => {
        const slider = document.getElementById(paramId);
        if (!slider) return;
        const container = slider.closest('.slider-container');
        if (!container || container.querySelector('.softlfo-toggle')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'softlfo-toggle' + (softLFOState[paramId].on ? ' on' : '');
        btn.textContent = softLFOState[paramId].on ? 'LFO on' : '~LFO';
        btn.title = 'Soft-LFO software: tieni premuto per impostazioni';
        btn.setAttribute('aria-label', 'Attiva Soft-LFO per ' + paramId);
        btn.addEventListener('click', () => {
            const st = softLFOState[paramId];
            setSoftLFO(paramId, { on: !st.on });
            btn.classList.toggle('on', softLFOState[paramId].on);
            btn.textContent = softLFOState[paramId].on ? 'LFO on' : '~LFO';
        });
        // long-press / doppio click -> pannello impostazioni
        btn.addEventListener('dblclick', () => openSoftLFOPanel(paramId));
        let pressTimer = null;
        btn.addEventListener('touchstart', () => { pressTimer = setTimeout(() => openSoftLFOPanel(paramId), 600); }, { passive: true });
        btn.addEventListener('touchend', () => { if (pressTimer) clearTimeout(pressTimer); });
        container.appendChild(btn);
    });
    if (softLFOState && SOFT_LFO_TARGETS.some(p => softLFOState[p].on)) softLFOEngine.start();
}
function openSoftLFOPanel(paramId) {
    const st = softLFOState[paramId];
    const rate = prompt(`Soft-LFO ${paramId} — rate Hz (0.05-10):`, String(st.rate));
    if (rate !== null) st.rate = Math.max(0.05, Math.min(10, parseFloat(rate) || 1));
    const depth = prompt(`Soft-LFO ${paramId} — depth (0-63):`, String(st.depth));
    if (depth !== null) st.depth = Math.max(0, Math.min(63, parseInt(depth) || 0));
    const shape = prompt(`Soft-LFO ${paramId} — shape (sine/tri/saw/sqr/s&h/random):`, st.shape);
    if (shape !== null && ['sine', 'tri', 'saw', 'sqr', 's&h', 'random'].includes(shape)) st.shape = shape;
    setSoftLFO(paramId, {});
    logMessage(`Soft-LFO ${paramId}: ${st.shape} ${st.rate}Hz depth ${st.depth}`, 'info');
}

// Invia tutti i parametri per gli oscillatori attivi usando i dati forniti
function sendAllParametersForOscillators(paramsByOsc) {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    ['1', '2', '3'].forEach(oscNum => {
        const params = paramsByOsc[oscNum] || {};
        const isActive = params['is-active'] === '1';
        if (!isActive) return;

        const sysExOscId = mapOscNumberToSysExId(oscNum);

        // Invia tutti i parametri salvati per questo oscillatore (escludi is-active)
        Object.entries(params).forEach(([paramId, val]) => {
            if (paramId === 'is-active') return;
            const res = sendParameterValue(paramId, val, sysExOscId);
            if (res) successCount++; else failCount++;
        });
    });

    logMessage(`Invio completato: ${successCount} parametri inviati, ${failCount} falliti`,
        failCount > 0 ? 'error' : 'success');
}

// Reset all parameters to defaults and send them
const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
if (resetDefaultsBtn) {
    resetDefaultsBtn.addEventListener('click', () => {
        try { resetDefaultsBtn.classList.add('is-pressed'); } catch (_) { }

        Object.entries(DEFAULTS).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = val;
            const valueEl = document.getElementById(`${id}-value`);
            if (valueEl) {
                if (bidirectionalParams.includes(id)) {
                    const centerValue = (parseInt(el.min) + parseInt(el.max)) / 2;
                    valueEl.textContent = Math.round(parseInt(val) - centerValue);
                } else {
                    valueEl.textContent = val;
                }
            }
        });

        // Invia tutti i parametri dopo il reset (senza effetto visivo sul bottone send)
        sendAllParameters();
        setTimeout(() => { try { resetDefaultsBtn.classList.remove('is-pressed'); } catch (_) { } }, 120);
    });
}


function updateOscillatorStatus() {
    const oscWaveVariationSelect = document.getElementById('osc-wave-variation');
    const oscWave = document.getElementById('osc-wave');
    const osc1 = document.getElementById('switch1').checked;
    const osc2 = document.getElementById('switch2').checked;
    const osc3 = document.getElementById('switch3').checked;

    // Abilita o no i radio button in base allo stato degli switch
    if (osc1) {
        rdosc1.disabled = false;
        rdosc1.removeAttribute('disabled');
        setOscOn('1', '1');
    } else {
        rdosc1.disabled = true;
        rdosc1.setAttribute('disabled', '');
        setOscOn('1', '0');
    }
    if (osc2) {
        rdosc2.disabled = false;
        rdosc2.removeAttribute('disabled');
        setOscOn('2', '1');
    }
    else {
        rdosc2.disabled = true;
        rdosc2.setAttribute('disabled', '');
        setOscOn('2', '0');

    }
    if (osc3) {
        rdosc3.disabled = false;
        rdosc3.removeAttribute('disabled');
        setOscOn('3', '1');

    }
    else {
        rdosc3.disabled = true;
        rdosc3.setAttribute('disabled', '');
        setOscOn('3', '0');

    }

}
// Add event listeners to update status when checkboxes are toggled
document.getElementById('switch1').addEventListener('change', updateOscillatorStatus);
document.getElementById('switch2').addEventListener('change', updateOscillatorStatus);
document.getElementById('switch3').addEventListener('change', updateOscillatorStatus);



// Helper function to log messages
function logMessage(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = message;

    // Add timestamp
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    // Add to log container
    logsContainer.appendChild(logEntry);

    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Limit number of log entries
    const maxLogEntries = 50;
    while (logsContainer.children.length > maxLogEntries) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

// Check for Web MIDI API support on page load
window.addEventListener('load', () => {
    if (!navigator.requestMIDIAccess) {
        logMessage('Il browser non supporta Web MIDI API', 'error');
        statusEl.textContent = 'Stato: Web MIDI API non supportata';
        connectBtn.disabled = true;
    } else {
        logMessage('Web MIDI API supportata. Premi "Connetti MIDI" per iniziare.', 'info');
    }

});

// Oggetto per memorizzare i parametri di ciascun oscillatore
const oscillatorParams = {
    '1': {},
    '2': {},
    '3': {}
};

activeOscId = '1';

// ===== AI rimossa (stub per compatibilità) =====
function updateAiStatus() {}
function showParametersStatus() {}
async function sendPromptToGroq() { throw new Error('AI rimossa'); }
function applyGroqPreset() { throw new Error('AI rimossa'); }

// Imposta i parametri dell'oscillatore attivo all'avvio
function init() {
    console.log('init(): running — initializing UI bindings');
    saveCurrentOscParams('1');
    saveCurrentOscParams('2');
    saveCurrentOscParams('3');

    // Allinea lo stato dei pulsanti di destinazione con gli switch all'avvio
    updateOscillatorStatus();
    // Modal bindings
    if (menuPresets && presetModal) {

        const openPreset = () => { presetModal.hidden = false; };
        const closePreset = () => { presetModal.hidden = true; };
        menuPresets.addEventListener('click', (e) => { e.stopPropagation(); openPreset(); });
        presetModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.dataset && target.dataset.close !== undefined) {
                closePreset();
            }
        });
        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !presetModal.hidden) closePreset();
        });
    }
    // modal actions reduced to save/load only
    if (savePresetBtn) savePresetBtn.addEventListener('click', () => saveCurrentPreset());
    if (loadPresetBtn && presetFileInput) {
        loadPresetBtn.addEventListener('click', () => presetFileInput.click());
        presetFileInput.addEventListener('change', onPresetFileSelected);
    }

    // Header menu bindings
    // Verifica che gli elementi del menu esistono
    console.log('Menu Elements Check:');
    console.log('openMenuBtn:', openMenuBtn);
    console.log('menuDropdown:', menuDropdown);
    console.log('menuConnect:', menuConnect);
    console.log('menuReset:', menuReset);
    console.log('menuSendAll:', menuSendAll);
    console.log('menuPresets:', menuPresets);
    console.log('menuLogs:', menuLogs);

    if (openMenuBtn && menuDropdown) {
        const closeMenu = () => {
            menuDropdown.hidden = true;
            openMenuBtn.setAttribute('aria-expanded', 'false');
        };
        openMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = openMenuBtn.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                closeMenu();
            } else {
                menuDropdown.hidden = false;
                openMenuBtn.setAttribute('aria-expanded', 'true');
            }
        });
        document.addEventListener('click', (e) => {
            if (!menuDropdown.hidden && !openMenuBtn.contains(e.target) && !menuDropdown.contains(e.target)) {
                closeMenu();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menuDropdown.hidden) closeMenu();
        });
    } else {
        console.warn('Menu elements not found - check HTML IDs');
    }
    if (menuConnect) menuConnect.addEventListener('click', () => connectBtn.click());
    if (menuReset) menuReset.addEventListener('click', () => resetAllToDefaults());
    if (menuSendAll) menuSendAll.addEventListener('click', () => sendAllParameters());
    if (menuPresets) menuPresets.addEventListener('click', () => { if (presetModal) presetModal.hidden = false; });
    if (menuParameters) menuParameters.style.display = 'none';
    if (parametersModal) parametersModal.hidden = true;
    if (menuLogs && logModal) {
        menuLogs.addEventListener('click', () => logModal.hidden = false);
        logModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.dataset && target.dataset.close !== undefined) {
                logModal.hidden = true;
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !logModal.hidden) logModal.hidden = true;
        });
    }

    // (AI/Groq rimossi)

    // ===== TIMER ROBUSTI (rotazione/background Android/Chrome) =====
    // Problema: setInterval viene throttlato/messo in pausa su rotate/hidden.
    // Soluzione: Worker dedicato + WakeLock + recupero drift su visibilitychange.
    initRobustTimers();
    initPartSelector();
    initSoftLFOUI();

    // ===== ARPEGGIATORE MIDI (ottimizzato + timer robusto) =====
    // Cache DOM elementi usati dall'arpeggiatore
    const arpChannelSelect = document.getElementById('arp-midi-channel');
    const arpModeSelect = document.getElementById('arp-mode');
    const arpSequenceTypeSelect = document.getElementById('arp-sequence-type');
    const arpRateSlider = document.getElementById('arp-rate');
    const arpRateValueEl = document.getElementById('arp-rate-value');
    const arpToggleBtnCached = document.getElementById('arp-toggle-btn');
    const arpStatusIndicator = document.getElementById('arp-status-indicator');
    const arpStatusText = document.getElementById('arp-status-text');
    const arpExecuteBtn = document.getElementById('arp-execute-btn') || document.getElementById('start-arpeggio-btn') || document.getElementById('send-arp-notes-btn');
    const arpStopBtn = document.getElementById('stop-arpeggio-btn');

    // stato locali per l'esecuzione
    let arpeggiatorCurrentNotes = [];   // array numerico ordinato delle note correnti
    let arpeggiatorPrevNote = null;     // nota attualmente suonata (per arpeggio)
    let arpeggiatorRunning = false;     // true se la sequenza/accordo è in esecuzione
    let arpeggiatorDelay = 500;
    let arpeggiatorLastTick = 0;
    function arpeggiatorRebaseLocal() { arpeggiatorLastTick = performance.now(); }
    window.arpeggiatorRebase = arpeggiatorRebaseLocal;

    // helper: ottieni note selezionate e converti a numeri (una sola volta)
    function collectSelectedNoteNumbers() {
        const checkedCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"].arp-note:checked'));
        const checkedFromKeyboard = Array.from(document.querySelectorAll('input[type="hidden"].arp-note'));
        
        const fromCheckboxes = checkedCheckboxes.map(cb => parseInt(cb.value, 10)).filter(n => !isNaN(n));
        const fromKeyboard = checkedFromKeyboard.map(inp => parseInt(inp.value, 10)).filter(n => !isNaN(n));
        
        return Array.from(new Set([...fromCheckboxes, ...fromKeyboard]));
    }

    // override leggero di getOrderedNotes: accetta già array numerico oppure array stringhe
    function getOrderedNotes(selectedNotes, sequenceType) {
        const notesArray = Array.isArray(selectedNotes) ?
            selectedNotes.map(v => parseInt(v, 10)).filter(n => !isNaN(n)) :
            Array.from(selectedNotes).map(v => parseInt(v, 10)).filter(n => !isNaN(n));
        const sorted = notesArray.slice().sort((a, b) => a - b);

        switch(sequenceType) {
            case 'down':
                return sorted.slice().reverse();
            case 'updown':
                return [...sorted, ...sorted.slice().reverse()];
            case 'random':
                return sorted.slice().sort(() => Math.random() - 0.5);
            case 'asplayed':
                return notesArray;
            case 'up':
            default:
                return sorted;
        }
    }

    // startArpeggiator ora usa arpeggiatorCurrentNotes e arpeggiatorPrevNote
    function startArpeggiator(orderedNotes) {
        if (!orderedNotes || !orderedNotes.length) {
            logMessage('Nessuna nota da riprodurre', 'error');
            return;
        }

        if (!midiOutput && !testMode) {
            logMessage('Nessun dispositivo MIDI connesso', 'error');
            return;
        }

        if (!arpeggiatorActive) {
            logMessage('Attiva l\'arpeggiatore prima di avviare', 'error');
            return;
        }

        stopArpeggiator();

        const channelIndex = arpChannelSelect ? parseInt(arpChannelSelect.value, 10) : 0;
        arpeggiatorCurrentNotes = orderedNotes.slice();
        arpeggiatorIndex = 0;
        arpeggiatorPrevNote = null;
        arpeggiatorRunning = true;

        const delay = calculateArpeggiatorDelay(arpeggiatorRate);

        logMessage(`Arpeggiatore avviato - Rate:${arpeggiatorRate} Delay:${delay}ms Note:${arpeggiatorCurrentNotes.length} Sequenza:${arpeggiatorSequenceType}`, 'success');

        const playStep = () => {
            if (!arpeggiatorRunning || !arpeggiatorCurrentNotes.length) return;

            const currentNote = arpeggiatorCurrentNotes[arpeggiatorIndex];

            if (arpeggiatorPrevNote !== null) {
                sendMidiNoteOff(channelIndex, arpeggiatorPrevNote);
                arpeggiatorPlayingNotes.delete(arpeggiatorPrevNote);
            }

            sendMidiNoteOn(channelIndex, currentNote, 95);
            arpeggiatorPlayingNotes.add(currentNote);
            arpeggiatorPrevNote = currentNote;

            logMessage(`Arpeggio - Nota ${currentNote} (${arpeggiatorIndex+1}/${arpeggiatorCurrentNotes.length})`, 'info');

            arpeggiatorIndex = (arpeggiatorIndex + 1) % arpeggiatorCurrentNotes.length;
        };

        playStep();
        arpeggiatorInterval = robustSetInterval(playStep, delay);
        arpeggiatorDelay = delay;
        arpeggiatorLastTick = performance.now();
        requestWakeLock();
    }

    // stopArpeggiator inviando NoteOff robusti e pulendo stato
    function stopArpeggiator() {
        if (arpeggiatorInterval) {
            robustClearInterval(arpeggiatorInterval);
            arpeggiatorInterval = null;
        }

        const channelIndex = arpChannelSelect ? parseInt(arpChannelSelect.value, 10) : 0;

        if (arpeggiatorPrevNote !== null) {
            sendMidiNoteOff(channelIndex, arpeggiatorPrevNote);
            arpeggiatorPrevNote = null;
        }

        if (arpeggiatorPlayingNotes.size > 0) {
            const notesToStop = Array.from(arpeggiatorPlayingNotes);
            notesToStop.forEach(n => {
                const noteNum = parseInt(n, 10);
                if (!isNaN(noteNum)) sendMidiNoteOff(channelIndex, noteNum);
            });
        }

        arpeggiatorPlayingNotes.clear();
        arpeggiatorCurrentNotes = [];
        arpeggiatorIndex = 0;
        arpeggiatorRunning = false;

        logMessage('✓ Arpeggiatore fermato - Tutte le note arrestate', 'success');
    }
    // esposti per panicAll() (timer robusti)
    window.stopArpeggiatorGlobal = stopArpeggiator;

    // Aggiorna lo stato visuale dell'arpeggiatore
    function updateArpeggiatorStatus() {
        if (!arpStatusIndicator || !arpStatusText) return;

        if (arpeggiatorActive) {
            arpStatusIndicator.classList.remove('inactive');
            arpStatusIndicator.classList.add('active');
            arpStatusText.textContent = 'Attivo';
            if (arpToggleBtnCached) {
                arpToggleBtnCached.classList.add('active');
                arpToggleBtnCached.textContent = 'Disattiva';
            }
        } else {
            arpStatusIndicator.classList.remove('active');
            arpStatusIndicator.classList.add('inactive');
            arpStatusText.textContent = 'Inattivo';
            if (arpToggleBtnCached) {
                arpToggleBtnCached.classList.remove('active');
                arpToggleBtnCached.textContent = 'Attiva';
            }
        }
    }

    // Event listeners Arpeggiatore
    if (arpExecuteBtn) {
        arpExecuteBtn.addEventListener('click', () => {
            if (!arpeggiatorActive) {
                logMessage('Attiva l\'arpeggiatore prima di eseguire', 'error');
                return;
            }

            const notes = collectSelectedNoteNumbers();
            if (!notes.length) {
                logMessage('Seleziona almeno una nota', 'error');
                return;
            }

            const channelIndex = arpChannelSelect ? parseInt(arpChannelSelect.value, 10) : 0;

            if (arpeggiatorMode === 'chord') {
                notes.forEach(n => {
                    sendMidiNoteOn(channelIndex, n, 95);
                    arpeggiatorPlayingNotes.add(n);
                });
                arpeggiatorRunning = true;
                logMessage(`Accordo inviato - Canale:${channelIndex+1} Note:${notes.join(', ')}`, 'success');
            } else {
                const ordered = getOrderedNotes(notes, arpeggiatorSequenceType);
                startArpeggiator(ordered);
            }
        });
    }

    if (arpStopBtn) {
        arpStopBtn.addEventListener('click', () => {
            stopArpeggiator();
        });
    }

    if (arpToggleBtnCached) {
        arpToggleBtnCached.addEventListener('click', () => {
            arpeggiatorActive = !arpeggiatorActive;
            updateArpeggiatorStatus();
            if (!arpeggiatorActive) stopArpeggiator();
        });
    }

    if (arpModeSelect) {
        arpModeSelect.addEventListener('change', (e) => {
            arpeggiatorMode = e.target.value;
            logMessage(`Modalità arpeggiatore: ${arpeggiatorMode}`, 'info');
        });
    }

    if (arpSequenceTypeSelect) {
        arpSequenceTypeSelect.addEventListener('change', (e) => {
            arpeggiatorSequenceType = e.target.value;
            logMessage(`Tipo di sequenza: ${arpeggiatorSequenceType}`, 'info');
        });
    }

    if (arpRateSlider) {
        arpRateSlider.addEventListener('change', (e) => {
            arpeggiatorRate = parseInt(e.target.value, 10);
            if (arpRateValueEl) arpRateValueEl.textContent = arpeggiatorRate;
            logMessage(`Rate arpeggiatore: ${arpeggiatorRate}`, 'info');

            if (arpeggiatorRunning && arpeggiatorMode !== 'chord' && arpeggiatorCurrentNotes.length) {
                const savedIndex = arpeggiatorIndex;
                startArpeggiator(arpeggiatorCurrentNotes);
                arpeggiatorIndex = savedIndex % (arpeggiatorCurrentNotes.length || 1);
            }
        });
    }

    // ===== PIANO KEYBOARD INTERACTION =====
    document.querySelectorAll('.piano-key').forEach(key => {
        key.addEventListener('click', () => {
            const noteValue = key.getAttribute('data-note');
            const noteName = key.getAttribute('data-name');
            
            key.classList.toggle('selected');
            
            let hiddenInput = document.getElementById(`hidden-note-${noteValue}`);
            
            if (key.classList.contains('selected')) {
                if (!hiddenInput) {
                    hiddenInput = document.createElement('input');
                    hiddenInput.id = `hidden-note-${noteValue}`;
                    hiddenInput.type = 'hidden';
                    hiddenInput.value = noteValue;
                    hiddenInput.className = 'arp-note';
                    document.body.appendChild(hiddenInput);
                }
                logMessage(`Nota ${noteName} (${noteValue}) selezionata`, 'info');
            } else {
                if (hiddenInput) {
                    hiddenInput.remove();
                }
                logMessage(`Nota ${noteName} (${noteValue}) deselezionata`, 'info');
            }
        });
    });

    // ===== LIVE TAB: mirror macro -> parametri reali + panic =====
    document.querySelectorAll('input[data-mirror]').forEach(macro => {
        const targetId = macro.getAttribute('data-mirror');
        const target = document.getElementById(targetId);
        const valEl = document.getElementById(macro.id + '-value');
        if (target) macro.value = target.value;
        if (valEl) valEl.textContent = macro.value;
        macro.addEventListener('input', () => {
            if (valEl) valEl.textContent = macro.value;
            if (target) {
                target.value = macro.value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        // doppio tap = reset al default
        macro.addEventListener('dblclick', () => {
            const def = (DEFAULTS && DEFAULTS[targetId]) || macro.getAttribute('value') || 64;
            macro.value = def;
            macro.dispatchEvent(new Event('input', { bubbles: true }));
        });
    });
    const liveSendAll = document.getElementById('live-sendall');
    if (liveSendAll) liveSendAll.addEventListener('click', () => sendAllParameters());
    const livePanic = document.getElementById('live-panic');
    if (livePanic) livePanic.addEventListener('click', () => panicAll());
    const headerPanic = document.getElementById('panic-btn');
    if (headerPanic) headerPanic.addEventListener('click', () => panicAll());
    const livePartLabel = document.getElementById('live-part-label');
    const partSel = document.getElementById('part-select');
    const syncLiveLabel = () => { if (livePartLabel) livePartLabel.textContent = (PARTS[currentPart] || {}).label || currentPart; };
    syncLiveLabel();
    if (partSel) partSel.addEventListener('change', syncLiveLabel);
}

// Ensure init runs even if DOMContentLoaded already fired (dynamic script insertion)
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Defaults object reused
const DEFAULTS = {
    //stato Oscillatore
    'is-active': '0', // 0 = spento, 1 = acceso

    // Oscillator
    'osc-wave': '0',
    'osc-pitch': '64',
    'osc-detune': '64',
    'osc-pw-mod-depth': '64',
    'osc-pw': '64',
    'osc-pitch-env-attack': '0',
    'osc-pitch-env-decay': '0',
    'osc-pitch-env-depth': '64',

    // Filter
    'filter-mode': '0',
    'filter-slope': '0',
    'filter-cutoff': '127',
    'filter-cutoff-keyfollow': '64',
    'filter-resonance': '0',
    'filter-env-attack': '0',
    'filter-env-decay': '0',
    'filter-env-sustain': '127',
    'filter-env-release': '0',
    'filter-env-depth': '64',

    // LFO
    'lfo-shape': '0',
    'lfo-rate': '40',
    'lfo-tempo-sync': '0',
    'lfo-tempo-sync-note': '0',
    'lfo-fade-time': '0',
    'lfo-pitch-depth': '64',
    'lfo-filter-depth': '64',
    'lfo-amp-depth': '64',

    // Mod LFO
    'mod-lfo-shape': '0',
    'mod-lfo-rate': '40',
    'mod-lfo-tempo-sync': '0',
    'mod-lfo-tempo-sync-note': '0',
    'mod-lfo-pitch-depth': '64',
    'mod-lfo-filter-depth': '64',
    'mod-lfo-amp-depth': '64',

    // Amp
    'osc-volume': '64',
    'amp-vel-sens': '64',
    'amp-volume-env-attack': '0',
    'amp-volume-env-decay': '0',
    'amp-volume-env-sustain': '127',
    'amp-volume-env-release': '0',
    'amp-pan': '64',

    // Hidden
    'super-saw-detune': '0',
    'mod-lfo-rate-ctrl': '64'
};

function applyValuesToDom(values) {
    Object.entries(values).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = String(val);
        const valueEl = document.getElementById(`${id}-value`);
        if (valueEl) {
            if (bidirectionalParams.includes(id)) {
                const centerValue = (parseInt(el.min) + parseInt(el.max)) / 2;
                valueEl.textContent = Math.round(parseInt(val) - centerValue);
            } else {
                valueEl.textContent = String(val);
            }
        }
    });
}

function resetAllToDefaults() {
    applyValuesToDom(DEFAULTS);
    sendAllParameters();
}

/*function collectCurrentValues() {
    const values = {};
    document.querySelectorAll('select, input[type="range"]').forEach el => {
        if (el.id && el.id !== 'midi-output-select') values[el.id] = el.value;
    });
    return values;
}*/

function saveCurrentPreset() {
    // Memorizzo l'array dati con i parametri correnti per ciascun oscillatore
    /* saveCurrentOscParams('1');
     saveCurrentOscParams('2');
     saveCurrentOscParams('3');*/    
    const blob = new Blob([JSON.stringify(oscillatorParams, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freevr09b-preset-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function onPresetFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const json = JSON.parse(reader.result);
            oscillatorParams['1'] = json['1'] || {};
            oscillatorParams['2'] = json['2'] || {};
            oscillatorParams['3'] = json['3'] || {};
            // Applica lo stato degli switch per ciascun oscillatore e aggiorna l'hardware
            ['1', '2', '3'].forEach(num => {
                const sw = document.getElementById(`switch${num}`);
                const isActive = oscillatorParams[num] && oscillatorParams[num]['is-active'] === '1';
                if (sw) sw.checked = isActive;              
            });

            // Aggiorna gli stati degli oscillatori
            updateOscillatorStatus();

               // Scegli quale oscillatore mostrare nella UI
            const firstActive = ['1', '2', '3'].find(n => oscillatorParams[n] && oscillatorParams[n]['is-active'] === '1');
            activeOscId = firstActive || '1';

            // Carica SOLO i parametri dell’oscillatore attivo nella UI
            loadOscParams(activeOscId);

            // Invio tutti i parametri per gli oscillatori attivi usando il preset appena caricato
            sendAllParametersForOscillators(oscillatorParams);
        } catch (err) {
            logMessage('Preset non valido: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

// Salva ogni parametro in memoria appena viene modificato
// (gli slider live con data-mirror sono esclusi: inviano tramite il target reale)
document.querySelectorAll('input[type="range"], select').forEach(el => {
    if (el.hasAttribute('data-mirror')) return;
    if (el.id === 'part-select' || el.id === 'arp-midi-channel' || el.id === 'arp-mode' || el.id === 'arp-sequence-type' || el.id === 'arp-rate') return;
    el.addEventListener('input', () => {
        if (el.id && el.id !== 'midi-output-select') {
            if (!parameterAddresses[el.id]) return; // es. select non-synth
            oscillatorParams[activeOscId][el.id] = el.value;
            sendParameterValue(el.id, el.value); // <--- invia subito il parametro MIDI
        }
    });
});

// Event listener per i radio button degli oscillatori
['radioosc1', 'radioosc2', 'radioosc3'].forEach(radioId => {
    const radio = document.getElementById(radioId);
    if (radio) {
        radio.addEventListener('click', () => {
            // RIMUOVI questa riga:
            // saveCurrentOscParams(activeOscId);

            // Aggiorna l'oscillatore attivo con quello appena selezionato
            activeOscId = radio.value;

            // Carica i parametri dell'oscillatore appena selezionato (cliccato)
            loadOscParams(activeOscId);
        });
        // Abilita lo stato iniziale del bordo/stile anche al focus via tastiera/tocco
        radio.addEventListener('change', () => {
            // forza repaint stile CSS dipendente da :checked
            // (nessuna logica aggiuntiva necessaria)
        });
    }
});

// Funzione per salvare tutti i parametri correnti per l'oscillatore attivo
function saveCurrentOscParams(oscId) {
    // salva range/select come prima
    document.querySelectorAll('input[type="range"], select').forEach(el => {
        if (el.id && el.id !== 'midi-output-select') {
            oscillatorParams[oscId][el.id] = el.value;

        }
    });

    // salva lo stato dello switch specifico per questo oscillatore
    const switchEl = document.getElementById(`switch${oscId}`);
    oscillatorParams[oscId]['is-active'] = (switchEl && switchEl.checked) ? '1' : '0';
}

function loadOscParams(oscId) {
    const params = oscillatorParams[oscId];
    if (!params) return;
   
    document.querySelectorAll('input[type="range"], select').forEach(el => {
        if (el.id && el.id !== 'midi-output-select' && params.hasOwnProperty(el.id)) {
            el.value = params[el.id];
            // Aggiorna eventuale visualizzazione del valore
            const valueEl = document.getElementById(`${el.id}-value`);
            if (valueEl) {
                if (bidirectionalParams.includes(el.id)) {
                    const centerValue = (parseInt(el.min) + parseInt(el.max)) / 2;
                    valueEl.textContent = Math.round(parseInt(el.value) - centerValue);
                } else {
                    valueEl.textContent = el.value;
                }
            }
        }
    });
}

// Funzione per mostrare messaggio nella modal
function showPresetStatus(msg) {
    presetStatusMessage.textContent = msg;
    presetStatusMessage.style.display = 'block';
    presetOkBtn.style.display = 'block';
}

// Pulsante OK chiude la modal e resetta il messaggio
if (presetOkBtn) {
    presetOkBtn.addEventListener('click', () => {
        if (presetModal) presetModal.hidden = true;
        if (presetStatusMessage) presetStatusMessage.style.display = 'none';
        presetOkBtn.style.display = 'none';
    });
}

// Quando salvi il preset
if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
        showPresetStatus('Preset salvato correttamente!');
    });
}

// Quando carichi il preset (avviso semplice)
if (presetFileInput) {
    presetFileInput.addEventListener('change', (e) => {
        showPresetStatus('Preset caricato correttamente!');
    });
}



