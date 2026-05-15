// ============================================================
// autosave.js — Borrador automático en localStorage
// ============================================================

const DRAFT_KEY = 'cmr_draft_v1';
let _autosaveTimer  = null;
let _lastDraftHash  = null;

function _draftHash(data) {
    return JSON.stringify(data).length + '_' + (data.docNum || '') + '_' + (data.rcvBlock || '').slice(0, 20);
}

window.saveDraft = function () {
    try {
        const data = collect();
        const hash = _draftHash(data);
        if (hash === _lastDraftHash) return;
        _lastDraftHash = hash;
        data._draftSavedAt = new Date().toISOString();
        localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
        showAutosaveBar('saved', 'BORRADOR GUARDADO · ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
        console.warn('Autoguardado fallido:', e);
    }
};

window.loadDraft = function () {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data._draftSavedAt) return false;
        const age = (Date.now() - new Date(data._draftSavedAt)) / 1000;
        if (age > 86400) { localStorage.removeItem(DRAFT_KEY); return false; }
        return data;
    } catch (e) { return false; }
};

window.clearDraft = function () {
    localStorage.removeItem(DRAFT_KEY);
    _lastDraftHash = null;
};

window.showAutosaveBar = function (state, msg) {
    const bar = document.getElementById('autosave-bar');
    const txt = document.getElementById('autosave-txt');
    if (!bar || !txt) return;
    bar.className = 'visible ' + state;
    txt.textContent = msg;
    clearTimeout(bar._hideTimer);
    bar._hideTimer = setTimeout(() => { bar.classList.remove('visible'); }, 3000);
};

window.scheduleAutosave = function () {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = setTimeout(saveDraft, 8000);
    const bar = document.getElementById('autosave-bar');
    const txt = document.getElementById('autosave-txt');
    if (bar && txt) { bar.className = 'visible saving'; txt.textContent = 'GUARDANDO BORRADOR…'; }
};

// Escuchar cambios en el panel del formulario
function attachAutosaveListeners() {
    const panel = document.getElementById('panel-form');
    if (!panel) return;
    panel.addEventListener('input', scheduleAutosave);
    panel.addEventListener('change', scheduleAutosave);
    // Forzar mayúsculas en matrículas
    ['plateTractor', 'plateTrailer'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
            const pos = this.selectionStart;
            this.value = this.value.toUpperCase();
            this.setSelectionRange(pos, pos);
        });
    });
}

// Autoguardado periódico cada 30s
setInterval(saveDraft, 30000);

// Exponer para que app.js llame a attachAutosaveListeners tras init
window._attachAutosaveListeners = attachAutosaveListeners;
