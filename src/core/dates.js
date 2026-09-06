/* ── prazo de metas ── */
function metaDaysRemaining(dataAlvo){
  const target=new Date(dataAlvo+'T23:59:59');
  if(isNaN(target)) return null;
  return Math.ceil((target-today())/86400000);
}
function metaMonthsRemaining(dataAlvo){
  const days=metaDaysRemaining(dataAlvo);
  if(days===null) return null;
  if(days<=0) return 0;
  return Math.max(1,Math.ceil(days/30));
}

/* ─── data target ─── */

function defaultTargetValue(){
  const t=today(); return `${t.getFullYear()}-12-31`;
}
function getTargetDate(){
  if(data&&data.dataAlvo){ const d=new Date(data.dataAlvo+'T23:59:59'); if(!isNaN(d)) return d; }
  const t=today(); return new Date(t.getFullYear(),11,31,23,59,59);
}

/* ─── work day calculations ─── */

function daysBetweenInclusive(start,end,weekdaySet,skipSet=new Set()){
  if(start>end) return 0;
  let count=0, d=new Date(start);
  while(d<=end){
    if(weekdaySet.has(d.getDay())&&!skipSet.has(isoDate(d))) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

function remainingWorkDaysUntil(diasTrabalho,target){
  const t=today();
  if(t>target) return 0;
  const skip=new Set(data.diasNaoTrabalhados||[]);
  return daysBetweenInclusive(t,target,new Set(diasTrabalho),skip);
}

function remainingInternetCountUntil(diaDoMes,target){
  const t=today(); let count=0, year=t.getFullYear(), month=t.getMonth();
  for(let i=0;i<72;i++){
    const d=dataNoMes(year,month+1,diaDoMes);
    if(d>target) break;
    if(d>t) count++;
    month++; if(month>11){month=0;year++;}
  }
  return count;
}

function monthMetrics(fatura){
  const {ano,mes}=fatura;
  const monthStart=new Date(ano,mes-1,1), monthEnd=new Date(ano,mes,0);
  const t=today();
  const effStart=t>monthStart?t:monthStart;

  let renda=0;
  if(data.tipoRenda==='diaria'){
    let workCount=0;
    if(effStart<=monthEnd){
      const skip=new Set(data.diasNaoTrabalhados||[]);
      workCount=daysBetweenInclusive(effStart,monthEnd,new Set(data.diasTrabalho),skip);
    }
    renda=workCount*data.rendaDiaria;
  }else if(data.tipoRenda==='mensal'){
    const rmDate=dataNoMes(ano,mes,data.rendaMensal.diaDoMes);
    renda=rmDate>t?data.rendaMensal.valor:0;
  }
  if(effStart<=monthEnd){
    // mês corrente: só o que ainda vai cair (d>hoje); meses futuros: todas as ocorrências
    const iniRR=t>monthStart?t:new Date(ano,mes-1,0);
    renda+=rendasRecorrentesEntre(iniRR,monthEnd);
  }

  const faturaCusto=fatura.pago?0:fatura.valor;
  const gastosCusto=(fatura.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
  const gastosMensaisDetalhe=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,ano,mes)).map(g=>{
    const d=dataNoMes(ano,mes,g.diaDoMes);
    return {nome:g.nome,custo:d>t?g.valor:0};
  });
  const gastosMensaisCusto=gastosMensaisDetalhe.reduce((s,g)=>s+g.custo,0);
  const despesas=faturaCusto+gastosCusto+gastosMensaisCusto;
  const saldoMes=renda-despesas;
  const isPast=monthEnd<t;
  const isAtual=ano===t.getFullYear()&&mes===t.getMonth()+1;
  return {renda,gastosCusto,gastosMensaisDetalhe,gastosMensaisCusto,despesas,saldoMes,isPast,isAtual};
}

