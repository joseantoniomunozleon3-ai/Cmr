// ============================================================
// pwa.js — Service Worker inline + Web App Manifest dinámico
// ============================================================

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    const SW_VER = 'cmr-pro-v9';
    const swCode = `
        const CACHE_NAME = '${SW_VER}';
        const ASSETS = [
            location.href,
            'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js',
            'https://cdnjs.cloudflare.com/ajax/libs/signature_pad/4.1.7/signature_pad.umd.min.js'
        ];
        self.addEventListener('install', e => {
            e.waitUntil(caches.open(CACHE_NAME).then(c =>
                Promise.allSettled(ASSETS.map(u => c.add(u).catch(() => {})))
            ));
        });
        self.addEventListener('activate', e => {
            e.waitUntil(
                caches.keys().then(keys => Promise.all(
                    keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
                )).then(() => self.clients.claim())
            );
        });
        self.addEventListener('fetch', e => {
            if (e.request.url.includes('googleapis.com') || e.request.url.includes('firebase')) return;
            e.respondWith(
                caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
                    if (res && res.status === 200 && e.request.method === 'GET') {
                        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
                    }
                    return res;
                }).catch(() => caches.match(e.request)))
            );
        });
        self.addEventListener('message', e => {
            if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
        });
    `;

    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl  = URL.createObjectURL(swBlob);
    let _pendingSW = null;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register(swUrl).then(reg => {
            if (reg.waiting) { _pendingSW = reg.waiting; _showUpdateBanner(); }
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                if (!nw) return;
                nw.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                        _pendingSW = nw; _showUpdateBanner();
                    }
                });
            });
            navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
            setInterval(() => reg.update(), 30 * 60 * 1000);
        }).catch(err => console.warn('SW Error:', err));
    });

    window._applyUpdate = () => { if (_pendingSW) _pendingSW.postMessage({ type: 'SKIP_WAITING' }); };

    function _showUpdateBanner() {
        if (document.getElementById('_upd_banner')) return;
        const b = document.createElement('div');
        b.id = '_upd_banner';
        b.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f2e8a;color:#fff;border:1.5px solid #4f83f7;border-radius:12px;padding:10px 16px;z-index:9998;display:flex;align-items:center;gap:10px;font-family:Sora,sans-serif;font-size:.8rem;font-weight:500;box-shadow:0 4px 24px rgba(26,79,214,.4);max-width:calc(100% - 32px)';
        b.innerHTML = '<span>🔄 Nueva versión disponible</span>'
            + '<button onclick="window._applyUpdate();this.closest(\'#_upd_banner\').remove()" style="background:#4f83f7;border:none;color:#fff;padding:5px 12px;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:Sora,sans-serif">Actualizar</button>'
            + '<button onclick="this.closest(\'#_upd_banner\').remove()" style="background:none;border:none;color:rgba(255,255,255,.6);cursor:pointer;font-size:1rem">✕</button>';
        document.body.appendChild(b);
    }
}

// ── Web App Manifest dinámico ─────────────────────────────────
(function () {
    const canvas = document.createElement('canvas');
    canvas.width  = 512; canvas.height = 512;
    const ctx  = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#1a4fd6'); grad.addColorStop(1, '#0f2e8a');
    ctx.fillStyle = grad;
    const r = 100;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(512 - r, 0); ctx.quadraticCurveTo(512, 0, 512, r);
    ctx.lineTo(512, 512 - r); ctx.quadraticCurveTo(512, 512, 512 - r, 512);
    ctx.lineTo(r, 512); ctx.quadraticCurveTo(0, 512, 0, 512 - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 150px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CMR', 256, 256);
    const iconURL = canvas.toDataURL('image/png');

    const manifest = {
        id: '/cmr-manager-pro',
        name: 'CMR Manager Pro',
        short_name: 'CMR Pro',
        start_url: location.pathname + '?pwa=1',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f1e2e',
        theme_color: '#2563eb',
        lang: 'es',
        icons: [
            { src: iconURL, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: iconURL, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: iconURL, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const link = document.createElement('link');
    link.rel  = 'manifest';
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);

    // Apple touch icon
    const appleLink = document.createElement('link');
    appleLink.rel  = 'apple-touch-icon';
    appleLink.href = iconURL;
    document.head.appendChild(appleLink);
})();
