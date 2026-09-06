/* ── aviso de saldo negativo ── */
function renderNegativeWarning(){
  const el=document.getElementById('negative-warning'); if(!el) return;
  const points=getTrajectoryPoints();
  const firstNeg=points.slice(1).find(p=>p.value<0);
  if(firstNeg){
    el.innerHTML=`<div class="warn-banner">⚠️ ${esc(L('warn.saldoNegativo').replace('{mes}',firstNeg.monthLabel).replace('{valor}',formatBRL(firstNeg.value)))}</div>`;
  }else{
    el.innerHTML='';
  }
}

/* ── aviso de renda mensal atrasada: passou o dia esperado e o saldo não foi atualizado ── */
function renderRendaAtrasadaWarning(){
  const el=document.getElementById('renda-atrasada-warning'); if(!el) return;
  if(data.tipoRenda!=='mensal'||!data.rendaMensal||!data.rendaMensal.diaDoMes){ el.innerHTML=''; return; }
  const t=today();
  const diaPagamento=data.rendaMensal.diaDoMes;
  if(t<dataNoMes(t.getFullYear(),t.getMonth()+1,diaPagamento)){ el.innerHTML=''; return; }
  const atualizadoEm=data.saldoAtualizadoEm?new Date(data.saldoAtualizadoEm):null;
  const pagamentoEsperado=dataNoMes(t.getFullYear(),t.getMonth()+1,diaPagamento);
  const jaAtualizouDepoisDoPagamento=atualizadoEm && atualizadoEm>=pagamentoEsperado;
  if(jaAtualizouDepoisDoPagamento){ el.innerHTML=''; return; }
  el.innerHTML=`<div class="warn-banner">💰 ${L('renda.jaCaiuPergunta')}</div>`;
}

/* ── aviso de fatura perto de vencer ── */
function renderFaturaWarning(){
  const el=document.getElementById('fatura-warning'); if(!el) return;
  const t=today();
  const diaGlobal=Math.min(31,Math.max(1,data.diaVencimentoFatura||10));
  const alerts=data.faturas
    .filter(f=>!f.pago)
    .map(f=>{
      const cartao=(data.cartoes||[]).find(c=>c.id===f.cartaoId);
      const dia=Math.min(31,Math.max(1,(cartao&&cartao.diaVencimento)||diaGlobal));
      const venc=startOfDay(dataNoMes(f.ano,f.mes,dia));
      const diff=Math.round((venc-t)/86400000);
      return {f,diff};
    })
    .filter(a=>a.diff<=5&&a.diff>=-30)
    .sort((a,b)=>a.diff-b.diff);
  const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  const contaAlerts=(data.gastosMensais||[])
    .filter(g=>gastoFixoAtivoEm(g,anoA,mesA))
    .map(g=>{
      const venc=startOfDay(dataNoMes(anoA,mesA,g.diaDoMes));
      const diff=Math.round((venc-t)/86400000);
      return {g,diff};
    })
    .filter(a=>a.diff>=0&&a.diff<=5)
    .sort((a,b)=>a.diff-b.diff);
  const fechamentoAlerts=(data.cartoes||[])
    .filter(c=>c.diaFechamento)
    .map(c=>{
      let venc=startOfDay(dataNoMes(anoA,mesA,c.diaFechamento));
      if(venc<t){ const nx=nextMonth(anoA,mesA); venc=startOfDay(dataNoMes(nx.ano,nx.mes,c.diaFechamento)); }
      const diff=Math.round((venc-t)/86400000);
      return {c,diff};
    })
    .filter(a=>a.diff>=0&&a.diff<=3)
    .sort((a,b)=>a.diff-b.diff);
  if(alerts.length===0&&contaAlerts.length===0&&fechamentoAlerts.length===0){ el.innerHTML=''; return; }
  const idi=data.idioma||'pt';
  const dia=(n)=>({pt:n===1?'dia':'dias',en:n===1?'day':'days',es:n===1?'día':'días',fr:n===1?'jour':'jours'})[idi];
  const faturaHtml=alerts.map(a=>{
    const mesNome=MONTH_NAMES[a.f.mes-1];
    let txt;
    if(idi==='en') txt=a.diff<0?`${mesNome} invoice was due ${Math.abs(a.diff)} ${dia(Math.abs(a.diff))} ago and hasn't been marked as paid.`:a.diff===0?`${mesNome} invoice is due today and hasn't been marked as paid.`:`${mesNome} invoice is due in ${a.diff} ${dia(a.diff)} and hasn't been marked as paid.`;
    else if(idi==='es') txt=a.diff<0?`La factura de ${mesNome} venció hace ${Math.abs(a.diff)} ${dia(Math.abs(a.diff))} y aún no se marcó como pagada.`:a.diff===0?`La factura de ${mesNome} vence hoy y aún no se marcó como pagada.`:`La factura de ${mesNome} vence en ${a.diff} ${dia(a.diff)} y aún no se marcó como pagada.`;
    else if(idi==='fr') txt=a.diff<0?`La facture de ${mesNome} est échue depuis ${Math.abs(a.diff)} ${dia(Math.abs(a.diff))} et n'a pas encore été marquée payée.`:a.diff===0?`La facture de ${mesNome} est due aujourd'hui et n'a pas encore été marquée payée.`:`La facture de ${mesNome} est due dans ${a.diff} ${dia(a.diff)} et n'a pas encore été marquée payée.`;
    else txt=a.diff<0?`Fatura de ${mesNome} venceu há ${Math.abs(a.diff)} dia${Math.abs(a.diff)===1?'':'s'} e ainda não foi marcada como paga.`:a.diff===0?`Fatura de ${mesNome} vence hoje e ainda não foi marcada como paga.`:`Fatura de ${mesNome} vence em ${a.diff} dia${a.diff===1?'':'s'} e ainda não foi marcada como paga.`;
    return `<div class="warn-banner">⚠️ ${esc(txt)}</div>`;
  }).join('');
  const contaHtml=contaAlerts.map(a=>{
    let txt;
    if(idi==='en') txt=a.diff===0?`"${a.g.nome}" is due today.`:`"${a.g.nome}" is due in ${a.diff} ${dia(a.diff)}.`;
    else if(idi==='es') txt=a.diff===0?`"${a.g.nome}" vence hoy.`:`"${a.g.nome}" vence en ${a.diff} ${dia(a.diff)}.`;
    else if(idi==='fr') txt=a.diff===0?`« ${a.g.nome} » est due aujourd'hui.`:`« ${a.g.nome} » est due dans ${a.diff} ${dia(a.diff)}.`;
    else txt=a.diff===0?`Conta "${a.g.nome}" vence hoje.`:`Conta "${a.g.nome}" vence em ${a.diff} dia${a.diff===1?'':'s'}.`;
    return `<div class="warn-banner">📅 ${esc(txt)}</div>`;
  }).join('');
  const fechamentoHtml=fechamentoAlerts.map(a=>{
    let txt;
    if(idi==='en') txt=a.diff===0?`${a.c.nome}'s invoice closes today — purchases from tomorrow already go to the next one.`:`${a.c.nome}'s invoice closes in ${a.diff} ${dia(a.diff)}.`;
    else if(idi==='es') txt=a.diff===0?`La factura de ${a.c.nome} cierra hoy — las compras desde mañana ya entran en la siguiente.`:`La factura de ${a.c.nome} cierra en ${a.diff} ${dia(a.diff)}.`;
    else if(idi==='fr') txt=a.diff===0?`La facture de ${a.c.nome} se clôture aujourd'hui — les achats à partir de demain iront dans la suivante.`:`La facture de ${a.c.nome} se clôture dans ${a.diff} ${dia(a.diff)}.`;
    else txt=a.diff===0?`A fatura do ${a.c.nome} fecha hoje — compras feitas a partir de amanhã já entram na próxima.`:`A fatura do ${a.c.nome} fecha em ${a.diff} dia${a.diff===1?'':'s'}.`;
    return `<div class="warn-banner">🔒 ${esc(txt)}</div>`;
  }).join('');
  el.innerHTML=faturaHtml+contaHtml+fechamentoHtml;
}

