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
const menuLogs = document.getElementById('menu-logs');
const savePresetBtn = document.getElementById('save-preset-btn');
const loadPresetBtn = document.getElementById('load-preset-btn');
const presetFileInput = document.getElementById('preset-file-input');

rdosc1.disabled = true;
rdosc2.disabled = true;
rdosc3.disabled = true;

// MIDI variables
let testMode = true; // Flag per abilitare la modalità test
console.log('TestMode:', testMode);
let midiAccess = null;
let midiOutput = null;
const ROLAND_MANUFACTURER_ID = 0x41;
const DEVICE_ID = 0x10;
const MODEL_ID = [0x00, 0x00, 0x71];
const COMMAND_ID = 0x12;
const UPPER_ID = [0x19, 0x41];
OSCILLATOR_ID = 0x00;


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
    'amp-volume-env-attack': 0x17,
    'amp-volume-env-decay': 0x18,
    'amp-volume-env-sustain': 0x19,
    'amp-volume-env-release': 0x1A,
    'amp-pan': 0x1B
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
    'mod-lfo-pitch-depth', 'mod-lfo-filter-depth', 'mod-lfo-amp-depth'
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

// Send parameter value to VR-09B
function sendParameterValue(paramId, value, oscIdOverride) {
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
        // Determina l'ID dell'oscillatore: override > radio selezionata > errore
        let targetOscId = null;
        if (oscIdOverride !== undefined && oscIdOverride !== null) {
            targetOscId = String(oscIdOverride);
        } else {
            const oscSelected = document.querySelectorAll('input[name="osc-wave-variation"]:checked');
            if (oscSelected.length === 0) {
                logMessage('Nessun oscillatore selezionato', 'error');
                return false;
            }
            targetOscId = oscSelected[0].value;
        }

        const sysexMessage = [
            0xF0,
            ROLAND_MANUFACTURER_ID,
            DEVICE_ID,
            ...MODEL_ID,
            COMMAND_ID,
            ...UPPER_ID,
            targetOscId,
            address,
            parseInt(value),
            0x00,
            0xF7
        ];

        // Calcolo checksum
        let checksum = 0;
        for (let i = 1; i < sysexMessage.length - 2; i++) {
            checksum += sysexMessage[i];
        }
        checksum = 128 - (checksum % 128);
        sysexMessage[sysexMessage.length - 2] = checksum;

        if (testMode) {
            console.log('TestMode: SysEx generato:', formatSysEx(sysexMessage));
        } else {
            midiOutput.send(new Uint8Array(sysexMessage));
            logMessage(`Parametro inviato: ${paramId} = ${value} - ` + formatSysEx(sysexMessage), 'info');
        }

        return true;
    } catch (error) {
        logMessage(`Errore nell'invio del parametro: ${error.message}`, 'error');
        return false;
    }
}

// accende o spegne l'oscilallatore
function setOscOn(osc, status) {

    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return false;
    }
    const address = 0x00;

    OSCILLATOR_ID = parseInt(osc);
    try {

        // Format for Roland system exclusive message
        // F0 41 10 00 00 00 0F address value checksum F7
        const sysexMessage = [
            0xF0,                // Start of SysEx
            ROLAND_MANUFACTURER_ID, // Roland ID
            DEVICE_ID,          // Device ID
            ...MODEL_ID,        // Model ID
            COMMAND_ID, 		//Command ID
            ...UPPER_ID,			//upper 1941
            address,      // 0x00 address for oscillator on/off
            OSCILLATOR_ID,            // Oscillator ID
            parseInt(status),    // Parameter value
            0x00,               // Checksum placeholder
            0xF7                // End of SysEx
        ];

        // Calculate checksum (Roland format)
        let checksum = 0;
        for (let i = 1; i < sysexMessage.length - 2; i++) {
            checksum += sysexMessage[i];
        }
        checksum = 128 - (checksum % 128);
        sysexMessage[sysexMessage.length - 2] = checksum;

        if (testMode) {
            console.log('TestMode: SysEx generato:', formatSysEx(sysexMessage));
            return true;
        }

        // Send the message                                      
        midiOutput.send(new Uint8Array(sysexMessage));
        logMessage(`Oscillatore: ${osc} = ` + formatSysEx(sysexMessage), 'info');
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

// Core logic to send all parameters (callable without UI effects)
function sendAllParameters() {
    if (!midiOutput && !testMode) {
        logMessage('Nessun dispositivo MIDI connesso', 'error');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    // invia i valori attuali della UI per l'oscillatore selezionato
    document.querySelectorAll('select, input[type="range"]').forEach(element => {
        if (element.id !== 'midi-output-select') {
            const result = sendParameterValue(element.id, element.value);
            if (result) successCount++; else failCount++;
        }
    });

    logMessage(`Invio completato: ${successCount} parametri inviati, ${failCount} falliti`,
        failCount > 0 ? 'error' : 'success');
}

// Map oscillatore numerico (1/2/3) a ID SysEx usati nel progetto
function mapOscNumberToSysExId(oscNumber) {
    // valori usati nelle altre parti del codice: '25','27','29'
    switch (String(oscNumber)) {
        case '1': return '25';
        case '2': return '27';
        case '3': return '29';
        default: return '25';
    }
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
        setOscOn('25', '1');
    } else {
        rdosc1.disabled = true;
        rdosc1.setAttribute('disabled', '');
        setOscOn('25', '0');
    }
    if (osc2) {
        rdosc2.disabled = false;
        rdosc2.removeAttribute('disabled');
        setOscOn('27', '1');
    }
    else {
        rdosc2.disabled = true;
        rdosc2.setAttribute('disabled', '');
        setOscOn('27', '0');

    }
    if (osc3) {
        rdosc3.disabled = false;
        rdosc3.removeAttribute('disabled');
        setOscOn('29', '1');

    }
    else {
        rdosc3.disabled = true;
        rdosc3.setAttribute('disabled', '');
        setOscOn('29', '0');

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
// Imposta i parametri dell'oscillatore attivo all'avvio
window.addEventListener('DOMContentLoaded', () => {
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
            if (e.key === 'Escape' && !menuDropdown.hidden) close();
        });
    }
    if (menuConnect) menuConnect.addEventListener('click', () => connectBtn.click());
    if (menuReset) menuReset.addEventListener('click', () => resetAllToDefaults());
    if (menuSendAll) menuSendAll.addEventListener('click', () => sendAllParameters());
    if (menuPresets) menuPresets.addEventListener('click', () => { if (presetModal) presetModal.hidden = false; });
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
});
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
    'amp-volume-env-attack': '0',
    'amp-volume-env-decay': '0',
    'amp-volume-env-sustain': '127',
    'amp-volume-env-release': '0',
    'amp-pan': '64'
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
    console.log('Preset salvato:', oscillatorParams);
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
document.querySelectorAll('input[type="range"], select').forEach(el => {
    el.addEventListener('input', () => {
        if (el.id && el.id !== 'midi-output-select') {
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
presetOkBtn.addEventListener('click', () => {
    presetModal.hidden = true;
    presetStatusMessage.style.display = 'none';
    presetOkBtn.style.display = 'none';
});

// Quando salvi il preset
savePresetBtn.addEventListener('click', () => {
    // ...salvataggio preset...
    showPresetStatus('Preset salvato correttamente!');
});

// Quando carichi il preset
presetFileInput.addEventListener('change', (e) => {
    // ...caricamento preset...
    showPresetStatus('Preset caricato correttamente!');
});