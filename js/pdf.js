// ============================================================
// pdf.js — Generación de PDF (pdfmake): modelo Pro y Clásico
// ============================================================

function _advanceSeq(){ /* no-op: secuencia reemplazada por fecha+albarán */ }

async function _sharePDF(blob, fname, docNum, safetyTimer) {
    clearTimeout(safetyTimer);
    showOv(false);
    const url = URL.createObjectURL(blob);
    const rcv = (gv('rcvBlock')||'').split('\n')[0].trim();
    const mailUrl = 'mailto:?subject=' + encodeURIComponent('CMR ' + docNum) + '&body=' + encodeURIComponent('Adjunto carta de porte ' + docNum + (rcv ? ' para ' + rcv : '') + '.\n\nGenerado con CMR Manager Pro.');

    window._sharePDFBlob  = blob;
    window._sharePDFFname = fname;
    window._sharePDFDoc   = docNum;

    const canShareNative = !!(navigator.canShare && navigator.share);

    showBS(
        '✓ PDF generado',
        `<p style="margin-bottom:14px;color:var(--dim);font-size:.82rem">Documento <b>${fname}</b></p>
         <div style="display:flex;flex-direction:column;gap:8px">
           ${canShareNative ? `
           <button id="_shareNativeBtn"
              style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(26,79,214,.1);border:1.5px solid rgba(26,79,214,.35);border-radius:10px;cursor:pointer;width:100%;text-align:left;font-family:Sora,sans-serif;color:var(--snow)">
               <span style="font-size:1.3rem">📤</span>
               <div><div style="font-weight:700;font-size:.85rem">Compartir</div><div style="font-size:.7rem;color:var(--dim)">WhatsApp, email, Drive…</div></div>
           </button>` : ''}
           <a href="${url}" download="${fname}" onclick="setTimeout(()=>{closeBS();URL.revokeObjectURL('${url}')},300)"
              style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(20,105,47,.07);border:1px solid rgba(20,105,47,.25);border-radius:10px;text-decoration:none;color:var(--snow)">
               <span style="font-size:1.3rem">⬇️</span>
               <div><div style="font-weight:600;font-size:.85rem">Descargar PDF</div><div style="font-size:.7rem;color:var(--dim)">Guardar en el dispositivo</div></div>
           </a>
           <a href="${url}" target="_blank" rel="noopener" onclick="setTimeout(()=>closeBS(),300)"
              style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(14,116,144,.07);border:1px solid rgba(14,116,144,.25);border-radius:10px;text-decoration:none;color:var(--snow)">
               <span style="font-size:1.3rem">👁️</span>
               <div><div style="font-weight:600;font-size:.85rem">Abrir PDF</div><div style="font-size:.7rem;color:var(--dim)">Ver en el navegador</div></div>
           </a>
           <a href="${mailUrl}" onclick="setTimeout(()=>closeBS(),300)"
              style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(146,64,14,.07);border:1px solid rgba(146,64,14,.25);border-radius:10px;text-decoration:none;color:var(--snow)">
               <span style="font-size:1.3rem">✉️</span>
               <div><div style="font-weight:600;font-size:.85rem">Email</div><div style="font-size:.7rem;color:var(--dim)">Abre el cliente de correo</div></div>
           </a>
         </div>`,
        [{label: 'Cerrar', cls: 'cancel', fn: () => { closeBS(); URL.revokeObjectURL(url); }}]
    );

    if (canShareNative) {
        setTimeout(() => {
            const btn = document.getElementById('_shareNativeBtn');
            if (!btn) return;
            btn.addEventListener('click', async () => {
                try {
                    const file = new File([window._sharePDFBlob], window._sharePDFFname, {type:'application/pdf'});
                    if (navigator.canShare({files:[file]})) {
                        await navigator.share({files:[file], title:'CMR '+window._sharePDFDoc, text:'Carta de porte '+window._sharePDFDoc});
                    } else {
                        await navigator.share({title:'CMR '+window._sharePDFDoc, text:'Carta de porte '+window._sharePDFDoc});
                    }
                } catch(e) {
                    if (e.name !== 'AbortError') toast('⚠ Error al compartir', 'err');
                }
            });
        }, 50);
    }
}

async function generateCMR(){
    // ── Validación de campos obligatorios ──────────────────────
    const REQUIRED = [
        { id: 'rcvBlock',      label: 'Destinatario',    tag: 'casilla 2', type: 'textarea' },
        { id: 'placeLoading',  label: 'Lugar de Carga',  tag: 'casilla 4', type: 'input' },
        { id: 'placeDelivery', label: 'Lugar de Entrega',tag: 'casilla 3', type: 'input' },
    ];

    // Comprobar mercancía: al menos una línea con descripción
    const hasGoods = (() => {
        const descs = document.querySelectorAll('[id^="gl-desc-"]');
        for (const el of descs) { if ((el.value||'').trim()) return true; }
        return false;
    })();

    const missing = REQUIRED.filter(f => !gv(f.id));
    if (!hasGoods) missing.push({ id: '_goods', label: 'Mercancía', tag: 'casilla 6', type: 'goods' });

    // Limpiar errores anteriores
    document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

    if (missing.length) {
        // Marcar campos en rojo
        missing.forEach(f => {
            if (f.id === '_goods') {
                document.querySelectorAll('[id^="gl-desc-"]').forEach(el => el.classList.add('field-error'));
                return;
            }
            const el = document.getElementById(f.id);
            if (el) el.classList.add('field-error');
        });

        // Scroll al primer campo erróneo
        const firstId = missing[0].id === '_goods' ? 'goods-lines' : missing[0].id;
        const firstEl = document.getElementById(firstId);
        if (firstEl) {
            tab('form');
            setTimeout(() => firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
        }

        showBS(
            '⚠ Faltan campos obligatorios',
            `<p style="margin-bottom:12px;color:var(--dim);font-size:.83rem">Completa estos campos para generar el documento:</p>
             <ul style="padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px">
               ${missing.map(f => `
                 <li style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(225,29,72,.06);border:1px solid rgba(225,29,72,.2);border-radius:8px">
                   <span style="font-size:.9rem">⚠</span>
                   <div>
                     <div style="font-weight:700;font-size:.85rem;color:var(--snow)">${f.label}</div>
                     <div style="font-size:.68rem;color:var(--dim);font-family:'JetBrains Mono',monospace">${f.tag}</div>
                   </div>
                 </li>`).join('')}
             </ul>`,
            [{ label: 'Corregir', cls: 'ok', fn: closeBS }]
        );

        // Quitar resaltado rojo tras 4 segundos
        setTimeout(() => document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error')), 4000);
        return;
    }
    if(typeof pdfMake==='undefined'){toast('⚠ pdfmake no cargado','err',5000);return;}
    if(!pdfMake.vfs||Object.keys(pdfMake.vfs).length===0){toast('⚠ Fuentes PDF no cargadas','err',5000);return;}
    const chosenLayout = await _askPDFLayout();
    if(!chosenLayout) return;
    const data=collect();
    data._pdfLayout = chosenLayout;
    delete data.id;
    try{const id=await dbAdd(STORE,data);data.id=id;await updateHistBadge();clearDraft();_advanceSeq();}catch(e){console.warn('DB save:',e);toast('⚠ Error guardando en historial: '+e.message,'err',6000);}
    showOv(true);
    const safetyTimer=setTimeout(()=>{showOv(false);toast('⚠ Tiempo agotado','err',5000)},60000);
    try{buildPDF_dispatch(data,safetyTimer);}catch(err){clearTimeout(safetyTimer);showOv(false);toast('⚠ Error: '+err.message,'err',6000);}
}

function fmtD(iso){if(!iso)return'—';try{return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return iso}}
function buildPDF(D,safetyTimer){
    const isNacional = D.tipoDoc === 'nacional';
    const num=D.docNum||'CMR-'+Date.now();
    const dateStr=fmtD(D.docDate); const delivStr=fmtD(D.dateDelivery);
    const senderBlock=D.senderBlock||'—'; const rcvBlock=D.rcvBlock||'—'; const carrierBlock=D.carrierBlock||'—';

    const copies = isNacional ? [
        {lbl:'COPIA 1',sub:'REMITENTE / SENDER', AC:'#0f766e'},
        {lbl:'COPIA 2',sub:'DESTINATARIO / CONSIGNEE',AC:'#1e40af'},
        {lbl:'COPIA 3',sub:'TRANSPORTISTA / CARRIER', AC:'#7c3aed'}
    ] : [
        {lbl:'COPIA 1',sub:'REMITENTE / SENDER', AC:'#b91c1c'},
        {lbl:'COPIA 2',sub:'DESTINATARIO / CONSIGNEE',AC:'#1e3a8a'},
        {lbl:'COPIA 3',sub:'TRANSPORTISTA / CARRIER', AC:'#065f46'},
        {lbl:'COPIA 4',sub:'ADMINISTRACIÓN / ADMIN', AC:'#1f2937'}
    ];

    const tituloDocumento = isNacional ? 'CARTA DE PORTE NACIONAL' : 'CARTA DE PORTE INTERNACIONAL (CMR)';
    const subtituloLegal = isNacional
        ? 'Ley 15/2009 del Contrato de Transporte Terrestre de Mercancías — Orden FOM/1882/2012'
        : 'Convenio CMR Ginebra 1956 — Protocolo 5 julio 1978';

    const clausulasTexto = isNacional ? 
        `Este contrato de transporte se rige por la Ley 15/2009, de 11 de noviembre, del contrato de transporte terrestre de mercancías, y la Orden FOM/1882/2012.
1. El porteador responde de la pérdida total o parcial y de las averías desde la recepción hasta la entrega.
2. La indemnización por pérdida o avería no excederá del valor de mercado de la mercancía o 1/3 del IPREM por kilogramo.
3. El retraso en la entrega dará lugar a indemnización si se ha formulado reserva en el momento de la entrega.
4. Las reclamaciones prescribirán al año, salvo dolo o culpa grave (3 años).
5. El destinatario deberá manifestar las reservas en el momento de la entrega o dentro de los siete días siguientes.
6. La carta de porte deberá ser firmada por remitente, transportista y destinatario.`
        : `Este contrato de transporte se rige por el Convenio relativo al contrato de transporte internacional de mercancías por carretera (CMR), Ginebra, 19 de mayo de 1956, y el Protocolo de 5 de julio de 1978.\n1. El transportista responde de la pérdida total o parcial y de las averías que se produzcan desde el momento de la recepción de la mercancía hasta el de su entrega.\n2. La indemnización no excederá de 8,33 DEG por kilogramo de peso bruto faltante.\n3. El retraso en la entrega sólo dará lugar a indemnización si se ha formulado reserva por escrito.\n4. Las reclamaciones deberán dirigirse al transportista dentro del plazo de un año, o de tres años en caso de dolo o culpa grave.\n5. Los daños y perjuicios que no resulten de la pérdida o avería de la mercancía se limitan al importe del porte.\n6. El destinatario deberá manifestar por escrito al transportista las reservas por pérdidas o averías en el momento de la entrega, o a más tardar en los siete días siguientes.`;

    const content=[];
    copies.forEach((cp,ci)=>{
        const{AC}=cp;
        // Layout clásico CMR: bordes negros finos, sin rellenos de color en cabeceras
        const lay={hLineWidth:()=>0.5, vLineWidth:()=>0.5, hLineColor:()=>'#000', vLineColor:()=>'#000'};
        // Franja de color lateral por copia (solo el borde izquierdo de la página)
        const STRIPE=AC;
        // Línea de color CMR: barra horizontal de color encima de cada fila de casillas
        const colorLine=()=>({table:{widths:['*'],body:[[{text:'',border:[false,false,false,false],fillColor:AC,margin:[0,0.8,0,0.8]}]]},layout:'noBorders',margin:[0,0,0,0]});
        // box: casilla estándar — número pequeño arriba-izq, título arriba-der, contenido negro
        const box=(cas,title,cnt)=>{ const lines=cnt.split('\n'); const bdy=[]; bdy.push({columns:[{text:String(cas),fontSize:5.5,bold:true,color:'#888',width:'auto'},{text:title,fontSize:5,color:'#888',width:'*',alignment:'right'}],margin:[2,1,2,0]}); if(lines[0]) bdy.push({text:lines[0],fontSize:8,bold:true,color:'#000',margin:[2,0,2,0]}); if(lines.length>1) bdy.push({text:lines.slice(1).join('\n'),fontSize:7,color:'#111',margin:[2,0,2,1],lineHeight:1.2}); if(!bdy[1]) bdy.push({text:'',margin:[2,2,2,2]}); return {stack:bdy,border:[true,true,true,true],fillColor:'#fff',margin:[0,0,0,0]}; };
        // boxHdr: casilla grande
        const boxHdr=(cas,title,cnt)=>{ const lines=cnt.split('\n'); const hdr={columns:[{text:String(cas),fontSize:5.5,bold:true,color:STRIPE,width:'auto'},{text:title,fontSize:5,color:'#888',width:'*',alignment:'right'}],margin:[2,1,2,0]}; const bdy=[hdr]; if(lines[0]) bdy.push({text:lines[0],fontSize:9,bold:true,color:'#000',margin:[2,0,2,0]}); if(lines.length>1) bdy.push({text:lines.slice(1).join('\n'),fontSize:7.5,color:'#111',margin:[2,0,2,2],lineHeight:1.2}); if(bdy.length===1) bdy.push({text:'',margin:[2,2,2,2]}); return {stack:bdy,border:[true,true,true,true],fillColor:'#fff',margin:[0,0,0,0]}; };
        const refLine = D.clientRef ? [{text:'Ref: '+D.clientRef,fontSize:8,bold:true,color:'#000',alignment:'right'}] : [];
        // Cabecera del documento
        if(logoDataURL){ content.push({table:{widths:['auto','*','auto'],body:[[ {image:logoDataURL,width:40,height:24,margin:[6,3,3,3],border:[false,false,false,false]}, {stack:[{text:tituloDocumento,fontSize:10,bold:true,color:'#000'},{text:subtituloLegal,fontSize:5,color:'#555'},{text:'N.º '+num+'  ·  '+dateStr+(D.placeEmission?' — '+D.placeEmission:''),fontSize:6.5,color:'#333'}],border:[false,false,false,false],margin:[0,3,0,3]}, {stack:[{text:cp.lbl,fontSize:8,bold:true,color:STRIPE,alignment:'right'},{text:cp.sub,fontSize:5,color:'#555',alignment:'right'},...refLine],border:[false,false,false,false],margin:[0,3,4,3]} ]]},layout:'noBorders',margin:[0,0,0,1]}); } else { content.push({table:{widths:['*','auto'],body:[[ {stack:[{text:tituloDocumento,fontSize:11,bold:true,color:'#000'},{text:subtituloLegal,fontSize:5,color:'#555'},{text:'N.º '+num+'  ·  '+dateStr+(D.placeEmission?' — '+D.placeEmission:''),fontSize:6.5,color:'#333'}],border:[false,false,false,false],margin:[4,3,0,3]}, {stack:[{text:cp.lbl,fontSize:8,bold:true,color:STRIPE,alignment:'right'},{text:cp.sub,fontSize:5,color:'#555',alignment:'right'},...refLine],border:[false,false,false,false],margin:[0,3,4,3]} ]]},layout:'noBorders',margin:[0,0,0,1]}); }
        content.push(colorLine());
        content.push({table:{widths:['*','*'],body:[[boxHdr(1,'Remitente · Sender',senderBlock),boxHdr(2,'Destinatario · Consignee',rcvBlock)]]},layout:lay,margin:[0,0,0,0]});
        content.push(colorLine());
        content.push({table:{widths:['*','*','auto'],body:[[box(4,'Lugar de carga',D.placeLoading||'—'),{...box(3,'Lugar de entrega',D.placeDelivery||'—'),minHeight:55},box('','Fecha prev. entrega',delivStr)]]},layout:lay,margin:[0,0,0,0]});
        content.push(colorLine());
        content.push({table:{widths:['*','auto'],body:[[box(5,'Docs. anexos / Albarán',D.docsAnexos||'—'),box(14,'Reembolso €',D.codAmount||'')]]},layout:lay,margin:[0,0,0,0]});
        const platesStr = [D.plateTractor,D.plateTrailer].filter(Boolean).join('  /  ') || '—';
        const box16f = (()=>{
            const bdy=[];
            bdy.push({columns:[{text:'16f',fontSize:6,bold:true,color:'#888',width:'auto'},{text:'Conductor · Vehículo',fontSize:5.5,color:'#888',width:'*',alignment:'right'}],margin:[3,2,3,1]});
            if(D.driverName) bdy.push({text:D.driverName,fontSize:9,bold:true,color:'#000',margin:[3,0,3,0]});
            if(D.driverDNI)  bdy.push({text:'DNI: '+D.driverDNI,fontSize:7,color:'#444',margin:[3,0,3,0]});
            bdy.push({text:platesStr,fontSize:12,bold:true,color:'#000',characterSpacing:1.5,margin:[3,D.driverName?3:1,3,3]});
            return {stack:bdy,border:[true,true,true,true],fillColor:'#fff',margin:[0,0,0,0]};
        })();
        content.push(colorLine());
        content.push({table:{widths:['35%','65%'],body:[[box(16,'Transportista · Carrier',carrierBlock),box16f]]},layout:lay,margin:[0,0,0,0]});
        const succCarriers=D.successiveCarriers&&D.successiveCarriers.length?D.successiveCarriers:[];
        if(succCarriers.length){
            const succText=succCarriers.map(s=>`${s.name}\n${s.address}`).join('\n\n');
            content.push(colorLine());
            content.push({table:{widths:['*'],body:[[box(17,'Porteadores Sucesivos',succText)]]},layout:lay,margin:[0,0,0,0]});
        } else {
            content.push(colorLine());
            content.push({table:{widths:['*'],body:[[box(17,'Porteadores Sucesivos','')]]},layout:lay,margin:[0,0,0,0]});
        }

        const goodsLines = D.goodsLines && D.goodsLines.length ? D.goodsLines : [{desc:'',marks:'',packing:'',qty:'',weight:'',volume:''}];
        const totalWeight = goodsLines.reduce((s,l)=>s+(parseFloat(l.weight)||0),0);
        const totalVolume = goodsLines.reduce((s,l)=>s+(parseFloat(l.volume)||0),0);
        const allRows = [];
        for (let i = 0; i < Math.min(goodsLines.length, 10); i++) {
            allRows.push(goodsLines[i]);
        }
        while (allRows.length < 10) {
            allRows.push({desc:'', marks:'', packing:'', qty:'', weight:'', volume:'', stat:''});
        }
        const goodsHeader = [
            {text:'6 Marcas y Núm.',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'7 Núm. Bultos',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'8 Clase Embalaje',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'9 Naturaleza Mercancía',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'10 N. Estadístico',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'11 Peso Bruto kg',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'},
            {text:'12 Volumen',fontSize:5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],alignment:'center'}
        ];
        const goodsBody = [goodsHeader];
        allRows.forEach(l => {
            goodsBody.push([
                {text:l.marks||' ',fontSize:6.5,color:l.marks?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff'},
                {text:l.qty||' ',fontSize:6.5,color:l.qty?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff',alignment:'center'},
                {text:l.packing||' ',fontSize:6.5,color:l.packing?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff'},
                {text:l.desc||' ',fontSize:6.5,bold:!!l.desc,color:l.desc?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff'},
                {text:l.stat||' ',fontSize:6.5,color:l.stat?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff',alignment:'center'},
                {text:l.weight?l.weight+' kg':' ',fontSize:6.5,color:l.weight?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff',alignment:'center'},
                {text:l.volume?String(l.volume):' ',fontSize:6.5,color:l.volume?'#111':'#fff',margin:[2,4,2,4],fillColor:'#fff',alignment:'center'}
            ]);
        });
        goodsBody.push([
            {text:'TOTALES',fontSize:5.5,bold:true,color:'#000',fillColor:'#e8e8e8',margin:[2,1,2,1],colSpan:2,alignment:'right'},{},
            {text:'',fillColor:'#fff',margin:[2,1,2,1]},{text:'',fillColor:'#fff',margin:[2,1,2,1]},
            {text:'',fillColor:'#fff',margin:[2,1,2,1]},
            {text:totalWeight?totalWeight.toFixed(2)+' kg':'—',fontSize:6.5,bold:true,color:'#111',fillColor:'#fff',margin:[2,1,2,1],alignment:'center'},
            {text:totalVolume?totalVolume.toFixed(2):'—',fontSize:6.5,bold:true,color:'#111',fillColor:'#fff',margin:[2,1,2,1],alignment:'center'}
        ]);
        const freeLine1 = (document.getElementById('gl-free-1')||{}).value||'';
        const freeLine2 = (document.getElementById('gl-free-2')||{}).value||'';
        const eurosCargados = (document.getElementById('eurosCargados')||{}).value||'';
        const eurosDevueltos = (document.getElementById('eurosDevueltos')||{}).value||'';
        goodsBody.push([{text:freeLine1||' ',fontSize:6.5,color:'#111',margin:[2,2,2,2],colSpan:7,fillColor:'#fff',minHeight:10},{},{},{},{},{},{}]);
        goodsBody.push([{text:freeLine2||' ',fontSize:6.5,color:'#111',margin:[2,2,2,2],colSpan:7,fillColor:'#fff',minHeight:10},{},{},{},{},{},{}]);
        goodsBody.push([{text:[{text:'EURP. CARGADOS: ',bold:true,fontSize:8},{text:eurosCargados||'—'},{text:'    EURP. DEVUELTOS: ',bold:true,fontSize:8},{text:eurosDevueltos||'—'}],fontSize:8,color:'#111',margin:[2,2,2,2],colSpan:7,fillColor:'#fff',minHeight:10},{},{},{},{},{},{}]);

        content.push(colorLine());
        content.push({table:{widths:['auto','auto','auto','*','auto','auto','auto'],body:goodsBody,dontBreakRows:true},layout:lay,margin:[0,0,0,0]});

        content.push(colorLine());
        const instr13Text = (D.senderInstr||'—') + (D.placeEmission ? '\n21 '+D.placeEmission+(dateStr?' · '+dateStr:'') : '');
        content.push({table:{widths:['*','*'],body:[[{...box(13,'Instrucciones del Remitente',instr13Text),minHeight:80},{...box(18,'Reservas y Observaciones',D.observations||''),minHeight:80}]]},layout:lay,margin:[0,0,0,0]});

        content.push(colorLine());

        const sigHdr22={table:{widths:['*'],body:[[{text:[{text:'22 ',bold:true},{text:'Firma Remitente'}],fontSize:5.5,color:'#000',fillColor:'#e8e8e8',margin:[2,2,2,2]}]]},layout:'noBorders'};
        const sigHdr23={table:{widths:['*'],body:[[{text:[{text:'23 ',bold:true},{text:'Firma Transportista'}],fontSize:5.5,color:'#000',fillColor:'#e8e8e8',margin:[2,2,2,2]}]]},layout:'noBorders'};
        const sigHdr24={table:{widths:['*'],body:[[{text:[{text:'24 ',bold:true},{text:'Firma Destinatario'}],fontSize:5.5,color:'#000',fillColor:'#e8e8e8',margin:[2,2,2,2]}]]},layout:'noBorders'};
        const sigSenderCell=()=>{ const hasSig=D.sigSender&&D.sigSender.startsWith('data:image'); if(hasSig){ return {stack:[sigHdr22,{image:D.sigSender,width:100,height:65,alignment:'center',margin:[0,6,0,0]},{text:(D.senderBlock||'').split('\n')[0]||'',fontSize:5.5,alignment:'center',margin:[0,1,0,2]}],border:[true,true,true,true],margin:[1,1,1,1],fillColor:'#fff'}; } return {stack:[sigHdr22,{canvas:[{type:'rect',x:4,y:4,w:100,h:55,r:2,lineWidth:.5,lineColor:AC}],margin:[0,6,0,2]},{text:(D.senderBlock||'').split('\n')[0]||'',fontSize:5.5,alignment:'center',color:'#888',margin:[0,0,0,2]}],border:[true,true,true,true],margin:[1,1,1,1],fillColor:'#fff'}; };
        const sigDriverCell=()=>{ const hasSig=D.sigDriver&&D.sigDriver.startsWith('data:image'); if(hasSig){ return {stack:[sigHdr23,{image:D.sigDriver,width:100,height:65,alignment:'center',margin:[0,6,0,0]},{text:D.driverName||'',fontSize:5.5,alignment:'center',margin:[0,1,0,2]}],border:[true,true,true,true],margin:[1,1,1,1],fillColor:'#fff'}; } return {stack:[sigHdr23,{canvas:[{type:'rect',x:4,y:4,w:100,h:55,r:2,lineWidth:.5,lineColor:AC}],margin:[0,6,0,2]},{text:D.driverName||'',fontSize:5.5,alignment:'center',color:'#888',margin:[0,0,0,2]}],border:[true,true,true,true],margin:[1,1,1,1],fillColor:'#fff'}; };
        const sigConsCell=()=>({stack:[sigHdr24,{text:(D.rcvBlock||'').split('\n')[0]||'',fontSize:5.5,alignment:'center',color:'#888',margin:[0,20,0,2]}],border:[true,true,true,true],margin:[1,1,1,1],fillColor:'#fff'});

        content.push({table:{widths:['*','*','*'],body:[[sigSenderCell(),sigDriverCell(),sigConsCell()]]},layout:lay,margin:[0,0,0,0]});

        const tituloClausulas = isNacional ? 'CLÁUSULAS LEGALES (Ley 15/2009 y Orden FOM/1882/2012)' : 'CLÁUSULAS DEL CONVENIO CMR';
        const pieTexto = isNacional ? 'Documento generado conforme a la Ley 15/2009 y Orden FOM/1882/2012' : 'CMR Manager Pro  ·  Convenio CMR Ginebra 1956';
        content.push({table:{widths:['*'],body:[[{stack:[{text:tituloClausulas,fontSize:5,bold:true,color:'#000',margin:[2,1,2,1]},{text:clausulasTexto,fontSize:4.5,color:'#444',lineHeight:1.1,margin:[3,1,3,1]}],border:[true,true,true,true],fillColor:'#fff',margin:[0,0,0,0]}]]},layout:'noBorders',margin:[0,1,0,0]});
        content.push({columns:[{text:(isNacional?'CARTA PORTE NAC. ':'CMR N.º ')+num+'  ·  '+dateStr+(D.placeEmission?' — '+D.placeEmission:''),fontSize:4.5,color:'#999'},{text:pieTexto,fontSize:4.5,color:'#bbb',alignment:'right'}],margin:[0,1,0,0]});
        if(ci<copies.length-1) content.push({text:'',pageBreak:'after'});
    });
    try{
        pdfMake.createPdf({pageSize:'A4',pageMargins:[18,8,18,6],content,defaultStyle:{font:'Roboto',fontSize:9,color:'#111'},info:{title:(isNacional?'Carta Porte Nacional ':'CMR ')+num,author:'CMR Manager Pro',subject:isNacional?'Carta de Porte Nacional':'Carta de Porte Internacional CMR'}}).getBlob(blob=>{
            clearTimeout(safetyTimer);showOv(false);
            const fname=(isNacional?'CARTA_PORTE_NAC_':'CMR_')+num.replace(/[^a-z0-9]/gi,'_')+'.pdf';
            _sharePDF(blob, fname, num, safetyTimer);
            setTimeout(()=>URL.revokeObjectURL(URL.createObjectURL(blob)),30000);
        });
    }catch(pdfErr){ clearTimeout(safetyTimer);showOv(false);toast('⚠ Error: '+pdfErr.message,'err',6000); }
}

// ---- Layout selector helper ----
function _askPDFLayout(){
    return new Promise(resolve => {
        const mbs = "width:100%;margin-bottom:8px;padding:13px 14px;border-radius:10px;border:1.5px solid var(--line2);background:var(--bg3);color:var(--snow);font-size:.83rem;font-weight:600;font-family:'Sora',sans-serif;cursor:pointer;text-align:left;display:flex;align-items:flex-start;gap:12px;line-height:1.4";
        const h = '<p style="font-size:.78rem;color:var(--dim);margin-bottom:12px">Elige el modelo de documento:</p>'
            + '<button id="_lyt_cls" style="'+mbs+'"><span style="font-size:1.4rem;line-height:1.1">&#128196;</span><span><b style="display:block">Modelo oficial CMR</b><span style="font-size:.7rem;color:var(--dim);font-weight:400">Layout clásico: casillas numeradas, bordes rojos, formato estándar internacional</span></span></button>'
            + '<button id="_lyt_pro" style="'+mbs+'"><span style="font-size:1.4rem;line-height:1.1">&#127775;</span><span><b style="display:block">Modelo Pro (actual)</b><span style="font-size:.7rem;color:var(--dim);font-weight:400">Layout moderno con franjas de color por copia, firma digital, logo de empresa</span></span></button>';
        showBS('Modelo de Documento', h, [{label:'Cancelar',cls:'cancel',fn:()=>{closeBS();resolve(null);}}]);
        setTimeout(()=>{
            const a=document.getElementById('_lyt_cls'); if(a) a.addEventListener('click',()=>{closeBS();resolve('classic');});
            const b=document.getElementById('_lyt_pro'); if(b) b.addEventListener('click',()=>{closeBS();resolve('pro');});
        },60);
    });
}

// ---- Dispatch: choose builder based on _pdfLayout ----
function buildPDF_dispatch(D, safetyTimer){
    if(D._pdfLayout === 'classic') buildPDF_Classic(D, safetyTimer);
    else buildPDF(D, safetyTimer);
}

// ---- Classic CMR layout — replica del modelo oficial ----
function buildPDF_Classic(D, safetyTimer){
    const num   = D.docNum||'CMR-'+Date.now();
    const fmt   = iso=>{if(!iso)return'';try{return new Date(iso).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}catch{return iso}};
    const isNac = D.tipoDoc==='nacional';
    const R='#cc0000', WH='#ffffff', GR='#efefef';

    // Each copy gets its own accent colour (header bg + stripe)
    const COPY_COLORS = ['#fffde7','#e8f5e9','#e3f2fd','#fce4ec'];
    // BL used for signature box bg — keep independent
    const BL='#e3f2fd';

    const copies = isNac
        ? [{lbl:'ORIGINAL',sub:'1 Remitente'},{lbl:'DUPLICADO',sub:'2 Destinatario'},{lbl:'TRIPLICADO',sub:'3 Transportista'}]
        : [{lbl:'ORIGINAL',sub:'1 Remitente'},{lbl:'DUPLICADO',sub:'2 Destinatario'},{lbl:'TRIPLICADO',sub:'3 Transportista'},{lbl:'CUADRUPLICADO',sub:'4 Transportista'}];

    // Row heights (pt) — measured directly from reference CMR PDF
    // Total ~796pt matching real CMR layout
    const H = {
        hdr:75, cons:108, ent:43, crg:43, doc:32,
        ghdr:16, grow:19, gtot:13,
        ins:85, sig:108, foot:14
    };

    // All section borders are RED; goods borders GRAY
    // Line colors per copy: original=red, duplicado=green, triplicado=blue, cuadruplicado=pink
    const COPY_LINE_COLORS = ['#cc0000','#2e7d32','#1565c0','#ad1457'];

    // Border shorthand: all=true, none=false
    const bA = [true,true,true,true];
    const bN = [false,false,false,false];
    const layG = {hLineWidth:()=>0.5,vLineWidth:()=>0.5,hLineColor:()=>'#888',vLineColor:()=>'#888'};
    const layN = {hLineWidth:()=>0,vLineWidth:()=>0};

    const allContent = [];

    copies.forEach((cp,ci)=>{
        const YE = COPY_COLORS[ci % COPY_COLORS.length];
        const LC = COPY_LINE_COLORS[ci % COPY_LINE_COLORS.length]; // line colour this copy
        const layR = {hLineWidth:()=>0.7,vLineWidth:()=>0.7,hLineColor:()=>LC,vLineColor:()=>LC};
        const redLbl = (t,margin) => ({text:t,fontSize:5.5,color:LC,bold:false,margin:margin||[3,3,3,1]});
        const bodyTxt = (t,fs,bold,margin) => ({text:t||'',fontSize:fs||8,bold:!!bold,color:'#000',margin:margin||[3,1,3,3],lineHeight:1.2});
        const sender  = D.senderBlock||'';
        const rcv     = D.rcvBlock||'';
        const carrier = D.carrierBlock||'';
        const plates  = [D.plateTractor,D.plateTrailer].filter(Boolean).join(' / ');
        const deliv   = D.placeDelivery||'';
        const load    = D.placeLoading||'';
        const docs    = D.docsAnexos||'';
        const ref     = D.clientRef||'';
        const instr   = D.senderInstr||'';
        const obs     = D.observations||'';
        const dateS   = fmt(D.docDate);
        const cod     = D.codAmount||'';
        const payT    = D.freightTerms||'';
        const stipul  = D.specialStipulations||'';
        const succ    = D.successiveCarriers&&D.successiveCarriers.length
            ? D.successiveCarriers.map(s=>s.name+(s.address?'\n'+s.address:'')).join('\n'):'';
        const loadDate= load+(dateS?'\n'+dateS:'');
        const carrFull= carrier;

        const gl    = D.goodsLines&&D.goodsLines.length?D.goodsLines:[{}];
        const totalW= gl.reduce((s,l)=>s+(parseFloat(l.weight)||0),0);
        const totalV= gl.reduce((s,l)=>s+(parseFloat(l.volume)||0),0);
        const rows8 = gl.slice(0,8);
        while(rows8.length<8) rows8.push({});

        // ── SINGLE FLAT TABLE covering the whole page ──
        // Columns: [LEFT_HALF | RIGHT_HALF] for 2-col sections
        // For goods: 7 columns
        // For ins/pay: 5 columns [left | pay-label | rem | mon | cos]
        // For sigs: 3 columns [22 | 23 | 24]
        //
        // Strategy: use a 2-column master table (50%|50%) for most rows,
        // then switch to specialized tables for goods and ins sections.
        // Each table is independent — heights work correctly on direct tables.

        // Helper: 2-col red-bordered section
        const row2 = (leftStack, rightStack, h, lFill, rFill) => ({
            table:{
                widths:['50%','50%'],
                heights:[h],
                body:[[
                    {stack:leftStack, fillColor:lFill||WH, border:bA},
                    {stack:rightStack,fillColor:rFill||WH, border:bA},
                ]]
            },
            layout:layR, margin:[0,0,0,0]
        });

        // Helper: 1-col red-bordered section
        const row1 = (stack, h, fill) => ({
            table:{widths:['*'],heights:[h],body:[[
                {stack, fillColor:fill||WH, border:bA}
            ]]},
            layout:layR, margin:[0,0,0,0]
        });

        // ── ROW 0: Header ──
        // Left: Nº top-right + "1 Remitente" label + sender data
        // Right (yellow): CARTA title + legal text + CMR big + copy label + Nº pedido
        const r0 = {
            table:{
                widths:['50%','50%'],
                heights:[H.hdr],
                body:[[
                    {stack:[
                        {columns:[
                            {text:'1 Remitente',fontSize:5.5,color:LC,margin:[3,3,0,1]},
                            {text:'N\u00ba: '+num,fontSize:7,bold:true,alignment:'right',color:'#000',margin:[0,3,3,1]},
                        ]},
                        bodyTxt(sender,8,true),
                    ], fillColor:WH, border:[true,true,false,true]},
                    {stack:[
                        {text:'CARTA DE PORTE INTERNACIONAL',fontSize:7.5,bold:true,color:LC,alignment:'center',margin:[0,4,0,1]},
                        {text:'Este transporte est\u00e1 sometido no obstante toda clausula contraria, al Convenio sobre el',fontSize:5,color:'#000',alignment:'center'},
                        {text:'Contrato de Transporte internacional de mercancias por carretera ( CMR )',fontSize:5,color:'#000',alignment:'center',margin:[0,0,0,1]},
                        {text:'C  M  R',fontSize:18,bold:true,color:'#000',alignment:'center',margin:[0,1,0,1]},
                        {text:'e 1-15 ambos inclusive y 19+21+22',fontSize:5,color:LC,alignment:'center',margin:[0,0,0,2]},
                        {text:cp.lbl+' \u2014 '+cp.sub,fontSize:7.5,bold:true,color:LC,alignment:'center'},
                        ...(ref?[{text:'N\u00ba PEDIDO: '+ref,fontSize:11,bold:true,color:'#000',alignment:'center',margin:[0,2,0,0]}]:[]),
                    ], fillColor:YE, border:[false,true,true,true]},
                ]]
            },
            layout:layR, margin:[0,0,0,0]
        };

        // ── ROW 1: Consignatario | Porteador ──
        const r1 = row2(
            [redLbl('2 Consignatario'), bodyTxt(rcv,8,true)],
            [
                redLbl('16 Porteador'),
                bodyTxt(carrier,7.5,true),
                ...(plates?[{text:plates,fontSize:14,bold:true,color:'#000',margin:[3,4,3,2]}]:[]),
            ],
            H.cons
        );

        // ── ROW 2: Lugar entrega | Sucesivos ──
        const r2 = row2(
            [redLbl('3 Lugar de entrega de la mercancia'), bodyTxt(deliv,8)],
            [redLbl('17 Porteadores sucesivos'),            bodyTxt(succ,7)],
            H.ent
        );

        // ── ROW 3: Carga+fecha | Reservas ──
        const r3 = row2(
            [redLbl('4 Lugar y fecha de la carga de la mercancia'), bodyTxt(loadDate,8)],
            [redLbl('18 Reservas y observaciones del porteador'),    bodyTxt(obs,7)],
            H.crg
        );

        // ── ROW 4: Documentos ──
        const r4 = row1(
            [redLbl('5 Documentos anexos'), bodyTxt(docs+(ref?' \u2014 Ref: '+ref:''),8)],
            H.doc
        );

        // ── ROW 5: Goods — 7-column table with ALL horizontal lines ──
        const gW = ['18%','10%','14%','28%','10%','11%','9%'];
        const gh = (t,a) => ({text:t,fontSize:5.5,bold:true,color:LC,fillColor:WH,alignment:a||'left',margin:[2,2,2,2],border:bA});
        const gd = (t,a,b) => ({text:t||'',fontSize:7,bold:!!b,color:'#000',fillColor:WH,alignment:a||'left',margin:[2,2,2,2],border:bA});
        const gt = (t,a,b) => ({text:t||'',fontSize:7,bold:!!b,color:'#000',fillColor:GR,alignment:a||'left',margin:[2,2,2,2],border:bA});

        const gHdrRow = [
            gh('6 Marcas y n\u00fameros'),
            gh('7 N\u00fam. bultos','center'),
            gh('8 Clase embalaje'),
            gh('9 Naturaleza de la mercancia'),
            gh('10 N\u00ba estad\u00edstico','center'),
            gh('11 Peso Bruto Kg.','center'),
            gh('12 Volumen m3','center'),
        ];
        const gDataRows = rows8.map(l=>[
            gd(l.marks),
            gd(l.qty,'center'),
            gd(l.packing),
            gd(l.desc,'left',!!l.desc),
            gd(l.stat,'center'),
            gd(l.weight?(l.weight+' kg'):'','center'),
            gd(l.volume?String(l.volume):'','center'),
        ]);
        const gTotRow = [
            gt('TOTALES','right',true), gt('','center'), gt('','center'), gt('','center'), gt('','center'),
            gt(totalW?totalW.toFixed(2)+' kg':'','center',true),
            gt(totalV?totalV.toFixed(2):'','center',true),
        ];
        // Merge TOTALES across first 2 cols
        gTotRow[0] = {text:'TOTALES',fontSize:6.5,bold:true,color:'#000',fillColor:GR,alignment:'right',margin:[2,2,2,2],border:bA,colSpan:2};
        gTotRow[1] = {text:'',fillColor:GR,border:bA,margin:[2,2,2,2]};

        const r5 = {
            table:{
                widths:gW,
                heights:[H.ghdr,...rows8.map(()=>H.grow),H.gtot],
                body:[gHdrRow,...gDataRows,gTotRow]
            },
            layout:layG, margin:[0,0,0,0]
        };

        // ── ROW 6: Instrucciones/Pago + Emisión ──
        // Left col spans all: instrucciones(13) + forma de pago(14) + lugar emisión(21)
        // Right col: estipulaciones(19) header + text + payment table(20) + TOTAL + emission date
        // Structure based on reference: 9 rows on right side
        // row heights measured: ~11,11,11,11,11,11,11,11,11 = 9 rows × ~10.5pt = 94pt
        // But we split into: ins(85pt) block + separate rows below

        // Payment rows right side (inside ins block):
        // Row0: 19 Estipulaciones header
        // Row1: stipul text  
        // Row2: "20 A pagar | Remitente | Moneda | Cosignatario" headers
        // Row3-7: Precio/Descuentos/Liquido/Suplementos/Gts
        // Row8: TOTAL
        // Row9: lugar+fecha emisión (below)
        // Then signatures

        const payRh = Math.floor(H.ins / 9); // ~9pt per payment sub-row
        const yCell = (t) => ({text:t||'',fontSize:5.5,bold:false,color:LC,fillColor:YE,margin:[2,1,2,1],border:bA});
        const wCell = (t) => ({text:t||'',fontSize:7,color:'#000',fillColor:WH,margin:[2,1,2,1],border:bA});
        const wCellGr= (t,bold) => ({text:t||'',fontSize:7,bold:!!bold,color:'#000',fillColor:GR,margin:[2,1,2,1],border:bA});

        // Left cell: instrucciones + forma de pago + lugar emisión
        const emitLoc = D.placeEmission||'';
        const leftCell = {
            stack:[
                redLbl('13 Instrucciones del remitente'),
                bodyTxt(instr,7),
                {text:'21 Lugar y fecha de emisión',fontSize:5.5,color:LC,margin:[3,6,3,1]},
                {text:emitLoc+(dateS?'\n'+dateS:''),fontSize:7,color:'#000',margin:[3,1,3,2]},
            ],
            fillColor:WH, border:[true,true,false,true],
            rowSpan:9, margin:[0,0,0,0]
        };
        const eL = {text:'',border:[false,false,false,false],fillColor:WH};

        const r6 = {
            table:{
                widths:['50%','auto','*','*','*'],
                heights:Array(9).fill(payRh),
                body:[
                    [leftCell,
                     {text:'19 Estipulaciones particulares',fontSize:5.5,color:LC,margin:[2,1,2,1],fillColor:WH,border:[false,true,true,false],colSpan:4},{},{},{}],
                    [eL,{text:stipul,fontSize:6.5,color:'#000',margin:[2,1,2,1],fillColor:WH,border:[false,false,true,true],colSpan:4},{},{},{}],
                    [eL,
                     {text:'20 A pagar por',fontSize:5.5,color:LC,bold:false,fillColor:YE,margin:[2,1,2,1],border:bA},
                     {text:'Remitente',fontSize:5.5,bold:true,color:LC,alignment:'center',fillColor:YE,margin:[2,1,2,1],border:bA},
                     {text:'Moneda',fontSize:5.5,bold:true,color:LC,alignment:'center',fillColor:YE,margin:[2,1,2,1],border:bA},
                     {text:'Cosignatario',fontSize:5.5,bold:true,color:LC,alignment:'center',fillColor:YE,margin:[2,1,2,1],border:bA}],
                    [eL,yCell('Precio del porte'),wCell(''),wCell(''),wCell('')],
                    [eL,yCell('Descuentos'),wCell(''),wCell(''),wCell('')],
                    [eL,yCell('L\u00edquido'),wCell(''),wCell(''),wCell('')],
                    [eL,yCell('Suplementos'),wCell(''),wCell(''),wCell('')],
                    [eL,yCell('Gts.accesorios'),wCell(''),wCell(''),wCell('')],
                    [eL,
                     {text:'TOTAL',fontSize:5.5,bold:true,color:LC,fillColor:GR,margin:[2,1,2,1],border:bA},
                     wCellGr(''),wCellGr(''),wCellGr('')],
                ]
            },
            layout:layR, margin:[0,0,0,0]
        };
        // ── Sig cells with actual signature images if available ──
        const sigSndStack = [
            {text:'22',fontSize:5.5,color:LC,margin:[3,3,3,2]},
            {text:'Firma y sello del remitente',fontSize:5,color:'#aaa',margin:[3,0,3,4]},
        ];
        if(D.sigSender&&D.sigSender.startsWith('data:image')){
            sigSndStack.push({image:D.sigSender,width:120,height:55,alignment:'center',margin:[0,2,0,2]});
        }
        const sigDrvStack = [
            {text:'23',fontSize:5.5,color:LC,margin:[3,3,3,2]},
            {text:'Firma y sello del transportista',fontSize:5,color:'#aaa',margin:[3,0,3,4]},
        ];
        if(D.sigDriver&&D.sigDriver.startsWith('data:image')){
            sigDrvStack.push({image:D.sigDriver,width:120,height:55,alignment:'center',margin:[0,2,0,2]});
        }
        const r7 = {
            table:{
                widths:['33%','34%','33%'],
                heights:[H.sig],
                body:[[
                    {stack:sigSndStack,fillColor:WH,border:bA},
                    {stack:sigDrvStack,fillColor:WH,border:bA},
                    {stack:[{text:'24 Recibo de la mercancia',fontSize:5.5,color:LC,margin:[3,3,3,4]},{text:'Firma y sello del consignatario',fontSize:5,color:'#aaa',margin:[3,0,3,0]}],fillColor:BL,border:bA},
                ]]
            },
            layout:layR, margin:[0,0,0,0]
        };

        // ── Footer ──
        const footer = {
            text:isNac
                ?'1 Remitente          2 Destinatario          3 Transportista'
                :'1 Remitente          2 Destinatario          3 Transportista          4 Transportista',
            fontSize:6.5,color:'#444',margin:[4,2,4,0],alignment:'center'
        };

        // Red horizontal line separator between independent tables
        const rl = {canvas:[{type:'line',x1:0,y1:0,x2:537,y2:0,lineWidth:0.8,lineColor:LC}],margin:[0,0,0,0]};

        allContent.push({margin:[10,0,4,0], stack:[r0,rl,r1,rl,r2,rl,r3,rl,r4,rl,r5,rl,r6,rl,r7,footer]});

        if(ci<copies.length-1) allContent.push({text:'',pageBreak:'after'});
    });

    try{
        pdfMake.createPdf({
            pageSize:'A4', pageMargins:[20,6,20,4],
            content:allContent,
            defaultStyle:{font:'Roboto',fontSize:8,color:'#111'},
            info:{title:'CMR '+num,author:'CMR Manager Pro',subject:'Carta de Porte Internacional CMR'}
        }).getBlob(blob=>{
            clearTimeout(safetyTimer); showOv(false);
            const fname='CMR_CLASSIC_'+num.replace(/[^a-z0-9]/gi,'_')+'.pdf';
            _sharePDF(blob, fname, num, safetyTimer);
            setTimeout(()=>URL.revokeObjectURL(URL.createObjectURL(blob)),30000);
        });
    }catch(e){
        clearTimeout(safetyTimer);showOv(false);
        toast('\u26a0 Error: '+e.message,'err',6000);
    }
}

