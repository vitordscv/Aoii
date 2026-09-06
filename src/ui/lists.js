/* ── lists ── */
function renderList(key,listElId,totalElId,doneField,doneLabel){
  const items=data[key];
  const total=items.filter(it=>!it[doneField])
    .reduce((s,it)=>s+(key==='entradasExtras'?restanteEntrada(it):it.valor),0);
  const showTiming=key==='comprasPlanejadas';
  const showDate=key==='entradasExtras'||key==='comprasPlanejadas';
  const emptyHtml=key==='entradasExtras'
    ?`<div class="empty-illus"><span class="ei-icon">🌊</span>${L('empty.semEntradaExtra')}<br>${L('empty.semEntradaExtraSub')}</div>`
    :`<div class="empty-illus"><span class="ei-icon">🛍️</span>${L('empty.semCompra')}<br>${L('empty.semCompraSub')}</div>`;
  document.getElementById(listElId).innerHTML=items.length===0?emptyHtml:items.map(it=>{
    const timing=(showTiming&&!it[doneField])?suggestPurchaseTiming(it):null;
    return `
    <div class="item-row${it[doneField]?' feito':''}">
      <input type="checkbox" class="item-check" data-key="${key}" data-id="${it.id}" data-action="toggle-feito" ${it[doneField]?'checked':''} title="${doneLabel}">
      <div class="item-texts">
        <input type="text" class="item-nome" data-key="${key}" data-id="${it.id}" data-action="edit-nome" value="${esc(it.nome)}">
        ${it.nota?`<div class="item-nota">${esc(it.nota)}</div>`:''}
        ${(key==='entradasExtras'&&!it[doneField]&&(it.recebido||0)>0)?`<div class="item-cartao-tag">💰 ${L('lista.jaRecebeu').replace('{recebido}',formatBRL(it.recebido)).replace('{total}',formatBRL(it.valor)).replace('{falta}',formatBRL(restanteEntrada(it)))}</div>`:''}
        ${(key==='entradasExtras'&&!it[doneField])?`<button type="button" class="add-gasto-btn item-recebi-btn" data-action="mostrar-recebi" data-id="${it.id}">+ ${L('lista.recebi')}</button>
        <div class="add-gasto-form item-recebi-form" id="recebi-${it.id}">
          <input type="text" inputmode="decimal" placeholder="0,00" data-role="recebi-valor" data-id="${it.id}">
          <button class="add-gasto-confirm" data-action="registrar-recebi" data-id="${it.id}">${L('btn.confirmar')}</button>
        </div>`:''}
        ${(key==='entradasExtras'&&!it[doneField]&&(it.modo||'unica')!=='unica')?(()=>{
          if(it.modo==='semPrevisao') return `<div class="item-cartao-tag">🕗 ${L('lista.foraDaProjecao')}</div>`;
          const f=fatiasAosPoucos(it);
          return `<div class="item-cartao-tag">🧩 ${f?L('lista.divididoEm').replace('{n}',f.meses).replace('{valor}',formatBRL(f.porMes)):L('lista.escolhaAte')}</div>`;})():''}
        ${(key==='comprasPlanejadas'&&!it[doneField])?`<label class="item-cartao-toggle" title="${esc(L('tt.marqueCartao'))}"><input type="checkbox" data-action="toggle-cartao-item" data-key="${key}" data-id="${it.id}" ${it.cartao?'checked':''}> ${L('gasto.cartaoLabel')}</label>`:''}
        ${(key==='comprasPlanejadas'&&it.cartao)?`<div class="item-cartao-tag">💳 ${(data.cartoes||[]).length>1?esc((data.cartoes.find(c=>c.id===it.cartaoId)||{}).nome||'Cartão')+' · ':''}${(it.parcelas||1)>1?`${it.parcelas}x`:''}${it.parcelasLancadas?' · já lançada nas faturas':''}</div>`:''}
        ${timing?`<div class="item-timing ${timing.ok?'ok':'wait'}">${timing.ok?'✓':'⏳'} ${esc(timing.when)}</div>`:''}
      </div>
      ${(key==='entradasExtras'&&!it[doneField])?`<select class="item-modo" data-action="edit-modo" data-key="${key}" data-id="${it.id}" title="${esc(L('tt.modoEntrada'))}">
        ${['unica','aosPoucos','semPrevisao'].map(m=>`<option value="${m}"${(it.modo||'unica')===m?' selected':''}>${L('modo.'+m)}</option>`).join('')}
      </select>`:''}
      ${(showDate&&!(key==='entradasExtras'&&it.modo==='semPrevisao'))?`<input type="date" class="item-data" data-key="${key}" data-id="${it.id}" data-action="edit-data" value="${it.dataPrevista||''}" title="${esc(L(it.modo==='aosPoucos'?'tt.ateQuando':'tt.dataPrevista'))}">`:''}
      <input type="text" inputmode="decimal" step="0.01" class="item-valor" data-key="${key}" data-id="${it.id}" data-action="edit-valor" value="${it.valor}">
      <button class="item-del" data-key="${key}" data-id="${it.id}" data-action="del-item" title="${esc(L('btn.remover'))}">✕</button>
    </div>`;
  }).join('');
  document.getElementById(totalElId).textContent=formatBRL(total);

  const el=document.getElementById(listElId);
  el.querySelectorAll('[data-action="mostrar-recebi"]').forEach(b=>b.addEventListener('click',()=>{
    const f=document.getElementById('recebi-'+b.getAttribute('data-id'));
    if(!f) return;
    const abrindo=!f.classList.contains('aberto');
    f.classList.toggle('aberto',abrindo);
    if(abrindo) f.querySelector('[data-role="recebi-valor"]').focus();
  }));
  el.querySelectorAll('[data-action="registrar-recebi"]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.getAttribute('data-id');
    const it=(data.entradasExtras||[]).find(x=>x.id===id); if(!it) return;
    const campo=document.querySelector('[data-role="recebi-valor"][data-id="'+id+'"]');
    const v=parseNum(campo&&campo.value);
    if(isNaN(v)||v<=0){ campo&&campo.focus(); return; }
    const falta=restanteEntrada(it);
    const valor=Math.min(v,falta);           // nunca registra mais do que falta
    /* entra no saldo e aparece no Diário — é dinheiro que chegou */
    registrarReceita(it.nome||L('rp.entradaExtra'),valor,'Outros','pix');
    it.recebido=(it.recebido||0)+valor;
    if(restanteEntrada(it)<=0){ it.feito=true; it.feitoEm=todayISO(); }
    vibrate(12);
    await persist(); render();
  }));
  el.querySelectorAll('[data-action="edit-modo"]').forEach(x=>x.addEventListener('change',async e=>{
    const it=data[e.target.getAttribute('data-key')].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){ it.modo=e.target.value; vibrate(8); await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="toggle-cartao-item"]').forEach(x=>x.addEventListener('change',async e=>{
    const k=e.target.getAttribute('data-key');
    const it=data[k].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){
      it.cartao=e.target.checked;
      if(it.cartao){
        if(!it.parcelas) it.parcelas=1;
        if(!it.cartaoId) it.cartaoId=data.cartoes[0]&&data.cartoes[0].id;
        it.parcelasLancadas=false;
      }
      await persist(); render();
    }
  }));
  el.querySelectorAll('[data-action="toggle-feito"]').forEach(x=>x.addEventListener('change',async e=>{
    const k=e.target.getAttribute('data-key');
    const it=data[k].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){
      it[doneField]=e.target.checked;
      if(it[doneField]) it.feitoEm=todayISO(); else delete it.feitoEm;
      if(k==='comprasPlanejadas'&&it.cartao&&it[doneField]&&!it.parcelasLancadas){
        const start=it.dataPrevista?new Date(it.dataPrevista+'T12:00:00'):new Date();
        lancarParcelamento(it.nome,it.valor,it.parcelas||1,start.getFullYear(),start.getMonth()+1,'Outros',it.cartaoId);
        it.parcelasLancadas=true;
      }
      await persist(); render();
    }
  }));
  el.querySelectorAll('[data-action="edit-nome"]').forEach(x=>x.addEventListener('change',async e=>{
    const it=data[e.target.getAttribute('data-key')].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){ it.nome=e.target.value; await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="edit-valor"]').forEach(x=>x.addEventListener('change',async e=>{
    const it=data[e.target.getAttribute('data-key')].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){ it.valor=parseNum(e.target.value)||0; await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="edit-data"]').forEach(x=>x.addEventListener('change',async e=>{
    const it=data[e.target.getAttribute('data-key')].find(x=>x.id===e.target.getAttribute('data-id'));
    if(it){ it.dataPrevista=e.target.value||null; await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="del-item"]').forEach(x=>x.addEventListener('click',e=>{
    const k=e.target.getAttribute('data-key'), id=e.target.getAttribute('data-id');
    const idx=data[k].findIndex(x=>x.id===id); if(idx<0) return;
    const removed=data[k].splice(idx,1)[0];
    vibrate(15); render();
    showUndoToast(L('undo.removido').replace('{nome}',removed.nome),()=>{ data[k].splice(Math.min(idx,data[k].length),0,removed); });
  }));
}

