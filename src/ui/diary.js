  /* ── melhorias: busca do diário, CSV, undo e calculadora de investimentos ── */
  const buscaEl=document.getElementById('diario-busca');
  if(buscaEl) buscaEl.addEventListener('input',e=>{ diarioBusca=e.target.value; renderTransacoesList(); });
  document.getElementById('repetir-gasto-btn')?.addEventListener('click',async()=>{
    const last=(data.transacoes||[])[0];
    if(!last){ vibrate(15); return; }
    registrarTransacao(last.nome,last.valor,last.categoria,last.metodo);
    const t=data.transacoes[0];
    if(t){ t.tags=last.tags||[]; t.viagemId=last.viagemId||null; }
    vibrate([10,30,10]);
    await persist(); render();
    showUndoToast(L('diary.repeated').replace('{name}',`"${last.nome}"`),()=>{ removerTransacao(t.id); });
  });
  const mesFiltroEl=document.getElementById('diario-mes-filtro');
  if(mesFiltroEl) mesFiltroEl.addEventListener('change',e=>{ diarioMesFiltro=e.target.value; vibrate(6); renderTransacoesList(); });
  const csvBtn=document.getElementById('export-csv-btn');
  if(csvBtn) csvBtn.addEventListener('click',exportTransacoesCSV);
  bindUndoToast();
  bindCalculadora();
}

/* ── filtro de categoria do Diário (pills) ── */
let transacoesFiltro='Todos';
/* ── card resumo "Gasto no diário" (mês corrente) ── */
function renderDiarioSummaryCard(){
  const el=document.getElementById('diario-summary-card'); if(!el) return;
  const hoje=new Date();
  const ano=hoje.getFullYear(), mes=hoje.getMonth()+1;
  const doMes=transacoesGasto().filter(t=>{
    const d=new Date(t.data+'T12:00:00');
    return d.getFullYear()===ano && (d.getMonth()+1)===mes;
  });
  const total=doMes.reduce((s,t)=>s+t.valor,0);
  const renda=rendaMediaMensal();
  const pct=renda>0?(total/renda)*100:0;
  const mesNome=(MONTH_NAMES[mes-1]||'').toUpperCase();

  el.innerHTML=`
    <div>
      <div class="diario-summary-label">${L('diario.gastoNoDia')} · ${esc(mesNome)}</div>
      <div class="diario-summary-value" data-countup="${total}" data-countkey="diario-total">${formatBRL(total)}</div>
      <div class="diario-summary-sub">${renda>0?`${pct.toFixed(0)}% ${L('daily.daRenda')}`:L('diario.rendaNaoConfigurada')} · ${doMes.length} ${doMes.length===1?L('diario.lancamento'):L('diario.lancamentos')}</div>
    </div>
    <div class="diario-summary-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/><path d="M18.5 14.5l2 2L16 21l-2.3.3.3-2.3z"/></svg>
    </div>`;
}

function renderTransacoesFiltro(){
  const el=document.getElementById('transacoes-filter'); if(!el) return;
  const cats=['Todos',...CATS(),'__credito'];
  el.innerHTML=cats.map(c=>c==='__credito'?`<button type="button" class="cat-pill${transacoesFiltro==='__credito'?' active':''}" aria-pressed="${transacoesFiltro==='__credito'}" data-cat="__credito">🧾 ${esc(L('pay.credito'))}</button>`:`<button type="button" class="cat-pill${c===transacoesFiltro?' active':''}" aria-pressed="${c===transacoesFiltro}" data-cat="${esc(c)}">${c==='Todos'?'✨':catIcon(c)} ${c==='Todos'?esc(L('filtro.todos')):esc(categoriaLabel(c))}</button>`).join('');
  el.querySelectorAll('.cat-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      transacoesFiltro=btn.getAttribute('data-cat');
      vibrate(6);
      renderTransacoesFiltro(); renderTransacoesList();
    });
  });
}

/* ── histórico de compras em débito/dinheiro (com busca, mês, swipe e undo) ── */
let diarioBusca='';
let diarioMesFiltro='todos';
function renderDiarioMesOptions(){
  const sel=document.getElementById('diario-mes-filtro'); if(!sel) return;
  const meses=new Set();
  (data.transacoes||[]).forEach(t=>{ if(t.data) meses.add(String(t.data).slice(0,7)); });
  const sorted=[...meses].sort().reverse();
  sel.innerHTML=[`<option value="todos">${L('diary.allMonths')}</option>`].concat(sorted.map(m=>{
    const parts=m.split('-');
    return `<option value="${m}">${MONTH_NAMES[parseInt(parts[1],10)-1]} ${parts[0]}</option>`;
  })).join('');
  sel.value=(diarioMesFiltro==='todos'||sorted.includes(diarioMesFiltro))?diarioMesFiltro:'todos';
}
function renderTransacoesList(){
  const el=document.getElementById('transacoes-list'); if(!el) return;
  renderDiarioMesOptions();
  const creditoItems=[];
  (data.faturas||[]).forEach(f=>{
    (f.gastos||[]).forEach(g=>{
      const dt=g.dataCompra||`${f.ano}-${String(f.mes).padStart(2,'0')}-01`;
      creditoItems.push({id:'fat-'+g.id,nome:g.nome,valor:g.valor,categoria:g.categoria,metodo:'credito',data:dt,_cartaoId:f.cartaoId,_readonly:true});
    });
  });
  const all=(data.transacoes||[]).concat(creditoItems).sort((a,b)=>(b.data||'').localeCompare(a.data||''));
  const busca=diarioBusca.trim().toLowerCase();
  const list=all.filter(t=>{
    if(transacoesFiltro==='__credito'&&t.metodo!=='credito') return false;
    if(transacoesFiltro!=='Todos'&&transacoesFiltro!=='__credito'&&t.categoria!==transacoesFiltro) return false;
    if(diarioMesFiltro!=='todos'&&String(t.data||'').slice(0,7)!==diarioMesFiltro) return false;
    if(busca){
      const matchNome=String(t.nome||'').toLowerCase().includes(busca);
      const matchTag=(t.tags||[]).some(tg=>tg.toLowerCase().includes(busca));
      if(!matchNome&&!matchTag) return false;
    }
    return true;
  });
  if(all.length===0){
    el.innerHTML=`<div class="diario-history-title">${L('empty.historico')}</div><div class="empty-illus"><span class="ei-icon">🍃</span>${L('empty.nenhumaCompraDebito')}<br>${L('empty.toqueNoMais')}</div>`;
    return;
  }
  if(list.length===0){
    el.innerHTML=`<div class="diario-history-title">${L('empty.historico')}</div><div class="empty-illus"><span class="ei-icon">🔍</span>${L('empty.nadaEncontrado')}</div>`;
    return;
  }
  el.innerHTML=`
    <div class="diario-history-title">${L('empty.historicoDebito')}</div>
    ${list.map(t=>`
    <div class="swipe-item" data-id="${t.id}">
      <div class="swipe-actions">
        <button type="button" class="swipe-act-edit" title="${esc(L('btn.editar'))}" aria-label="${esc(L('a11y.editItem').replace('{name}',t.nome))}">✏️</button>
        <button type="button" class="swipe-act-del" title="${esc(L('btn.excluir'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',t.nome))}">🗑</button>
      </div>
      <div class="swipe-content">
        <div class="item-row">
          <div class="item-texts">
            <span class="item-nome" style="display:block;">${esc(t.nome)}</span>
            <div class="item-cartao-tag">${t.tipo==='receita'?'⬆️ '+L('diario.entrada'):t.metodo==='dinheiro'?'💵 '+L('pay.dinheiro'):t.metodo==='pix'?'⚡ '+L('pay.pix'):t.metodo==='credito'?'💳 '+L('pay.credito')+(t._cartaoId?' '+esc(nomeCartao(t._cartaoId)):''):'💳 '+L('pay.debito')} · ${catIcon(t.categoria)} ${esc(categoriaLabel(t.categoria))}${t.percentual&&t.percentual<100?` · ${t.percentual}% ${L('common.of')} ${formatBRL(t.valorTotal||0)}`:''}${t.viagemId?` · ✈️ ${esc(nomeViagem(t.viagemId))}`:''} · ${new Date(t.data+'T12:00:00').toLocaleDateString(localeAtual())}</div>
            ${t.nota?`<div class="item-nota">${esc(t.nota)}</div>`:''}
            ${(t.tags&&t.tags.length)?`<div class="item-tags">${t.tags.map(tg=>`<span class="tag-pill">#${esc(tg)}</span>`).join('')}</div>`:''}
          </div>
          <span class="item-valor" style="border:none;background:none;text-align:right;${t.tipo==='receita'?'color:var(--pos);':''}">${t.tipo==='receita'?'+':''}${formatBRL(t.valor)}</span>
          ${t._readonly?`<span class="item-lock" title="${esc(L('diario.editeNaFatura'))}">🔒</span>`:`
          <button type="button" class="item-del" data-action="edit-transacao" data-id="${t.id}" title="${esc(L('btn.editar'))}" aria-label="${esc(L('a11y.editItem').replace('{name}',t.nome))}">✎</button>
          <button type="button" class="item-del" data-action="del-transacao" data-id="${t.id}" title="${esc(L('tt.removerDevolve'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',t.nome))}">✕</button>`}
        </div>
      </div>
    </div>`).join('')}`;
  function doDelete(id){
    const t=(data.transacoes||[]).find(x=>x.id===id); if(!t) return;
    const idx=data.transacoes.indexOf(t);
    removerTransacao(id);
    vibrate(15);
    render();
    showUndoToast(L('undo.removida').replace('{nome}',t.nome),()=>{
      data.transacoes.splice(Math.min(idx,data.transacoes.length),0,t);
      // desfaz o estorno feito no saldo/dinheiro vivo — com o MESMO sinal que
      // removerTransacao() usou, senão uma entrada é descontada duas vezes
      const sinal=t.tipo==='receita'?-1:1;
      if(t.metodo==='dinheiro') data.dinheiroVivo=(data.dinheiroVivo||0)-sinal*t.valor;
      else data.saldoAtual=(data.saldoAtual||0)-sinal*t.valor;
    });
  }
  el.querySelectorAll('[data-action="del-transacao"]').forEach(btn=>{
    btn.addEventListener('click',e=>{ e.stopPropagation(); doDelete(btn.getAttribute('data-id')); });
  });
  el.querySelectorAll('[data-action="edit-transacao"]').forEach(btn=>{
    btn.addEventListener('click',e=>{ e.stopPropagation(); openGastoEditSheet(btn.getAttribute('data-id')); });
  });
  el.querySelectorAll('.swipe-item').forEach(item=>{
    const id=item.getAttribute('data-id');
    if(id.startsWith('fat-')) return; // compras no crédito: só editáveis dentro da fatura (aba Fixos)
    attachSwipe(item,{
      onEdit:()=>openGastoEditSheet(id),
      onDelete:()=>doDelete(id),
    });
  });
}
