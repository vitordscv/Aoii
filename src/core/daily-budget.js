/* ── orçamento diário compartilhado pelo cartão e pelo calendário ── */
function computeDailyBudget(){
  const t=today();
  const ano=t.getFullYear(), mes=t.getMonth()+1;
  const monthEnd=new Date(ano,mes,0);
  const diasRestantes=Math.max(1,Math.round((monthEnd-t)/86400000)+1);
  let renda=0;
  if(data.tipoRenda==='diaria'){
    const skip=new Set(data.diasNaoTrabalhados||[]);
    renda=daysBetweenInclusive(t,monthEnd,new Set(data.diasTrabalho),skip)*(data.rendaDiaria||0);
  }else if(data.tipoRenda==='mensal'){
    const rmDate=dataNoMes(ano,mes,data.rendaMensal.diaDoMes);
    renda=rmDate>t?(data.rendaMensal.valor||0):0;
  }
  renda+=rendasRecorrentesEntre(t,monthEnd);
  let despesas=0;
  (data.faturas||[]).filter(f=>f.ano===ano&&f.mes===mes).forEach(f=>{
    despesas+=(f.pago?0:f.valor)+(f.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
  });
  (data.gastosMensais||[]).forEach(g=>{
    if(!gastoFixoAtivoEm(g,ano,mes)) return;
    const d=dataNoMes(ano,mes,g.diaDoMes);
    if(d>t) despesas+=g.valor;
  });
  const pontoDoMes=buildTimeline().find(p=>p.k===chaveMes(ano,mes));
  const disponivel=pontoDoMes
    ? pontoDoMes.value
    : (data.saldoAtual||0)+(data.dinheiroVivo||0)+renda-despesas;
  let reservaMetas=0;
  (data.metas||[]).forEach(mt=>{
    const alvo=mt.valorAlvo||0, guard=mt.valorGuardado||0;
    if(alvo<=0||guard>=alvo||!mt.dataAlvo) return;
    if(mt.aporteMensal>0) return;
    const meses=metaMonthsRemaining(mt.dataAlvo);
    if(meses===null||meses<=0) return;
    reservaMetas+=(alvo-guard)/meses;
  });
  const disponivelLivre=disponivel-reservaMetas;
  const isoHoje=isoDate(t);
  const gastoHoje=transacoesGasto().filter(x=>x.data===isoHoje).reduce((s,x)=>s+x.valor,0);
  const porDiaHoje=(disponivelLivre+gastoHoje)/diasRestantes;
  const restanteHoje=porDiaHoje-gastoHoje;
  const porDia=disponivelLivre/diasRestantes;
  return {porDia,porDiaHoje,restanteHoje,diasRestantes,disponivel,disponivelLivre,reservaMetas,gastoHoje,renda};
}
