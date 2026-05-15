// ============================================================
// auth.js — Autenticación con Firebase Auth (email/contraseña)
// ============================================================
// La primera vez que alguien entra, se crea la cuenta en
// Firebase Auth automáticamente. Las siguientes, signIn.
// El bloqueo por inactividad sigue siendo local (15 min).
// ============================================================

import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const auth = getAuth(getApp());

const LOCK_TTL     = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000;

let _inactivityTimer;
let _attempts    = 0;
let _lockedUntil = 0;

// ── UI helpers ─────────────────────────────────────────────
function _showLoginScreen() {
    document.getElementById('load-bar').style.display     = 'none';
    document.getElementById('app-body').style.display     = 'none';
    document.getElementById('lock-overlay').classList.remove('on');
    document.getElementById('login-screen').style.display = 'flex';
    setTimeout(() => document.getElementById('ls-user')?.focus(), 100);
}

function _showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('lock-overlay').classList.remove('on');
    document.getElementById('load-bar').style.display     = 'none';
    document.getElementById('app-body').style.display     = 'block';
    window._authOk = true;
    _resetInactivity();
    if (window._appInit && !window._appInited) {
        window._appInited = true;
        window._appInit();
    }
}

function _showLock() {
    document.getElementById('lock-overlay').classList.add('on');
    document.getElementById('lock-pass').value = '';
    document.getElementById('lockErr').style.display = 'none';
    setTimeout(() => document.getElementById('lock-pass')?.focus(), 100);
}

function _showErr(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _hideErr(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

// ── Inactividad ────────────────────────────────────────────
function _resetInactivity() {
    clearTimeout(_inactivityTimer);
    _inactivityTimer = setTimeout(() => _showLock(), LOCK_TTL);
}

['click', 'keydown', 'touchstart', 'scroll'].forEach(ev =>
    document.addEventListener(ev, () => { if (window._authOk) _resetInactivity(); }, { passive: true })
);

// ── Errores Firebase → español ─────────────────────────────
function _fbAuthMsg(code) {
    const map = {
        'auth/user-not-found':         null,
        'auth/wrong-password':         'Contraseña incorrecta.',
        'auth/invalid-credential':     null,
        'auth/invalid-email':          'El email no es válido.',
        'auth/email-already-in-use':   'Este email ya tiene una cuenta.',
        'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
        'auth/too-many-requests':      'Demasiados intentos. Espera unos minutos.',
        'auth/network-request-failed': 'Sin conexión. Comprueba internet.',
        'auth/user-disabled':          'Esta cuenta ha sido deshabilitada.',
    };
    return (code in map) ? map[code] : 'Error: ' + code;
}

// ── Login ──────────────────────────────────────────────────
window._doLogin = async function () {
    const now = Date.now();
    if (now < _lockedUntil) {
        const secs = Math.ceil((_lockedUntil - now) / 1000);
        _showErr('loginErr', `Demasiados intentos. Espera ${secs}s.`);
        return;
    }

    const rawUser = (document.getElementById('ls-user').value || '').trim();
    const pass    =  document.getElementById('ls-pass').value  || '';

    if (!rawUser || !pass) { _showErr('loginErr', 'Rellena email y contraseña.'); return; }

    // Permite usar "usuario" simple o email completo
    const email = rawUser.includes('@') ? rawUser : rawUser + '@cmrpro.app';

    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = '…';

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        _attempts = 0;
        document.getElementById('ls-attempts').textContent = '';
        _hideErr('loginErr');
    } catch (e) {
        const code = e.code || '';
        // Usuario no existe → crear automáticamente (primera vez)
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, pass);
                _attempts = 0; _hideErr('loginErr');
                btn.disabled = false; btn.textContent = 'Entrar';
                return;
            } catch (e2) {
                _showErr('loginErr', _fbAuthMsg(e2.code) || 'Error al crear cuenta.');
                btn.disabled = false; btn.textContent = 'Entrar';
                return;
            }
        }

        _attempts++;
        if (_attempts >= MAX_ATTEMPTS) {
            _lockedUntil = Date.now() + LOCKOUT_MS; _attempts = 0;
            _showErr('loginErr', `${MAX_ATTEMPTS} intentos fallidos. Bloqueado 5 min.`);
        } else {
            _showErr('loginErr', _fbAuthMsg(code) || 'Usuario o contraseña incorrectos.');
            const left = MAX_ATTEMPTS - _attempts;
            document.getElementById('ls-attempts').textContent =
                `${left} intento${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}`;
        }
        document.getElementById('ls-pass').value = '';
        document.getElementById('ls-pass')?.focus();
    }

    btn.disabled = false; btn.textContent = 'Entrar';
};

// ── Desbloquear ────────────────────────────────────────────
window._doUnlock = async function () {
    const pass = document.getElementById('lock-pass').value || '';
    if (!pass) return;
    const user = auth.currentUser;
    if (!user) { _showLoginScreen(); return; }
    const btn = document.getElementById('unlockBtn');
    btn.disabled = true; btn.textContent = '…';
    try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pass));
        _hideErr('lockErr'); _showApp();
    } catch (e) {
        _showErr('lockErr', 'Contraseña incorrecta.');
        document.getElementById('lock-pass').value = '';
        document.getElementById('lock-pass')?.focus();
    }
    btn.disabled = false; btn.textContent = 'Desbloquear';
};

// ── Cerrar sesión ──────────────────────────────────────────
window._logout = async function () {
    if (!confirm('¿Cerrar sesión?')) return;
    clearTimeout(_inactivityTimer);
    window._authOk = false; window._appInited = false;
    await signOut(auth);
    _showLoginScreen();
};

// ── Cambiar contraseña ─────────────────────────────────────
window._changeCredentials = async function () {
    const oldPass  = (document.getElementById('cfgOldPass')  || {value:''}).value;
    const newPass  = (document.getElementById('cfgNewPass')  || {value:''}).value;
    const newPass2 = (document.getElementById('cfgNewPass2') || {value:''}).value;

    if (!oldPass || !newPass || !newPass2) { toast('Rellena todos los campos', 'err'); return; }
    if (newPass !== newPass2)              { toast('Las contraseñas no coinciden', 'err'); return; }
    if (newPass.length < 6)               { toast('Mínimo 6 caracteres', 'err'); return; }

    const user = auth.currentUser;
    if (!user) { toast('No hay sesión activa', 'err'); return; }
    try {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPass));
        await updatePassword(user, newPass);
        toast('✓ Contraseña actualizada', 'ok');
        ['cfgOldPass','cfgNewPass','cfgNewPass2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } catch (e) {
        toast(_fbAuthMsg(e.code) || 'Error al cambiar contraseña.', 'err');
    }
};

// ── Observer de estado Firebase ────────────────────────────
// Único punto de verdad: Firebase dice si hay sesión o no.
onAuthStateChanged(auth, user => {
    document.getElementById('load-bar').style.display = 'none';
    if (user) {
        window._firebaseUser = user;
        const locked = document.getElementById('lock-overlay').classList.contains('on');
        if (!locked) _showApp();
    } else {
        window._authOk = false; window._appInited = false; window._firebaseUser = null;
        clearTimeout(_inactivityTimer);
        _showLoginScreen();
    }
});
