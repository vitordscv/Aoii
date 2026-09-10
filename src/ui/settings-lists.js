/* ── lista de viagens/eventos com orçamento próprio ── */
function renderViagensList(){
  const el=document.getElementById('viagens-list'); if(!el) return;
  const viagens=data.viagens||[];
  if(!viagens.length){ el.innerHTML=`<div class="cat-empty">${L('empty.nenhumaViagem')}</div>`; return; }
  el.innerHTML=viagens.map(v=>{
    const gasto=transacoesGasto().filter(t=>t.viagemId===v.id).reduce((s,t)=>s+t.valor,0);
    return `
    <div class="cat-manage-row">
      <span>✈️ ${esc(v.nome)} — ${formatBRL(gasto)}${v.orcamento>0?` / ${formatBRL(v.orcamento)}`:''}</span>
      <button type="button" class="cat-manage-del" data-id="${v.id}" title="${esc(L('btn.remover'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',v.nome))}">✕</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.cat-manage-del').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.getAttribute('data-id');
    if(!(await confirmDialog({text:L('confirm.removerViagem')}))) return;
    if(!removerViagem(id)) return;
    await persist(); render();
  }));
}

/* ── lista de categorias personalizadas nas configurações ── */
function renderCategoriasList(){
  const el=document.getElementById('categorias-list'); if(!el) return;
  el.innerHTML=CATS().map(c=>`
    <div class="cat-manage-row">
      <span>${catIcon(c)} ${esc(categoriaLabel(c))}</span>
      <button type="button" class="cat-manage-del" data-cat="${esc(c)}" title="${esc(L('btn.remover'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',categoriaLabel(c)))}">✕</button>
    </div>`).join('');
  el.querySelectorAll('.cat-manage-del').forEach(btn=>btn.addEventListener('click',async()=>{
    const cat=btn.getAttribute('data-cat');
    if(CATS().length<=1) return;
    if(!(await confirmDialog({text:L('confirm.removerCategoria').replace('{cat}',categoriaLabel(cat))}))) return;
    if(!removerCategoria(cat)) return;
    await persist(); render();
  }));
}

/* ── lista de cartões nas configurações (nomear + múltiplos) ── */
function renderCartoesList(){
  const el=document.getElementById('cartoes-list'); if(!el) return;
  const list=data.cartoes||[];
  const emptyEl=document.getElementById('cartoes-empty-state');
  if(list.length===0){
    el.innerHTML='';
    if(emptyEl) emptyEl.style.display='block';
  }else{
    if(emptyEl) emptyEl.style.display='none';
    el.innerHTML=list.map(c=>{
      const subParts=[];
      if(c.diaFechamento) subParts.push(`${L('cartao.fechaDia')} ${c.diaFechamento}`);
      if(c.diaVencimento) subParts.push(`${L('cartao.venceDia')} ${c.diaVencimento}`);
      const sub=subParts.length?subParts.join(' · '):L('cartao.semDiasConfig');
      return `
      <div class="gf-item-row" data-action="edit-cartao" data-id="${c.id}" role="button" tabindex="0" aria-label="${esc(L('a11y.editItem').replace('{name}',c.nome))}">
        <div class="gf-item-main">
          <div class="gf-item-nome">${esc(c.nome)}</div>
          <div class="gf-item-sub">${esc(sub)}</div>
        </div>
        <div class="gf-item-valor">${c.limite>0?formatBRL(c.limite):L('cartao.semLimite')}</div>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-action="edit-cartao"]').forEach(row=>{
      ativarComoBotao(row,()=>openCartaoSheet(row.getAttribute('data-id')),row.getAttribute('aria-label'));
    });
  }
  refreshCartaoSelects();
}

/* mantém os seletores "em qual cartão" atualizados sempre que a lista de cartões mudar */
function refreshCartaoSelects(){
  const purchasesCartaoEl=document.getElementById('purchases-cartao-select');
  if(purchasesCartaoEl){
    purchasesCartaoEl.innerHTML=(data.cartoes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    purchasesCartaoEl.style.display=(data.cartoes||[]).length>1?'':'none';
  }
}

/* ── limite do cartão ── */
function renderLimitCard(){
  const el=document.getElementById('limit-card'); if(!el) return;
  const cartoes=data.cartoes||[];
  if(!cartoes.length||!cartoes.some(c=>c.limite>0)){
    el.innerHTML=`<div class="limit-empty">${L('cartao.definaLimite')}</div>`;
    return;
  }
  el.innerHTML=cartoes.map(cartao=>{
    const c=computeCartao(cartao.id);
    if(!c.limite) return '';
    const barClass=c.pct>=90?'danger':(c.pct>=70?'warn':'');
    return `
    <div class="limit-card-item">
      <div class="limit-card-nome">${esc(cartao.nome)}</div>
      <div class="limit-top">
        <span class="lbl" data-i18n="cartao.comprometidoLbl">Comprometido</span>
        <span class="val">${formatBRL(c.comprometido)}</span>
      </div>
      <div class="limit-bar-track"><div class="limit-bar-fill ${barClass}" style="width:${c.pct}%;"></div></div>
      <div class="limit-foot">
        <span>${c.pct.toFixed(0)}% ${L('cartao.doLimite')}</span>
        <span>${L('cartao.disponivel')}: ${formatBRL(c.disponivel)}</span>
      </div>
      ${c.faturaAberta>0?`<div class="limit-fatura-aberta">🧾 ${L('cartao.faturaDe')} ${c.faturaAbertaMes} ${L('cartao.emAberto')}: ${formatBRL(c.faturaAberta)}</div>`:''}
    </div>`;
  }).join('');
}
