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
  function aviso(chave,campos){
    let texto=L(chave);
    Object.entries(campos||{}).forEach(([nome,valor])=>{ texto=texto.replace('{'+nome+'}',String(valor)); });
    return texto;
  }
  const unidadeDias=n=>L(n===1?'time.day':'time.days');
  const faturaHtml=alerts.map(a=>{
    const mesNome=MONTH_NAMES[a.f.mes-1];
    const quantidade=Math.abs(a.diff);
    const chave=a.diff<0?'warn.invoiceOverdue':a.diff===0?'warn.invoiceToday':'warn.invoiceIn';
    const txt=aviso(chave,{month:mesNome,count:quantidade,days:unidadeDias(quantidade)});
    return `<div class="warn-banner">⚠️ ${esc(txt)}</div>`;
  }).join('');
  const contaHtml=contaAlerts.map(a=>{
    const chave=a.diff===0?'warn.billToday':'warn.billIn';
    const txt=aviso(chave,{name:a.g.nome,count:a.diff,days:unidadeDias(a.diff)});
    return `<div class="warn-banner">📅 ${esc(txt)}</div>`;
  }).join('');
  const fechamentoHtml=fechamentoAlerts.map(a=>{
    const chave=a.diff===0?'warn.cardClosesToday':'warn.cardClosesIn';
    const txt=aviso(chave,{name:a.c.nome,count:a.diff,days:unidadeDias(a.diff)});
    return `<div class="warn-banner">🔒 ${esc(txt)}</div>`;
  }).join('');
  el.innerHTML=faturaHtml+contaHtml+fechamentoHtml;
}

