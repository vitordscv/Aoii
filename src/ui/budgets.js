/* ── orçamento por categoria: apresentação e edição ── */
function renderOrcamentos(){
  const el=document.getElementById('orcamento-card'); if(!el) return;
  const gastos=computeGastoMesPorCategoria();
  const estouradas=[];
  el.innerHTML=CATS().map(cat=>{
    const teto=(data.orcamentos||{})[cat]||0;
    const gasto=gastos[cat]||0;
    const pct=teto>0?Math.min(100,(gasto/teto)*100):0;
    const over=teto>0&&gasto>teto;
    if(over) estouradas.push({cat,gasto,teto});
    const barClass=over?'danger':(teto>0&&pct>=80?'warn':'');
    return `
    <div class="orc-row">
      <div class="orc-top">
        <span class="orc-nome">${catIcon(cat)} ${esc(categoriaLabel(cat))}</span>
        <span class="orc-gasto">${formatBRL(gasto)} /</span>
        <input type="text" inputmode="decimal" step="1" min="0" class="orc-teto-input" data-cat="${esc(cat)}" value="${teto||''}" placeholder="${esc(L('ph.semTeto'))}" aria-label="${esc(L('budget.capFor').replace('{cat}',categoriaLabel(cat)))}">
      </div>
      ${teto>0?`
      <div class="orc-bar-track"><div class="orc-bar-fill ${barClass}" style="width:${pct}%;"></div></div>
      <div class="orc-foot"><span>${L('budget.percentCap').replace('{pct}',((gasto/teto)*100).toFixed(0))}</span><span>${over?L('budget.exceededBy').replace('{value}',formatBRL(gasto-teto)):L('budget.remaining').replace('{value}',formatBRL(teto-gasto))}</span></div>`:''}
    </div>`;
  }).join('')+
  estouradas.map(e2=>`<div class="warn-banner">⚠️ ${L('budget.warning').replace('{cat}',catIcon(e2.cat)+' '+esc(categoriaLabel(e2.cat))).replace('{spent}',formatBRL(e2.gasto)).replace('{cap}',formatBRL(e2.teto))}</div>`).join('')+
  `<div class="orc-hint">${L('orc.hint')}</div>`;
  el.querySelectorAll('.orc-teto-input').forEach(inp=>inp.addEventListener('change',async e=>{
    if(!data.orcamentos) data.orcamentos={};
    const v=parseNum(e.target.value);
    data.orcamentos[e.target.getAttribute('data-cat')]=isNaN(v)||v<=0?0:v;
    vibrate(8);
    await persist(); render();
  }));
}
