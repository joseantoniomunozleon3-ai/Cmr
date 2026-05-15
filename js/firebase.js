// ============================================================
// firebase.js — Configuración Firebase + operaciones Firestore
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, collection, doc, addDoc, getDocs,
    deleteDoc, query, orderBy, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCjVZeDvoGdkyFHveyuEz4Y3Uqbb_6hhVo",
    authDomain: "palets-camara.firebaseapp.com",
    projectId: "palets-camara",
    storageBucket: "palets-camara.firebasestorage.app",
    messagingSenderId: "1098382045283",
    appId: "1:1098382045283:web:ae2d07e0d92dba35aa4856"
};

// IMPORTANTE: En console.firebase.google.com → Authentication → Sign-in method → Email/Password → Activar
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Mapeo de stores locales a colecciones Firestore
const COL = { cmr: 'cmr_docs', plantillas: 'cmr_plantillas', agenda: 'cmr_agenda' };

window._fb = {
    add: async (store, rec) => {
        const col = COL[store] || store;
        rec = { ...rec, _fbUpdated: new Date().toISOString() };
        const ref = await addDoc(collection(db, col), rec);
        return ref.id;
    },
    all: async (store) => {
        const col = COL[store] || store;
        if (store === 'plantillas') {
            try {
                const snap = await getDocs(collection(db, col));
                const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }));
                return docs.sort((a, b) => (b.savedAt || '') > (a.savedAt || '') ? 1 : -1);
            } catch (e) {
                console.error('Error leyendo plantillas de Firestore:', e);
                return [];
            }
        }
        const snap = await getDocs(query(collection(db, col), orderBy('savedAt', 'desc')));
        return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    del: async (store, id) => {
        const col = COL[store] || store;
        await deleteDoc(doc(db, col, String(id)));
    },
    clear: async (store) => {
        const col = COL[store] || store;
        const snap = await getDocs(collection(db, col));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
};

window._fbReady = true;

// Indicador de sincronización
const syncEl = document.getElementById('syncIndicator');
if (syncEl) { syncEl.textContent = '🟢'; syncEl.title = 'Sincronizado con Firebase'; }

// Escuchar cambios en tiempo real
onSnapshot(collection(db, 'cmr_docs'), () => {
    if (document.querySelector('.tab[data-p="hist"]')?.classList.contains('active')) {
        if (window.renderHist) window.renderHist();
    }
    if (window.updateHistBadge) window.updateHistBadge();
});

onSnapshot(collection(db, 'cmr_plantillas'), (snap) => {
    if (document.querySelector('.tab[data-p="tmpl"]')?.classList.contains('active')) {
        if (window.renderTemplates) window.renderTemplates();
    }
    const n = snap.docs.length;
    if (window._lastTplCount !== undefined && n < window._lastTplCount) {
        console.warn('⚠ Plantillas reducidas de', window._lastTplCount, 'a', n);
    }
    window._lastTplCount = n;
});

onSnapshot(collection(db, 'cmr_agenda'), () => {
    if (window.renderRcvQF) window.renderRcvQF();
    if (window.renderDrvQF) window.renderDrvQF();
    if (document.querySelector('.tab[data-p="agenda"]')?.classList.contains('active')) {
        if (window.renderAgenda) window.renderAgenda();
    }
});
