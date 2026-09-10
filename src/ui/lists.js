/* ── lists ── */
/* Rótulo curto pro link: o domínio, sem o www. Se por algum motivo a URL
   guardada não parsear, mostra o texto cru — quem valida é o schema. */
function hostDoLink(u){
  try{ return new URL(u).hostname.replace(/^www[.]/,''); }catch(e){ return String(u||''); }
}

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
    /* só sai texto de L(); a escolha mora aqui pra não parecer dado do usuário */
    const rotuloDetalhes=(it.nota||it.link)?L('lista.detalhesEditar'):'+ '+L('lista.detalhesAdicionar');
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
        ${(key==='comprasPlanejadas'&&it.cartao)?`<div class="item-cartao-tag">💳 ${(data.cartoes||[]).length>1?esc((data.cartoes.find(c=>c.id===it.cartaoId)||{}).nome||L('list.cardDefault'))+' · ':''}${(it.parcelas||1)>1?`${it.parcelas}x`:''}${it.parcelasLancadas?' · '+L('list.alreadyPosted'):''}</div>`:''}
        ${(key==='comprasPlanejadas'&&it.link)?`<a class="item-link" href="${esc(it.link)}" target="_blank" rel="noopener noreferrer nofollow" title="${esc(L('lista.abrirLink'))}">🔗 ${esc(hostDoLink(it.link))}</a>`:''}
        ${(key==='comprasPlanejadas'&&!it[doneField])?`<button type="button" class="add-gasto-btn item-detalhes-btn" data-action="mostrar-detalhes" data-id="${it.id}" aria-expanded="false" aria-controls="detalhes-${it.id}">${rotuloDetalhes}</button>
        <div class="add-gasto-form item-detalhes-form" id="detalhes-${it.id}">
          <input type="text" maxlength="2000" data-role="detalhe-nota" data-id="${it.id}" placeholder="${esc(L('ph.motivoCompra'))}" aria-label="${esc(L('aria.motivoCompra'))}" value="${esc(it.nota||'')}">
          <input type="url" inputmode="url" maxlength="500" data-role="detalhe-link" data-id="${it.id}" placeholder="${esc(L('ph.linkCompra'))}" aria-label="${esc(L('aria.linkCompra'))}" value="${esc(it.link||'')}">
          <div class="item-detalhes-erro" data-role="detalhe-erro" data-id="${it.id}" role="alert"></div>
          <button class="add-gasto-confirm" data-action="salvar-detalhes" data-id="${it.id}">${L('btn.salvar')}</button>
        </div>`:''}
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
    const campo=document.querySelector('[data-role="recebi-valor"][data-id="'+id+'"]');
    const v=parseNum(campo&&campo.value);
    if(isNaN(v)||v<=0){ campo&&campo.focus(); return; }
    if(!registrarRecebimentoEntrada(id,v)) return;
    vibrate(12);
    await persist(); render();
  }));
  el.querySelectorAll('[data-action="mostrar-detalhes"]').forEach(b=>b.addEventListener('click',()=>{
    const f=document.getElementById('detalhes-'+b.getAttribute('data-id'));
    if(!f) return;
    const abrindo=!f.classList.contains('aberto');
    f.classList.toggle('aberto',abrindo);
    b.setAttribute('aria-expanded',abrindo?'true':'false');
    if(abrindo){ const primeiro=f.querySelector('[data-role="detalhe-nota"]'); primeiro&&primeiro.focus(); }
  }));
  el.querySelectorAll('[data-action="salvar-detalhes"]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.getAttribute('data-id');
    const campoNota=el.querySelector('[data-role="detalhe-nota"][data-id="'+id+'"]');
    const campoLink=el.querySelector('[data-role="detalhe-link"][data-id="'+id+'"]');
    const erro=el.querySelector('[data-role="detalhe-erro"][data-id="'+id+'"]');
    if(!campoNota||!campoLink) return;
    const it=atualizarPlanejado('compra',id,{nota:campoNota.value,link:campoLink.value});
    if(!it){
      /* o motivo é texto livre e nunca reprova; sobra o link */
      if(erro) erro.textContent=L('erro.linkInvalido');
      campoLink.setAttribute('aria-invalid','true');
      campoLink.focus();
      return;
    }
    if(erro) erro.textContent='';
    campoLink.removeAttribute('aria-invalid');
    vibrate(8); await persist(); render();
  }));
  el.querySelectorAll('[data-action="edit-modo"]').forEach(x=>x.addEventListener('change',async e=>{
    const it=atualizarPlanejado('entrada',e.target.getAttribute('data-id'),{modo:e.target.value});
    if(it){ vibrate(8); await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="toggle-cartao-item"]').forEach(x=>x.addEventListener('change',async e=>{
    const k=e.target.getAttribute('data-key');
    const atual=(data[k]||[]).find(x=>x.id===e.target.getAttribute('data-id'));
    const it=atual&&atualizarPlanejado('compra',atual.id,{cartao:e.target.checked,cartaoId:atual.cartaoId||(data.cartoes[0]&&data.cartoes[0].id),parcelasLancadas:false});
    if(it){ await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="toggle-feito"]').forEach(x=>x.addEventListener('change',async e=>{
    const k=e.target.getAttribute('data-key');
    const tipo=k==='entradasExtras'?'entrada':'compra';
    if(definirPlanejadoFeito(tipo,e.target.getAttribute('data-id'),e.target.checked)){ await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="edit-nome"]').forEach(x=>x.addEventListener('change',async e=>{
    const tipo=e.target.getAttribute('data-key')==='entradasExtras'?'entrada':'compra';
    if(atualizarPlanejado(tipo,e.target.getAttribute('data-id'),{nome:e.target.value})){ await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="edit-valor"]').forEach(x=>x.addEventListener('change',async e=>{
    const tipo=e.target.getAttribute('data-key')==='entradasExtras'?'entrada':'compra';
    if(atualizarPlanejado(tipo,e.target.getAttribute('data-id'),{valor:parseNum(e.target.value)})){ await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="edit-data"]').forEach(x=>x.addEventListener('change',async e=>{
    const tipo=e.target.getAttribute('data-key')==='entradasExtras'?'entrada':'compra';
    if(atualizarPlanejado(tipo,e.target.getAttribute('data-id'),{dataPrevista:e.target.value||null})){ await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="del-item"]').forEach(x=>x.addEventListener('click',e=>{
    const k=e.target.getAttribute('data-key'), id=e.target.getAttribute('data-id');
    const tipo=k==='entradasExtras'?'entrada':'compra';
    const removed=removerPlanejado(tipo,id); if(!removed) return;
    vibrate(15); render();
    showUndoToast(L('undo.removido').replace('{nome}',removed.item.nome),()=>{ restaurarPlanejado(tipo,removed.item,removed.indice); });
  }));
}
