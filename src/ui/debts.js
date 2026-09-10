/* ── dívidas ──
   Lista separada de propósito. Entrada extra e compra planejada já dividem
   renderList(); a dívida não entra ali porque tem uma coisa que as outras não
   têm: um progresso. O que importa numa dívida não é o total nem o que falta
   isolado, é a relação entre os dois — quanto do caminho já foi andado. Uma
   barra mostra isso numa olhada; uma linha de texto não. */

function porcentagemPaga(d){
  const total=(d&&d.valor)||0;
  if(total<=0) return 0;
  return Math.max(0,Math.min(100,((d.pago||0)/total)*100));
}

function renderDividas(){
  const itens=data.dividas||[];
  const pendentes=itens.filter(d=>!d.quitado);
  const total=pendentes.reduce((s,d)=>s+restanteDivida(d),0);

  const vazio=`<div class="empty-illus"><span class="ei-icon">🤝</span>${L('empty.semDivida')}<br>${L('empty.semDividaSub')}</div>`;

  document.getElementById('dividas-list').innerHTML=itens.length===0?vazio:itens.map(d=>{
    const falta=restanteDivida(d);
    const pct=porcentagemPaga(d);
    /* só sai texto de L(); a escolha mora aqui pra não parecer dado do usuário */
    const semData=(d.modo||'semPrevisao')==='semPrevisao';
    return `
    <div class="item-row divida-row${d.quitado?' feito':''}">
      <input type="checkbox" class="item-check" data-id="${d.id}" data-action="toggle-quitado" ${d.quitado?'checked':''} title="${esc(L('divida.marcarQuitada'))}">
      <div class="item-texts">
        <input type="text" class="item-nome" data-id="${d.id}" data-action="edit-divida-nome" value="${esc(d.nome)}">
        <input type="text" class="item-credor" data-id="${d.id}" data-action="edit-divida-credor" value="${esc(d.credor||'')}" placeholder="${esc(L('ph.credor'))}" aria-label="${esc(L('aria.credor'))}">
        ${d.quitado?`<div class="item-cartao-tag">✓ ${L('divida.quitada')}</div>`:`
        <div class="divida-barra" role="img" aria-label="${esc(L('divida.progressoAria').replace('{pago}',formatBRL(d.pago||0)).replace('{total}',formatBRL(d.valor)))}">
          <div class="divida-barra-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <div class="divida-progresso">${L('divida.progresso').replace('{pago}',formatBRL(d.pago||0)).replace('{total}',formatBRL(d.valor)).replace('{falta}',formatBRL(falta))}</div>
        <button type="button" class="add-gasto-btn item-recebi-btn" data-action="mostrar-paguei" data-id="${d.id}">+ ${L('divida.paguei')}</button>
        <div class="add-gasto-form item-recebi-form" id="paguei-${d.id}">
          <input type="text" inputmode="decimal" placeholder="0,00" data-role="paguei-valor" data-id="${d.id}" aria-label="${esc(L('aria.valorPago'))}">
          <button class="add-gasto-confirm" data-action="registrar-paguei" data-id="${d.id}">${L('btn.confirmar')}</button>
        </div>
        ${semData?`<div class="item-cartao-tag">🕗 ${L('divida.foraDaProjecao')}</div>`:''}`}
      </div>
      ${d.quitado?'':`<select class="item-modo" data-action="edit-divida-modo" data-id="${d.id}" title="${esc(L('tt.modoDivida'))}">
        ${['semPrevisao','unica','aosPoucos'].map(m=>`<option value="${m}"${(d.modo||'semPrevisao')===m?' selected':''}>${L('modoDivida.'+m)}</option>`).join('')}
      </select>`}
      ${(!d.quitado&&!semData)?`<input type="date" class="item-data" data-id="${d.id}" data-action="edit-divida-data" value="${d.dataPrevista||''}" title="${esc(L(d.modo==='aosPoucos'?'tt.ateQuando':'tt.dataPrevista'))}">`:''}
      <input type="text" inputmode="decimal" step="0.01" class="item-valor" data-id="${d.id}" data-action="edit-divida-valor" value="${d.valor}" title="${esc(L('tt.totalDevido'))}">
      <button class="item-del" data-id="${d.id}" data-action="del-divida" title="${esc(L('btn.remover'))}">✕</button>
    </div>`;
  }).join('');

  document.getElementById('dividas-total').textContent=formatBRL(total);

  const el=document.getElementById('dividas-list');
  const editar=(seletor,campo,valor)=>el.querySelectorAll(seletor).forEach(x=>x.addEventListener('change',async e=>{
    if(atualizarPlanejado('divida',e.target.getAttribute('data-id'),{[campo]:valor(e.target)})){
      vibrate(8); await persist(); render();
    }
  }));
  editar('[data-action="edit-divida-nome"]','nome',t=>t.value);
  editar('[data-action="edit-divida-credor"]','credor',t=>t.value);
  editar('[data-action="edit-divida-valor"]','valor',t=>parseNum(t.value));
  editar('[data-action="edit-divida-modo"]','modo',t=>t.value);
  editar('[data-action="edit-divida-data"]','dataPrevista',t=>t.value||null);

  el.querySelectorAll('[data-action="toggle-quitado"]').forEach(x=>x.addEventListener('change',async e=>{
    if(definirPlanejadoFeito('divida',e.target.getAttribute('data-id'),e.target.checked)){ await persist(); render(); }
  }));

  el.querySelectorAll('[data-action="mostrar-paguei"]').forEach(b=>b.addEventListener('click',()=>{
    const f=document.getElementById('paguei-'+b.getAttribute('data-id'));
    if(!f) return;
    const abrindo=!f.classList.contains('aberto');
    f.classList.toggle('aberto',abrindo);
    if(abrindo){ const campo=f.querySelector('[data-role="paguei-valor"]'); campo&&campo.focus(); }
  }));

  el.querySelectorAll('[data-action="registrar-paguei"]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.getAttribute('data-id');
    const campo=el.querySelector('[data-role="paguei-valor"][data-id="'+id+'"]');
    const v=parseNum(campo&&campo.value);
    if(isNaN(v)||v<=0){ campo&&campo.focus(); return; }
    if(!registrarPagamentoDivida(id,v)) return;
    vibrate(12);
    await persist(); render();
  }));

  el.querySelectorAll('[data-action="del-divida"]').forEach(x=>x.addEventListener('click',e=>{
    const removida=removerPlanejado('divida',e.target.getAttribute('data-id'));
    if(!removida) return;
    vibrate(15); render();
    showUndoToast(L('undo.removido').replace('{nome}',removida.item.nome),()=>{
      restaurarPlanejado('divida',removida.item,removida.indice);
    });
  }));
}
