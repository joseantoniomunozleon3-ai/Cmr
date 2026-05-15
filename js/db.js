// ============================================================
// db.js — IndexedDB local + capa dbAdd/dbAll/dbDel con
//         fallback automático desde Firebase → IndexedDB
// ============================================================

const DB_N  = 'cmr_pro_v5';
const STORE = 'cmr';
const AG    = 'agenda';
const TPL   = 'plantillas';

// Exponer constantes globalmente para que otros módulos las usen
window.DB_STORE = STORE;
window.DB_AG    = AG;
window.DB_TPL   = TPL;

let _db = null;

function openDB() {
    return new Promise((res, rej) => {
        if (_db) { res(_db); return; }
        const r = indexedDB.open(DB_N, 3);
        r.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains(AG))
                db.createObjectStore(AG, { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains(TPL))
                db.createObjectStore(TPL, { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = e => { _db = e.target.result; res(_db); };
        r.onerror   = rej;
    });
}

async function _idbAdd(st, rec) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const r = db.transaction(st, 'readwrite').objectStore(st).add(rec);
        r.onsuccess = e => res(e.target.result);
        r.onerror   = rej;
    });
}

async function _idbAll(st) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const r = db.transaction(st, 'readonly').objectStore(st).getAll();
        r.onsuccess = e => res([...e.target.result].reverse());
        r.onerror   = rej;
    });
}

async function _idbDel(st, id) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const r = db.transaction(st, 'readwrite').objectStore(st).delete(id);
        r.onsuccess = res;
        r.onerror   = rej;
    });
}

async function _idbClear(st) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const r = db.transaction(st, 'readwrite').objectStore(st).clear();
        r.onsuccess = res;
        r.onerror   = rej;
    });
}

// ── Diagnóstico de errores Firebase ──────────────────────────
let _fbErrCount = 0;
let _fbErrTimer = null;

function _fbErrMsg(e, op) {
    const code = e?.code || '';
    if (code === 'unavailable' || code === 'failed-precondition' || e?.message?.includes('network'))
        return 'Sin conexión con el servidor. Los datos se guardarán localmente.';
    if (code === 'permission-denied')
        return 'Acceso denegado. Comprueba las reglas de Firestore.';
    if (code === 'resource-exhausted')
        return 'Cuota de Firestore agotada. Contacta con el administrador.';
    if (code === 'unauthenticated')
        return 'Sesión expirada. Recarga la página.';
    return `Error en base de datos (${op}): ${e?.message || 'desconocido'}`;
}

function _fbSetSync(state) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    if (state === 'ok')      { el.textContent = '🟢'; el.title = 'Sincronizado con Firebase'; }
    if (state === 'offline') { el.textContent = '🟡'; el.title = 'Sin conexión — datos en local'; }
    if (state === 'error')   { el.textContent = '🔴'; el.title = 'Error de sincronización'; }
}

function _handleFbError(e, op) {
    console.warn(`Firebase ${op}:`, e?.code, e?.message);
    _fbErrCount++;
    clearTimeout(_fbErrTimer);
    _fbErrTimer = setTimeout(() => { _fbErrCount = 0; }, 30000);
    if (_fbErrCount === 1) {
        const msg = _fbErrMsg(e, op);
        const isOffline = e?.code === 'unavailable' || !navigator.onLine;
        _fbSetSync(isOffline ? 'offline' : 'error');
        if (window.toast) toast('⚠ ' + msg, 'warn', 5000);
    }
}

// ── Esperar Firebase si no está listo ────────────────────────
function _waitFb() {
    return new Promise(res => {
        if (window._fbReady) { res(); return; }
        document.addEventListener('firebase-ready', res, { once: true });
        setTimeout(res, 3000); // fallback: 3s máximo
    });
}

// ── API pública — Firebase con fallback a IndexedDB ──────────

window.dbAdd = async function(st, rec) {
    await _waitFb();
    if (window._fb) {
        try { const id = await window._fb.add(st, rec); _fbSetSync('ok'); return id; }
        catch (e) { _handleFbError(e, 'add'); }
    }
    return _idbAdd(st, rec);
};

window.dbAll = async function(st) {
    await _waitFb();
    if (window._fb) {
        try { const res = await window._fb.all(st); _fbSetSync('ok'); return res; }
        catch (e) { _handleFbError(e, 'read'); }
    }
    return _idbAll(st);
};

window.dbDel = async function(st, id) {
    await _waitFb();
    if (st === TPL) console.warn('🗑 dbDel en PLANTILLAS id=', id);
    if (window._fb) {
        try { await window._fb.del(st, id); _fbSetSync('ok'); return; }
        catch (e) { _handleFbError(e, 'delete'); }
    }
    return _idbDel(st, id);
};

window.dbClear = async function(st) {
    await _waitFb();
    if (window._fb) {
        try { await window._fb.clear(st); _fbSetSync('ok'); return; }
        catch (e) { _handleFbError(e, 'clear'); }
    }
    return _idbClear(st);
};

// Detectar cambios de conectividad
window.addEventListener('online',  () => { _fbSetSync('ok');      if (window.toast) toast('✓ Conexión restaurada', 'ok', 3000); });
window.addEventListener('offline', () => { _fbSetSync('offline'); if (window.toast) toast('⚠ Sin conexión — modo local activo', 'warn', 5000); });
