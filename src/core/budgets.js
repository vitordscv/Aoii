/* ── orçamento por categoria (teto mensal + consumo do mês) ── */
function computeGastoMesPorCategoria(){
  const hoje=new Date(); const y=hoje.getFullYear(),m=hoje.getMonth();
  const map={};
  const add=(c,v)=>{ c=c||'Outros'; map[c]=(map[c]||0)+v; };
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00');
    if(!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m) add(t.categoria,t.valor);
  });
  (data.faturas||[]).forEach(f=>{
    if(f.ano===y&&f.mes===m+1) (f.gastos||[]).forEach(g=>add(g.categoria,g.valor));
  });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,y,m+1)) add(g.categoria,g.valor); });
  return map;
}
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
        <span class="orc-nome">${catIcon(cat)} ${esc(cat)}</span>
        <span class="orc-gasto">${formatBRL(gasto)} /</span>
        <input type="text" inputmode="decimal" step="1" min="0" class="orc-teto-input" data-cat="${esc(cat)}" value="${teto||''}" placeholder="${esc(L('ph.semTeto'))}">
      </div>
      ${teto>0?`
      <div class="orc-bar-track"><div class="orc-bar-fill ${barClass}" style="width:${pct}%;"></div></div>
      <div class="orc-foot"><span>${((gasto/teto)*100).toFixed(0)}% do teto</span><span>${over?'estourou '+formatBRL(gasto-teto):'restam '+formatBRL(teto-gasto)}</span></div>`:''}
    </div>`;
  }).join('')+
  estouradas.map(e2=>`<div class="warn-banner">⚠️ Orçamento de ${catIcon(e2.cat)} ${esc(e2.cat)} estourado: ${formatBRL(e2.gasto)} de ${formatBRL(e2.teto)} este mês.</div>`).join('')+
  `<div class="orc-hint">${L('orc.hint')}</div>`;
  el.querySelectorAll('.orc-teto-input').forEach(inp=>inp.addEventListener('change',async e=>{
    if(!data.orcamentos) data.orcamentos={};
    const v=parseNum(e.target.value);
    data.orcamentos[e.target.getAttribute('data-cat')]=isNaN(v)||v<=0?0:v;
    vibrate(8);
    await persist(); render();
  }));
}

