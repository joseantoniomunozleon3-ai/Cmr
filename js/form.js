// ============================================================
// form.js — Formulario, historial, agenda, plantillas, backup
// ============================================================

// ── Variables globales ────────────────────────────────────────
let sigPad, sigPadSender;
window.logoDataURL = null;
let goodsLineId = 0;
let succId = 0;

const STORE = window.DB_STORE || 'cmr';
const AG    = window.DB_AG    || 'agenda';
const TPL   = window.DB_TPL   || 'plantillas';

// ── UI helpers ────────────────────────────────────────────────
window.toast = function(msg, type = '', dur = 3200) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'toast ' + type;
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on')));
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('on'), dur);
};

window.showOv = (v, txt = 'GENERANDO PDF…') => {
    document.getElementById('ov').classList.toggle('on', v);
    document.getElementById('ovTxt').textContent = txt;
};

window.showBS = function(title, bodyHTML, actions = []) {
    document.getElementById('bsTitle').textContent = title;
    document.getElementById('bsBody').innerHTML    = bodyHTML;
    const ac = document.getElementById('bsActs');
    ac.innerHTML = actions.map((a, i) => `<button class="bsa ${a.cls || ''}" data-bsi="${i}">${a.label}</button>`).join('');
    ac.querySelectorAll('button[data-bsi]').forEach(btn => {
        const a = actions[parseInt(btn.dataset.bsi)];
        btn.addEventListener('click', () => { if (typeof a.fn === 'function') a.fn(); });
    });
    document.getElementById('bs-bg').classList.add('on');
};

window.closeBS = () => document.getElementById('bs-bg').classList.remove('on');
document.getElementById('bs-bg')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeBS(); });

// ── Tabs ──────────────────────────────────────────────────────
window.tab = function(n) {
    document.querySelectorAll('.tab').forEach(t => {
        const active = t.dataset.p === n;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + n));
    if (n === 'hist')   renderHist();
    if (n === 'agenda') renderAgenda();
    if (n === 'tmpl')   renderTemplates();
    if (n === 'cfg')    syncCfgPanel();
};

// ── Field helpers ─────────────────────────────────────────────
const gv   = id => (document.getElementById(id) || {}).value?.trim() || '';
const gvUp = id => gv(id).toUpperCase();
const sv   = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };

const FIELDS = ['docNum','docDate','placeEmission','docsAnexos','senderBlock','rcvBlock',
    'placeLoading','placeDelivery','dateDelivery','clientRef','carrierBlock','driverName',
    'driverDNI','plateTractor','plateTrailer','senderInstr','freightTerms','codAmount',
    'observations','tipoDoc','gl-free-1','gl-free-2','eurosCargados','eurosDevueltos'];

window.collect = function() {
    const d = { savedAt: new Date().toISOString() };
    FIELDS.forEach(f => { d[f] = gv(f); });
    d['plateTractor'] = (d['plateTractor'] || '').toUpperCase();
    d['plateTrailer'] = (d['plateTrailer'] || '').toUpperCase();
    d.goodsLines = collectGoodsLines();
    d.successiveCarriers = collectSuccessiveCarriers();
    const compressSig = (pad) => {
        if (!pad || pad.isEmpty()) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 300, 120);
        ctx.drawImage(pad.canvas, 0, 0, 300, 120);
        return canvas.toDataURL('image/jpeg', 0.7);
    };
    d.sigDriver = compressSig(sigPad);
    d.sigSender = compressSig(sigPadSender);
    return d;
};

window.fill = function(d) {
    FIELDS.forEach(f => sv(f, d[f] || ''));
    try { fillGoodsLines(d.goodsLines || []); } catch (e) {}
    try { fillSuccessiveCarriers(d.successiveCarriers || []); } catch (e) {}
};

// ── Firmas ────────────────────────────────────────────────────
window.initSig = function() {
    const c = document.getElementById('sigCanvas'), w = document.getElementById('sigWrap');
    if (c && w && typeof SignaturePad !== 'undefined') {
        const pr = window.devicePixelRatio || 1;
        c.width = w.offsetWidth * pr; c.height = 220 * pr; c.style.height = '220px';
        const ctx = c.getContext('2d'); ctx.scale(pr, pr);
        sigPad = new SignaturePad(c, { backgroundColor: 'rgba(0,0,0,0)', penColor: '#1e3a8a', minWidth: 2, maxWidth: 3.5, throttle: 16 });
        sigPad.addEventListener('beginStroke', () => { document.getElementById('sigHint').style.opacity = '0'; });
    }
    const c2 = document.getElementById('sigCanvasSender'), w2 = document.getElementById('sigWrapSender');
    if (c2 && w2 && typeof SignaturePad !== 'undefined') {
        const pr2 = window.devicePixelRatio || 1;
        c2.width = w2.offsetWidth * pr2; c2.height = 220 * pr2; c2.style.height = '220px';
        const ctx2 = c2.getContext('2d'); ctx2.scale(pr2, pr2);
        sigPadSender = new SignaturePad(c2, { backgroundColor: 'rgba(0,0,0,0)', penColor: '#1e3a8a', minWidth: 2, maxWidth: 3.5, throttle: 16 });
        sigPadSender.addEventListener('beginStroke', () => { document.getElementById('sigHintSender').style.opacity = '0'; });
    }
};

window.clearSig = () => { if (sigPad) sigPad.clear(); document.getElementById('sigHint').style.opacity = '1'; };
window.clearSigSender = () => { if (sigPadSender) sigPadSender.clear(); document.getElementById('sigHintSender').style.opacity = '1'; };

window.addEventListener('resize', () => {
    const d = sigPad?.toData() || [], d2 = sigPadSender?.toData() || [];
    initSig();
    if (d.length && sigPad) sigPad.fromData(d);
    if (d2.length && sigPadSender) sigPadSender.fromData(d2);
});

// ── Numeración ────────────────────────────────────────────────
window.genDocNum = function() {
    const cfg = JSON.parse(localStorage.getItem('cmr_cfg') || '{}');
    const prefix = cfg.prefix || 'CMR';
    const now = new Date();
    const dateStr = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const albaran = gv('docsAnexos').replace(/\D/g, '');
    const suffix  = albaran ? albaran.slice(-4).padStart(4, '0') : '0000';
    return prefix + '-' + dateStr + '-' + suffix;
};

window.updateDocNum = function() {
    const inp = document.getElementById('docNum');
    if (inp && !inp.readOnly) return;
    const current = gv('docNum');
    const autoPattern = /^[A-Z0-9]+-\d{6,8}-\d+$/;
    if (!current || autoPattern.test(current)) sv('docNum', genDocNum());
};

window.toggleDocNumLock = function() {
    const inp = document.getElementById('docNum');
    const btn = document.getElementById('docNumLockBtn');
    if (!inp || !btn) return;
    const isLocked = inp.readOnly;
    inp.readOnly = !isLocked;
    inp.style.background = isLocked ? '#fff' : '#f7f9fc';
    inp.style.color  = isLocked ? '' : 'var(--dim)';
    inp.style.cursor = isLocked ? '' : 'not-allowed';
    btn.textContent  = isLocked ? '✏️ manual' : '🔒 auto';
    if (!isLocked) { sv('docNum', genDocNum()); }
    if (isLocked) inp.focus();
};

window.onTipoDocChange = () => updateDocNum();

window.updateNumPreview = function() {
    const el = document.getElementById('numPreview'); if (!el) return;
    const prefix = gv('cfgPrefix') || 'CMR';
    const now = new Date();
    el.textContent = 'Ejemplo: ' + prefix + '-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-XXXX (4 últimas cifras del albarán)';
};

document.addEventListener('input', e => { if (e.target.id === 'cfgPrefix') updateNumPreview(); });

// ── Configuración / Defaults ──────────────────────────────────
window.saveDefaults = function() {
    const cfg = JSON.parse(localStorage.getItem('cmr_cfg') || '{}');
    Object.assign(cfg, { senderBlock: gv('senderBlock'), carrierBlock: gv('carrierBlock'), placeEmission: gv('placeEmission') });
    localStorage.setItem('cmr_cfg', JSON.stringify(cfg));
    showBadges(true); toast('✓ Remitente y transportista guardados', 'ok');
};

window.saveCfg = function() {
    const cfg = JSON.parse(localStorage.getItem('cmr_cfg') || '{}');
    Object.assign(cfg, { senderBlock: gv('cfgSenderBlock'), carrierBlock: gv('cfgCarrierBlock'), placeEmission: gv('cfgEmission'), prefix: gv('cfgPrefix') || 'CMR' });
    localStorage.setItem('cmr_cfg', JSON.stringify(cfg));
    loadDefaults(); toast('✓ Configuración guardada', 'ok');
};

window.loadDefaults = function() {
    const cfg = JSON.parse(localStorage.getItem('cmr_cfg') || '{}');
    if (!cfg.seq) { cfg.seq = 1; localStorage.setItem('cmr_cfg', JSON.stringify(cfg)); }
    if (cfg.senderBlock)  sv('senderBlock',  cfg.senderBlock);
    if (cfg.carrierBlock) sv('carrierBlock', cfg.carrierBlock);
    if (cfg.placeEmission) sv('placeEmission', cfg.placeEmission);
    if (!gv('docDate')) sv('docDate', new Date().toISOString().split('T')[0]);
    if (!gv('docNum'))  sv('docNum', genDocNum());
    if (!gv('tipoDoc')) sv('tipoDoc', 'cmr');
    if (cfg.senderBlock || cfg.carrierBlock) showBadges(true);
    window.logoDataURL = localStorage.getItem('cmr_logo') || null;
    if (window.logoDataURL) showLogoPreview(window.logoDataURL);
};

window.syncCfgPanel = function() {
    const cfg = JSON.parse(localStorage.getItem('cmr_cfg') || '{}');
    sv('cfgSenderBlock', cfg.senderBlock); sv('cfgCarrierBlock', cfg.carrierBlock);
    sv('cfgEmission', cfg.placeEmission);  sv('cfgPrefix', cfg.prefix || 'CMR');
    updateNumPreview();
};

window.showBadges = v => {
    document.getElementById('bs-sender').style.display  = v ? 'block' : 'none';
    document.getElementById('bs-carrier').style.display = v ? 'block' : 'none';
};

// ── Logo ──────────────────────────────────────────────────────
window.loadLogo = function(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { window.logoDataURL = ev.target.result; localStorage.setItem('cmr_logo', window.logoDataURL); showLogoPreview(window.logoDataURL); toast('✓ Logo cargado', 'ok'); };
    r.readAsDataURL(f);
};
window.showLogoPreview = src => { document.getElementById('logoPreview').innerHTML = `<img src="${src}"/>`; };
window.removeLogo = () => { window.logoDataURL = null; localStorage.removeItem('cmr_logo'); document.getElementById('logoPreview').innerHTML = '<span>+ Logo</span>'; toast('Logo eliminado', 'warn'); };

// ── Nuevo CMR ─────────────────────────────────────────────────
window.newCMR = window.doNewCMR = function() {
    closeBS();
    FIELDS.forEach(id => sv(id, ''));
    sv('freightTerms', 'PORT PAGADO');
    sv('tipoDoc', 'cmr');
    fillGoodsLines([]); fillSuccessiveCarriers([]);
    clearSig(); clearSigSender();
    sv('docNum', genDocNum());
    sv('docDate', new Date().toISOString().split('T')[0]);
    clearDraft(); tab('form'); toast('✓ Formulario limpio', 'ok');
};

// ── Líneas de mercancía ───────────────────────────────────────
window.addGoodsLine = function(data = {}) {
    const id = ++goodsLineId;
    const container = document.getElementById('goods-lines');
    const div = document.createElement('div'); div.id = 'gl-' + id;
    div.style.cssText = 'background:var(--bg);border:1px solid var(--line);border-radius:var(--r3);padding:11px 12px;margin-bottom:8px;position:relative';
    div.innerHTML = `<button onclick="removeGoodsLine(${id})" style="position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:5px;border:1px solid rgba(244,63,94,.3);background:rgba(244,63,94,.08);color:var(--rose-l);font-size:.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
    <div style="font-size:.6rem;color:var(--dim);font-family:'JetBrains Mono',monospace;margin-bottom:8px">LÍNEA ${id}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div class="fr" style="margin-bottom:0"><label>6 Marca</label><input type="text" id="gl-marks-${id}" value="${data.marks || ''}"/></div>
      <div class="fr" style="margin-bottom:0"><label>9 Naturaleza</label><input type="text" id="gl-desc-${id}" placeholder="Descripción" value="${data.desc || ''}" oninput="updateTotals()"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:7px;margin-bottom:8px">
      <div class="fr" style="margin-bottom:0"><label>7 Bultos</label><input type="number" id="gl-qty-${id}" min="0" value="${data.qty || ''}" oninput="updateTotals()"/></div>
      <div class="fr" style="margin-bottom:0;position:relative"><label>8 Embalaje</label>
        <input type="text" id="gl-packing-${id}" value="${data.packing || ''}" autocomplete="off"
          oninput="filterPackingLine(${id},this.value)"
          onblur="setTimeout(()=>{const d=document.getElementById('gl-pdrop-${id}');if(d)d.style.display='none'},200)"/>
        <div id="gl-pdrop-${id}" style="display:none;position:absolute;z-index:50;background:var(--bg3);border:1px solid var(--line2);border-radius:var(--r3);top:100%;left:0;width:100%;max-height:140px;overflow-y:auto"></div>
      </div>
      <div class="fr" style="margin-bottom:0"><label>11 Peso kg</label><input type="number" id="gl-weight-${id}" step="0.01" min="0" value="${data.weight || ''}" oninput="updateTotals()"/></div>
      <div class="fr" style="margin-bottom:0"><label>12 Volumen</label><input type="text" id="gl-volume-${id}" value="${data.volume || ''}" oninput="updateTotals()"/></div>
    </div>
    <div class="fr" style="margin-bottom:0"><label>N. Estadístico</label><input type="text" id="gl-stat-${id}" placeholder="Número estadístico / código aduanero" value="${data.stat || ''}"/></div>`;
    container.appendChild(div); updateTotals();
};

window.removeGoodsLine = id => { const el = document.getElementById('gl-' + id); if (el) el.remove(); updateTotals(); };

window.updateTotals = function() {
    let qty = 0, weight = 0, volume = 0;
    document.querySelectorAll('[id^="gl-qty-"]').forEach(el => { qty += parseFloat(el.value) || 0; });
    document.querySelectorAll('[id^="gl-weight-"]').forEach(el => { weight += parseFloat(el.value) || 0; });
    document.querySelectorAll('[id^="gl-volume-"]').forEach(el => { volume += parseFloat(el.value) || 0; });
    document.getElementById('totalQty').textContent    = qty || 0;
    document.getElementById('totalWeight').textContent = weight ? weight.toFixed(2) : '0';
    document.getElementById('totalVolume').textContent = volume ? volume.toFixed(2) : '0';
};

window.collectGoodsLines = function() {
    const lines = [];
    document.querySelectorAll('[id^="gl-desc-"]').forEach(el => {
        const id = el.id.replace('gl-desc-', '');
        lines.push({
            desc:   el.value.trim(),
            marks:  (document.getElementById('gl-marks-'   + id) || {}).value?.trim() || '',
            packing:(document.getElementById('gl-packing-' + id) || {}).value?.trim() || '',
            qty:    (document.getElementById('gl-qty-'     + id) || {}).value?.trim() || '',
            weight: (document.getElementById('gl-weight-'  + id) || {}).value?.trim() || '',
            volume: (document.getElementById('gl-volume-'  + id) || {}).value?.trim() || '',
            stat:   (document.getElementById('gl-stat-'    + id) || {}).value?.trim() || ''
        });
        const pv = (document.getElementById('gl-packing-' + id) || {}).value?.trim();
        if (pv) savePackingValue(pv);
    });
    if (lines.length === 0) lines.push({ desc: '', marks: '', packing: '', qty: '', weight: '', volume: '', stat: '' });
    return lines;
};

window.fillGoodsLines = function(lines) {
    document.getElementById('goods-lines').innerHTML = ''; goodsLineId = 0;
    if (!lines || !lines.length) { addGoodsLine(); return; }
    lines.forEach(l => addGoodsLine(l));
};

window.filterPackingLine = function(id, q) {
    const arr = getPackingHistory();
    const matches = q ? arr.filter(x => x.toLowerCase().includes(q.toLowerCase())) : arr;
    const drop = document.getElementById('gl-pdrop-' + id);
    if (!drop) return;
    if (!matches.length) { drop.style.display = 'none'; return; }
    drop.innerHTML = matches.map(v => `<div style="padding:8px 12px;cursor:pointer" onmousedown="document.getElementById('gl-packing-${id}').value='${v.replace(/'/g, "\\'")}';savePackingValue('${v.replace(/'/g, "\\'")}');document.getElementById('gl-pdrop-${id}').style.display='none'">${v}</div>`).join('');
    drop.style.display = 'block';
};

function getPackingHistory() { try { return JSON.parse(localStorage.getItem('cmr_packing') || '[]'); } catch { return []; } }
window.savePackingValue = function(val) {
    if (!val) return;
    let arr = getPackingHistory();
    arr = arr.filter(x => x.toLowerCase() !== val.toLowerCase());
    arr.unshift(val); arr = arr.slice(0, 12);
    localStorage.setItem('cmr_packing', JSON.stringify(arr));
};
window.renderPackingQF = function() {
    const arr = getPackingHistory().slice(0, 6);
    const el = document.getElementById('packing-qf');
    if (el) el.innerHTML = arr.map(v => `<span class="qf-pill" onclick="pickPacking('${v.replace(/'/g, "\\'")}')">${v}</span>`).join('');
};
window.pickPacking = function(v) {
    const active = document.querySelector('[id^="gl-packing-"]');
    if (active) { active.value = v; savePackingValue(v); }
};

// ── Porteadores sucesivos ─────────────────────────────────────
window.addSuccessiveCarrier = function(data = {}) {
    const id = ++succId;
    const container = document.getElementById('successive-list');
    const div = document.createElement('div'); div.id = 'sc-' + id;
    div.style.cssText = 'background:var(--bg);border:1px solid var(--line);border-radius:var(--r3);padding:11px 12px;margin-bottom:8px;position:relative';
    div.innerHTML = `<button onclick="removeSuccessiveCarrier(${id})" style="position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:5px;border:1px solid rgba(244,63,94,.3);background:rgba(244,63,94,.08);color:var(--rose-l);font-size:.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
    <div style="font-size:.6rem;color:var(--dim);margin-bottom:8px">PORTEADOR ${id}</div>
    <div class="fr" style="margin-bottom:8px"><label>Nombre</label><input type="text" id="sc-name-${id}" value="${data.name || ''}"/></div>
    <div class="fr"><label>Dirección</label><textarea id="sc-addr-${id}" rows="2">${data.address || ''}</textarea></div>`;
    container.appendChild(div);
};

window.removeSuccessiveCarrier = id => { const el = document.getElementById('sc-' + id); if (el) el.remove(); };

window.collectSuccessiveCarriers = function() {
    const carriers = [];
    document.querySelectorAll('[id^="sc-name-"]').forEach(el => {
        const id = el.id.replace('sc-name-', '');
        carriers.push({ name: el.value.trim(), address: (document.getElementById('sc-addr-' + id) || {}).value?.trim() || '' });
    });
    return carriers;
};

window.fillSuccessiveCarriers = function(list) {
    document.getElementById('successive-list').innerHTML = ''; succId = 0;
    if (!list || !list.length) return;
    list.forEach(l => addSuccessiveCarrier(l));
};

// ── Agenda ────────────────────────────────────────────────────
window.saveRcvToAgenda = async function() {
    const val = gv('rcvBlock'); if (!val) { toast('Rellena el destinatario primero', 'err'); return; }
    const name = val.split('\n')[0].trim();
    await dbAdd(AG, { type: 'rcv', name, block: val, savedAt: new Date().toISOString() });
    toast('✓ Destinatario guardado', 'ok'); renderRcvQF();
};

window.saveDrvToAgenda = async function() {
    const name = gv('driverName'); if (!name) { toast('Rellena el conductor primero', 'err'); return; }
    await dbAdd(AG, { type: 'drv', name, tractor: gvUp('plateTractor'), trailer: gvUp('plateTrailer'), savedAt: new Date().toISOString() });
    toast('✓ Conductor guardado', 'ok'); renderDrvQF();
};

window.fillRcv = async id => { const all = await dbAll(AG); const r = all.find(x => x.id == id); if (!r) return; sv('rcvBlock', r.block); tab('form'); toast('✓ Destinatario cargado', 'ok'); };
window.fillDrv = async id => { const all = await dbAll(AG); const d = all.find(x => x.id == id); if (!d) return; sv('driverName', d.name); sv('plateTractor', d.tractor); sv('plateTrailer', d.trailer); tab('form'); toast('✓ Conductor cargado', 'ok'); };

window.editRcv = async function(id) {
    const all = await dbAll(AG); const r = all.find(x => x.id == id); if (!r) return;
    const iid = '_editRcvTxt';
    const safeVal = (r.block || '').replace(/&/g, '&amp;');
    showBS('Editar destinatario',
        `<textarea id="${iid}" rows="5" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid rgba(100,130,255,.4);border-radius:8px;font-size:.88rem;background:rgba(255,255,255,.07);color:inherit;outline:none;resize:vertical;font-family:inherit">${safeVal}</textarea>`,
        [
            { label: 'Cancelar', cls: 'cancel', fn: closeBS },
            { label: 'Guardar', cls: 'ok', fn: async () => {
                const ta = document.getElementById(iid);
                const val = (ta ? ta.value : '').trim(); if (!val) return;
                const name = val.split('\n')[0].trim();
                await dbDel(AG, id); await dbAdd(AG, { type: 'rcv', name, block: val, savedAt: new Date().toISOString() });
                closeBS(); renderAgenda(); renderRcvQF(); toast('✓ Destinatario actualizado', 'ok');
            }}
        ]
    );
    setTimeout(() => { const ta = document.getElementById(iid); if (ta) { ta.focus(); ta.setSelectionRange(0, 0); } }, 80);
};

window.editDrv = async function(id) {
    const all = await dbAll(AG); const d = all.find(x => x.id == id); if (!d) return;
    const iName = '_editDrvName', iTrac = '_editDrvTrac', iTrail = '_editDrvTrail';
    const s = 'width:100%;box-sizing:border-box;padding:9px 12px;border:1.5px solid rgba(100,130,255,.4);border-radius:8px;font-size:.9rem;background:rgba(255,255,255,.07);color:inherit;outline:none;margin-bottom:8px';
    const l = 'display:block;margin-bottom:4px;font-size:.78rem;color:#aaa';
    showBS('Editar conductor',
        `<label style="${l}">Nombre:</label><input id="${iName}" type="text" value="${(d.name || '').replace(/"/g, '&quot;')}" style="${s}"/>
         <label style="${l}">Matrícula tractora:</label><input id="${iTrac}" type="text" value="${(d.tractor || '').replace(/"/g, '&quot;')}" style="${s}"/>
         <label style="${l}">Matrícula semirremolque:</label><input id="${iTrail}" type="text" value="${(d.trailer || '').replace(/"/g, '&quot;')}" style="${s.replace('margin-bottom:8px', '')}"/>`,
        [
            { label: 'Cancelar', cls: 'cancel', fn: closeBS },
            { label: 'Guardar', cls: 'ok', fn: async () => {
                const name    = (document.getElementById(iName)  || { value: '' }).value.trim();
                const tractor = ((document.getElementById(iTrac)  || { value: '' }).value || '').toUpperCase().trim();
                const trailer = ((document.getElementById(iTrail) || { value: '' }).value || '').toUpperCase().trim();
                if (!name) { toast('El nombre es obligatorio', 'err', 3000); return; }
                await dbDel(AG, id); await dbAdd(AG, { type: 'drv', name, tractor, trailer, savedAt: new Date().toISOString() });
                closeBS(); renderAgenda(); renderDrvQF(); toast('✓ Conductor actualizado', 'ok');
            }}
        ]
    );
    setTimeout(() => { const inp = document.getElementById(iName); if (inp) { inp.focus(); inp.select(); } }, 80);
};

window.delAg = async id => { await dbDel(AG, id); renderAgenda(); renderRcvQF(); renderDrvQF(); toast('Eliminado', 'warn'); };

window.renderAgenda = async function() {
    const all  = await dbAll(AG);
    const rcvs = all.filter(x => x.type === 'rcv');
    const drvs = all.filter(x => x.type === 'drv');
    const xi = `<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>`;
    const loadIco = `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>`;
    const editIco = `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>`;

    const rcvEl = document.getElementById('agRcvList');
    if (!rcvs.length) { rcvEl.innerHTML = '<div class="hist-empty" style="padding:20px 0">Sin destinatarios</div>'; }
    else {
        rcvEl.innerHTML = rcvs.map(r => `<div class="ag-item" data-id="${r.id}" data-act="rcv"><div class="ag-ico rcv">${r.name.slice(0, 2).toUpperCase()}</div><div class="ag-info"><div class="ag-name">${r.name}</div><div class="ag-sub">Toca para ver opciones</div></div><div class="hacts"><div class="hb" data-id="${r.id}" data-act="loadrcv">${loadIco}</div><div class="hb" data-id="${r.id}" data-act="editrcv">${editIco}</div><div class="hb de" data-id="${r.id}" data-act="delrcv">${xi}</div></div></div>`).join('');
        rcvEl.querySelectorAll('[data-act="rcv"]').forEach(el => el.addEventListener('click', e => {
            if (e.target.closest('[data-act="loadrcv"]') || e.target.closest('[data-act="editrcv"]') || e.target.closest('[data-act="delrcv"]')) return;
            fillRcv(el.dataset.id);
        }));
        rcvEl.querySelectorAll('[data-act="loadrcv"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); fillRcv(el.dataset.id); }));
        rcvEl.querySelectorAll('[data-act="editrcv"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); editRcv(el.dataset.id); }));
        rcvEl.querySelectorAll('[data-act="delrcv"]').forEach(el  => el.addEventListener('click', e => { e.stopPropagation(); delAg(el.dataset.id); }));
    }

    const drvEl = document.getElementById('agDrvList');
    if (!drvs.length) { drvEl.innerHTML = '<div class="hist-empty" style="padding:20px 0">Sin conductores</div>'; }
    else {
        drvEl.innerHTML = drvs.map(d => `<div class="ag-item" data-id="${d.id}" data-act="drv"><div class="ag-ico drv">${d.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</div><div class="ag-info"><div class="ag-name">${d.name}</div><div class="ag-sub">${[d.tractor, d.trailer].filter(Boolean).join(' · ')}</div></div><div class="hacts"><div class="hb" data-id="${d.id}" data-act="loaddrv">${loadIco}</div><div class="hb" data-id="${d.id}" data-act="editdrv">${editIco}</div><div class="hb de" data-id="${d.id}" data-act="deldrv">${xi}</div></div></div>`).join('');
        drvEl.querySelectorAll('[data-act="drv"]').forEach(el => el.addEventListener('click', e => {
            if (e.target.closest('[data-act="loaddrv"]') || e.target.closest('[data-act="editdrv"]') || e.target.closest('[data-act="deldrv"]')) return;
            fillDrv(el.dataset.id);
        }));
        drvEl.querySelectorAll('[data-act="loaddrv"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); fillDrv(el.dataset.id); }));
        drvEl.querySelectorAll('[data-act="editdrv"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); editDrv(el.dataset.id); }));
        drvEl.querySelectorAll('[data-act="deldrv"]').forEach(el  => el.addEventListener('click', e => { e.stopPropagation(); delAg(el.dataset.id); }));
    }
};

window.renderRcvQF = async function() {
    const all = await dbAll(AG);
    const el = document.getElementById('rcv-qf');
    el.innerHTML = all.filter(x => x.type === 'rcv').slice(0, 5).map(r => `<span class="qf-pill" data-id="${r.id}">↩ ${r.name.split(' ')[0]}</span>`).join('');
    el.querySelectorAll('[data-id]').forEach(s => s.addEventListener('click', () => fillRcv(s.dataset.id)));
};

window.renderDrvQF = async function() {
    const all = await dbAll(AG);
    const el = document.getElementById('drv-qf');
    el.innerHTML = all.filter(x => x.type === 'drv').slice(0, 5).map(d => `<span class="qf-pill" data-id="${d.id}">↩ ${d.name.split(' ')[0]}</span>`).join('');
    el.querySelectorAll('[data-id]').forEach(s => s.addEventListener('click', () => fillDrv(s.dataset.id)));
};

// ── Historial ─────────────────────────────────────────────────
window.updateHistBadge = async function() {
    const n = (await dbAll(STORE)).length;
    const el = document.getElementById('histBadge');
    el.textContent = n; el.style.display = n ? 'inline' : 'none';
};

window.renderHist = async function() {
    const all  = await dbAll(STORE);
    const q    = (gv('histSearch') || '').toLowerCase();
    const filt = document.getElementById('histFilter')?.value || '';
    const group= document.getElementById('histGroup')?.value  || '';
    const now  = new Date();
    let data = all.filter(r => {
        if (filt === 'month') { const d = new Date(r.savedAt); if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false; }
        if (filt === 'week')  { const d = new Date(r.savedAt); if ((now - d) / 864e5 > 7) return false; }
        if (q) return (r.docNum + r.rcvBlock + r.placeDelivery).toLowerCase().includes(q);
        return true;
    });
    const el = document.getElementById('histList');
    const makeItem = (r, style = '') => {
        const dt = r.savedAt ? new Date(r.savedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
        return `<div class="hitem" data-id="${r.id}" ${style}><div class="hico">📄</div><div class="hinfo"><div class="hnum">${r.docNum || 'Sin N.º'} ${r.tipoDoc === 'nacional' ? '<span class="hwbadge" style="background:rgba(8,145,178,.1);border-color:rgba(8,145,178,.2);color:var(--teal-l)">NAC</span>' : ''} ${r.goodsWeight ? `<span class="hwbadge">${r.goodsWeight}kg</span>` : ''}</div><div class="hsub">${[(r.rcvBlock || '').split('\n')[0], r.placeDelivery].filter(Boolean).join(' → ')}</div></div><div class="hdate">${dt}</div><div class="hacts"><div class="hb lo" data-id="${r.id}" data-act="load">⬆</div><div class="hb du" data-id="${r.id}" data-act="dup">📋</div><div class="hb pd" data-id="${r.id}" data-act="pdf">📄</div><div class="hb de" data-id="${r.id}" data-act="del">🗑</div></div></div>`;
    };
    if (group) {
        const grouped = {};
        const groupKey = { dest: r => r.placeDelivery || 'Sin destino', carrier: r => (r.carrierBlock || '').split('\n')[0] || 'Sin transportista' }[group];
        data.forEach(r => { const key = groupKey(r); if (!grouped[key]) grouped[key] = []; grouped[key].push(r); });
        el.innerHTML = Object.entries(grouped).map(([key, items]) => `<div style="margin-bottom:16px"><div style="font-weight:600;color:var(--snow)">${key} (${items.length})</div>${items.map(r => makeItem(r, 'style="margin:4px 0"')).join('')}</div>`).join('') || '<div class="hist-empty">Sin resultados</div>';
    } else {
        if (!data.length) { el.innerHTML = `<div class="hist-empty">${all.length ? 'Sin resultados' : 'Aún no hay documentos.<br>Genera tu primer documento.'}</div>`; }
        else { el.innerHTML = data.map(r => makeItem(r)).join(''); }
    }
    el.querySelectorAll('[data-act="load"]').forEach(b => b.addEventListener('click', () => loadRec(b.dataset.id)));
    el.querySelectorAll('[data-act="dup"]').forEach(b  => b.addEventListener('click', () => dupRec(b.dataset.id)));
    el.querySelectorAll('[data-act="pdf"]').forEach(b  => b.addEventListener('click', () => regenPDF(b.dataset.id)));
    el.querySelectorAll('[data-act="del"]').forEach(b  => b.addEventListener('click', () => delRec(b.dataset.id)));
    const allMonth = all.filter(r => { try { const d = new Date(r.savedAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); } catch { return false; } });
    const totalKg  = all.reduce((s, r) => s + (parseFloat(r.goodsWeight) || 0), 0);
    const monthKg  = allMonth.reduce((s, r) => s + (parseFloat(r.goodsWeight) || 0), 0);
    document.getElementById('st0').textContent = all.length;
    document.getElementById('st1').textContent = allMonth.length;
    document.getElementById('st2').textContent = totalKg > 0 ? (totalKg >= 1000 ? (totalKg / 1000).toFixed(1) + 't' : Math.round(totalKg)) : '—';
    document.getElementById('st3').textContent = monthKg > 0 ? (monthKg >= 1000 ? (monthKg / 1000).toFixed(1) + 't' : Math.round(monthKg)) : '—';
};

window.loadRec = async id => { const all = await dbAll(STORE); const r = all.find(x => x.id == id); if (!r) return; fill(r); clearSig(); clearSigSender(); tab('form'); toast('✓ Documento cargado', 'ok'); };
window.dupRec  = async id => { const all = await dbAll(STORE); const r = all.find(x => x.id == id); if (!r) return; const d = { ...r }; delete d.id; d.docDate = new Date().toISOString().split('T')[0]; d.savedAt = new Date().toISOString(); fill(d); sv('docNum', genDocNum()); clearSig(); clearSigSender(); tab('form'); toast('✓ Duplicado — cambia el albarán para actualizar el N.º', 'warn', 5000); };
window.regenPDF = async function(id) {
    const all = await dbAll(STORE); const r = all.find(x => x.id == id); if (!r) return;
    const chosenLayout = await _askPDFLayout(); if (!chosenLayout) return;
    const data = { ...r, _pdfLayout: chosenLayout };
    showOv(true); const st = setTimeout(() => { showOv(false); toast('⚠ Tiempo agotado', 'err', 5000); }, 60000);
    try { buildPDF_dispatch(data, st); } catch (e) { clearTimeout(st); showOv(false); toast('⚠ Error: ' + e.message, 'err', 5000); }
};
window.delRec  = id => { showBS('Eliminar Documento', 'Este registro se eliminará permanentemente.', [{ label: 'Cancelar', cls: 'cancel', fn: closeBS }, { label: 'Eliminar', cls: 'danger', fn: () => _delOk(id) }]); };
window._delOk  = async id => { closeBS(); await dbDel(STORE, id); await renderHist(); await updateHistBadge(); toast('Eliminado', 'warn'); };

// ── Plantillas ────────────────────────────────────────────────
window.saveAsTemplate = async function() {
    const data = collect(); delete data.sigDriver; delete data.sigSender;
    const suggestedCli  = (data.rcvBlock || '').split('\n')[0].trim() || (data.senderBlock || '').split('\n')[0].trim() || '';
    const suggestedName = [data.senderBlock, data.rcvBlock].map(b => b.split('\n')[0]).filter(Boolean).join(' → ');
    const idCli = '_saveTplCli', idName = '_saveTplName';
    const safeCli  = suggestedCli.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const safeName = suggestedName.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const s = 'width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid rgba(100,130,255,.4);border-radius:8px;font-size:.95rem;background:rgba(255,255,255,.07);color:inherit;outline:none;margin-bottom:10px';
    const l = 'display:block;margin-bottom:5px;font-size:.8rem;color:#aaa';
    showBS('Guardar plantilla',
        `<label style="${l}">Cliente (para agrupar):</label><input id="${idCli}" type="text" value="${safeCli}" style="${s}" placeholder="Ej: EUROGROUP"/>
         <label style="${l}">Nombre de la plantilla:</label><input id="${idName}" type="text" value="${safeName}" style="${s.replace('margin-bottom:10px', '')}" placeholder="Ej: ALEMANIA VIGAR"/>`,
        [
            { label: 'Cancelar', cls: 'cancel', fn: closeBS },
            { label: 'Guardar', cls: 'ok', fn: async () => {
                const cli  = (document.getElementById(idCli)  || {}).value || '';
                const inp  = document.getElementById(idName);
                const name = (inp ? inp.value : '').trim();
                if (!name) { toast('Ponle un nombre a la plantilla', 'err', 3000); return; }
                const all  = await dbAll(TPL);
                const existing = all.find(t => (t.templateName || '').trim().toLowerCase() === name.toLowerCase());
                if (existing) {
                    closeBS();
                    window._pendingTplData = data; window._pendingTplName = name; window._pendingTplCli = cli.trim();
                    showBS('Nombre duplicado', `<p>Ya existe una plantilla llamada <b>${existing.templateName}</b>.</p><p style="margin-top:8px;color:var(--dim);font-size:.78rem">¿Qué quieres hacer?</p>`,
                        [{ label: 'Cancelar', cls: 'cancel', fn: () => { closeBS(); delete window._pendingTplData; delete window._pendingTplName; delete window._pendingTplCli; } },
                         { label: 'Renombrar', cls: 'ok', fn: _tplRename },
                         { label: 'Sobreescribir', cls: 'danger', fn: () => _tplOverwrite(existing.id) }]);
                    return;
                }
                data.templateName = name; data.templateClient = cli.trim(); data.savedAt = new Date().toISOString(); delete data.docNum; delete data.docDate;
                await dbAdd(TPL, data); closeBS(); renderTemplates(); toast('✓ Plantilla guardada', 'ok');
            }}
        ]
    );
    setTimeout(() => { const inp = document.getElementById(idCli); if (inp) { inp.focus(); inp.select(); } }, 80);
};

window._tplOverwrite = async function(id) {
    closeBS();
    const data = window._pendingTplData; if (!data) return;
    delete data.sigDriver; delete data.sigSender;
    const name = window._pendingTplName || data.templateName || '';
    const cli  = window._pendingTplCli !== undefined ? window._pendingTplCli : (data.templateClient || '');
    data.templateName = name; data.templateClient = cli; data.savedAt = new Date().toISOString(); delete data.docNum; delete data.docDate;
    await dbDel(TPL, id); await dbAdd(TPL, data); renderTemplates(); toast('✓ Plantilla sobreescrita', 'ok');
    delete window._pendingTplData; delete window._pendingTplName; delete window._pendingTplCli;
};

window._tplRename = async function() {
    closeBS();
    const data = window._pendingTplData; if (!data) return;
    const currentName = window._pendingTplName || '';
    const inputId = '_rnmTplInput';
    const safeVal = currentName.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    showBS('Nuevo nombre',
        `<div style="margin-bottom:6px;font-size:.8rem;color:#aaa">Elige otro nombre:</div><input id="${inputId}" type="text" value="${safeVal}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid rgba(100,130,255,.4);border-radius:8px;font-size:.95rem;background:rgba(255,255,255,.07);color:inherit;outline:none" placeholder="Nombre de la plantilla"/>`,
        [
            { label: 'Cancelar', cls: 'cancel', fn: () => { closeBS(); delete window._pendingTplData; delete window._pendingTplName; } },
            { label: 'Guardar', cls: 'ok', fn: async () => {
                const inp = document.getElementById(inputId);
                const newName = (inp ? inp.value : '').trim();
                if (!newName) { closeBS(); delete window._pendingTplData; delete window._pendingTplName; return; }
                const all = await dbAll(TPL);
                const dup = all.find(t => (t.templateName || '').trim().toLowerCase() === newName.toLowerCase());
                if (dup) { toast('Ese nombre también existe, elige otro', 'err', 4000); return; }
                data.templateName = newName; data.savedAt = new Date().toISOString(); delete data.docNum; delete data.docDate;
                await dbAdd(TPL, data); closeBS(); renderTemplates(); toast(`✓ Plantilla guardada como "${newName}"`, 'ok');
                delete window._pendingTplData; delete window._pendingTplName;
            }}
        ]
    );
    setTimeout(() => { const inp = document.getElementById(inputId); if (inp) { inp.focus(); inp.select(); } }, 80);
};

window.loadTemplate   = async id => { const all = await dbAll(TPL); const tpl = all.find(x => x.id == id); if (!tpl) return; fill(tpl); sv('docNum', genDocNum()); sv('docDate', new Date().toISOString().split('T')[0]); tab('form'); toast('✓ Plantilla cargada', 'ok'); };
window.updateTemplate = async function(id) {
    const all = await dbAll(TPL); const tpl = all.find(x => x.id == id); if (!tpl) return;
    showBS('Actualizar plantilla', `<p>Se sobreescribirá <b>${tpl.templateName}</b> con los datos actuales del formulario.</p>`,
        [{ label: 'Cancelar', cls: 'cancel', fn: closeBS },
         { label: 'Actualizar', cls: 'ok', fn: async () => {
             closeBS(); const data = collect(); delete data.sigDriver; delete data.sigSender;
             data.templateName = tpl.templateName; data.savedAt = new Date().toISOString(); delete data.docNum; delete data.docDate;
             await dbDel(TPL, id); await dbAdd(TPL, data); renderTemplates(); toast('✓ Plantilla actualizada', 'ok');
         }}]
    );
};

window.renameTemplate = async function(id) {
    const all = await dbAll(TPL); const tpl = all.find(x => x.id == id); if (!tpl) return;
    const inputId = '_rnm_' + id;
    const safeVal = (tpl.templateName || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    showBS('Renombrar plantilla',
        `<div style="margin-bottom:6px;font-size:.8rem;color:#aaa">Nuevo nombre:</div><input id="${inputId}" type="text" value="${safeVal}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid rgba(100,130,255,.4);border-radius:8px;font-size:.95rem;background:rgba(255,255,255,.07);color:inherit;outline:none"/>`,
        [{ label: 'Cancelar', cls: 'cancel', fn: closeBS },
         { label: 'Guardar', cls: 'ok', fn: async () => {
             const inp = document.getElementById(inputId);
             const newName = (inp ? inp.value : '').trim();
             if (!newName || newName === tpl.templateName.trim()) { closeBS(); return; }
             const dup = all.find(t => t.id != id && (t.templateName || '').trim().toLowerCase() === newName.toLowerCase());
             if (dup) { toast('Ese nombre ya existe', 'err', 4000); return; }
             tpl.templateName = newName; await dbDel(TPL, id); await dbAdd(TPL, tpl);
             closeBS(); renderTemplates(); toast('✓ Plantilla renombrada', 'ok');
         }}]
    );
    setTimeout(() => { const inp = document.getElementById(inputId); if (inp) { inp.focus(); inp.select(); } }, 80);
};

window.deleteTemplate = id => { showBS('Eliminar Plantilla', '¿Seguro que quieres eliminar esta plantilla?', [{ label: 'Cancelar', cls: 'cancel', fn: closeBS }, { label: 'Eliminar', cls: 'danger', fn: () => _delTpl(id) }]); };
window._delTpl = async id => { closeBS(); await dbDel(TPL, id); renderTemplates(); toast('Plantilla eliminada', 'warn'); };

window.renderTemplates = async function() {
    const all = await dbAll(TPL); const el = document.getElementById('tmplList');
    if (!all.length) { el.innerHTML = '<div class="hist-empty">Sin plantillas</div>'; return; }
    const pencil = `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"/></svg>`;
    const trash  = `<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>`;
    const hasClients = all.some(t => t.templateClient);
    const grouped = {};
    all.forEach(t => { const cli = (t.templateClient || '').trim() || 'Sin cliente'; if (!grouped[cli]) grouped[cli] = []; grouped[cli].push(t); });
    const makeCard = t => `<div class="ag-item" data-id="${t.id}" data-act="menu" style="margin-bottom:6px"><div class="ag-ico rcv">${(t.templateName || 'TPL').slice(0, 2).toUpperCase()}</div><div class="ag-info"><div class="ag-name">${t.templateName || 'Sin nombre'}</div><div class="ag-sub">${t.placeDelivery ? '→ ' + t.placeDelivery : 'Toca para ver opciones'}</div></div><div class="hacts"><div class="hb" data-id="${t.id}" data-act="rename">${pencil}</div><div class="hb de" data-id="${t.id}" data-act="del">${trash}</div></div></div>`;
    if (hasClients) {
        const mkGroup = ([cli, items]) => `<div style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:7px;padding:6px 10px;background:linear-gradient(90deg,rgba(99,130,255,.1),transparent);border-left:3px solid #6382ff;border-radius:0 6px 6px 0;margin-bottom:6px"><span style="font-size:.58rem;font-weight:700;color:#6382ff;background:rgba(99,130,255,.15);border:1px solid rgba(99,130,255,.3);padding:2px 6px;border-radius:4px;flex-shrink:0">CLI</span><span style="font-size:.8rem;font-weight:600;color:var(--snow);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cli}</span><span style="font-size:.62rem;color:var(--dim)">${items.length}</span></div>${items.map(makeCard).join('')}</div>`;
        el.innerHTML = Object.entries(grouped).sort(([a], [b]) => a === 'Sin cliente' ? 1 : b === 'Sin cliente' ? -1 : a.localeCompare(b, 'es')).map(mkGroup).join('');
    } else {
        el.innerHTML = all.slice().sort((a, b) => (a.templateName || '').localeCompare(b.templateName || '', 'es')).map(makeCard).join('');
    }
    el.querySelectorAll('[data-act="menu"]').forEach(b => b.addEventListener('click', e => {
        if (e.target.closest('[data-act="rename"]') || e.target.closest('[data-act="del"]')) return;
        const id = b.dataset.id; const name = b.querySelector('.ag-name').textContent;
        showBS(name, '', [{ label: 'Cargar en formulario', cls: 'ok', fn: () => { closeBS(); loadTemplate(id); } }, { label: 'Actualizar con form actual', cls: 'cancel', fn: () => updateTemplate(id) }, { label: 'Renombrar', cls: 'cancel', fn: () => { closeBS(); renameTemplate(id); } }, { label: 'Eliminar', cls: 'danger', fn: () => deleteTemplate(id) }]);
    }));
    el.querySelectorAll('[data-act="rename"]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); renameTemplate(b.dataset.id); }));
    el.querySelectorAll('[data-act="del"]').forEach(b   => b.addEventListener('click', e => { e.stopPropagation(); deleteTemplate(b.dataset.id); }));
};

// ── Backup / Restore ──────────────────────────────────────────
window.exportDB = async function() {
    const [docs, agenda, plantillas] = await Promise.all([dbAll(STORE), dbAll(AG), dbAll(TPL)]);
    if (!docs.length && !agenda.length && !plantillas.length) { toast('No hay datos para exportar', 'warn'); return; }
    const backup = { _version: 1, _exportedAt: new Date().toISOString(), _app: 'CMR Manager Pro', docs, agenda, plantillas };
    const b = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = 'CMR_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(u), 10000);
    toast(`✓ Backup exportado: ${docs.length} docs, ${agenda.length} agenda, ${plantillas.length} plantillas`, 'ok');
};

window.importClick = () => document.getElementById('importInput').click();

window.importDB = async function(e) {
    const f = e.target.files[0]; if (!f) return;
    const t = await f.text();
    try {
        const parsed = JSON.parse(t);
        let docsArr = [], agendaArr = [], plantillasArr = [];
        if (Array.isArray(parsed))     { docsArr = parsed; }
        else if (parsed._version)      { docsArr = parsed.docs || []; agendaArr = parsed.agenda || []; plantillasArr = parsed.plantillas || []; }
        else                           { throw new Error('Formato de backup no reconocido'); }
        showBS('Importar Backup',
            `<p style="margin-bottom:10px">Se importarán:</p><ul style="padding-left:16px;line-height:2"><li><b>${docsArr.length}</b> documentos</li><li><b>${agendaArr.length}</b> contactos de agenda</li><li><b>${plantillasArr.length}</b> plantillas</li></ul>`,
            [{ label: 'Cancelar', cls: 'cancel', fn: closeBS }, { label: 'Importar', cls: 'ok', fn: () => _doImport() }]
        );
        window._pendingImport = { d: docsArr, a: agendaArr, p: plantillasArr };
    } catch (err) { toast('JSON inválido: ' + err.message, 'err'); }
    e.target.value = '';
};

window._doImport = async function() {
    closeBS(); const data = window._pendingImport; if (!data) return;
    let counts = { d: 0, a: 0, p: 0 };
    for (const r of data.d) { const rec = { ...r }; delete rec.id; await dbAdd(STORE, rec); counts.d++; }
    for (const r of data.a) { const rec = { ...r }; delete rec.id; await dbAdd(AG, rec);    counts.a++; }
    for (const r of data.p) { const rec = { ...r }; delete rec.id; await dbAdd(TPL, rec);   counts.p++; }
    delete window._pendingImport;
    await updateHistBadge(); toast(`✓ Importados: ${counts.d} docs, ${counts.a} agenda, ${counts.p} plantillas`, 'ok');
    await updateBackupStats();
};

window.updateBackupStats = async function() {
    const el = document.getElementById('backup-stats'); if (!el) return;
    const [docs, agenda] = await Promise.all([dbAll(STORE), dbAll(AG)]);
    el.textContent = `${docs.length} documentos · ${agenda.length} contactos en agenda`;
};

window.confirmClear = () => { showBS('Vaciar Base de Datos', 'Se eliminarán TODOS los documentos.', [{ label: 'Cancelar', cls: 'cancel', fn: closeBS }, { label: 'Vaciar BD', cls: 'danger', fn: _clearOk }]); };
window._clearOk = async function() { closeBS(); await dbClear(STORE); await renderHist(); await updateHistBadge(); toast('BD vaciada', 'warn'); };

// ── Borrador helpers (delegan a autosave.js) ──────────────────
window._restoreDraft = function() {
    closeBS(); const draft = loadDraft(); if (!draft) return;
    fill(draft); _lastDraftHash = null; toast('✓ Borrador restaurado', 'ok');
};
window._discardDraft = function() { closeBS(); clearDraft(); toast('Borrador descartado', 'warn'); };

// ── App init ──────────────────────────────────────────────────
window._appInit = async function() {
    initSig(); loadDefaults();
    if (!document.querySelector('[id^="gl-desc-"]')) addGoodsLine();
    window.renderHist       = renderHist;
    window.renderTemplates  = renderTemplates;
    window.renderAgenda     = renderAgenda;
    window.renderRcvQF      = renderRcvQF;
    window.renderDrvQF      = renderDrvQF;
    window.updateHistBadge  = updateHistBadge;
    await updateHistBadge(); renderRcvQF(); renderDrvQF(); renderPackingQF();
    if (window._attachAutosaveListeners) window._attachAutosaveListeners();
    await updateBackupStats();

    const draft = loadDraft();
    if (draft && draft.docNum) {
        const age = Math.round((Date.now() - new Date(draft._draftSavedAt)) / 60000);
        const ageStr = age < 1 ? 'hace menos de 1 min' : age === 1 ? 'hace 1 min' : `hace ${age} min`;
        showBS('Borrador sin guardar',
            `<p>Se encontró un borrador guardado <b>${ageStr}</b>.</p><p style="margin-top:8px;color:var(--dim);font-size:.78rem">Documento: <b>${draft.docNum || 'Sin número'}</b>${draft.rcvBlock ? ' → ' + draft.rcvBlock.split('\n')[0] : ''}</p>`,
            [{ label: 'Descartar', cls: 'cancel', fn: _discardDraft }, { label: 'Restaurar borrador', cls: 'ok', fn: _restoreDraft }]
        );
    }
};
