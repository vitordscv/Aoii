/* ── linha do tempo financeira: o motor único do app ────────────────────
   hero, gráfico, linha do tempo e sugestão de compra leem TODOS daqui, então
   os números nunca divergem entre si.
   Um ponto por mês, do mês da fatura mais antiga até o mais distante entre a
   data-alvo, a última fatura e a última data prevista das listas — meses sem
   fatura entram do mesmo jeito (renda e gastos fixos acontecem neles também).
   Cada ponto já traz renda, gastos fixos, faturas de TODOS os cartões,
   entradas extras e compras planejadas daquele mês.                        */
function chaveMes(ano,mes){ return ano*12+(mes-1); }

/* o que ainda falta receber de uma entrada extra: o total menos o que já veio */
function restanteEntrada(e){ return Math.max(0,(e&&e.valor||0)-(e&&e.recebido||0)); }

/* em quantos meses uma entrada "aos poucos" cai, e quanto por mês */
function fatiasAosPoucos(item){
  if(!item||item.modo!=='aosPoucos'||!item.dataPrevista) return null;
  const t=today();
  const atual=chaveMes(t.getFullYear(),t.getMonth()+1);
  const d=new Date(item.dataPrevista+'T12:00:00');
  if(isNaN(d)) return null;
  const fim=Math.max(atual,chaveMes(d.getFullYear(),d.getMonth()+1));
  const meses=fim-atual+1;
  return {meses,porMes:restanteEntrada(item)/meses};
}

/* lançamentos que são gasto de verdade — "entrada inesperada" (receita) fora */
function transacoesGasto(){ return (data.transacoes||[]).filter(t=>t.tipo!=='receita'); }

let _tlMemo=new Map();
function invalidarTimeline(){ _tlMemo.clear(); }
function buildTimeline(opts){
  const chave=(opts&&opts.exceto)?('x:'+opts.exceto):'-';
  if(_tlMemo.has(chave)) return _tlMemo.get(chave);
  const pontos=_buildTimeline(opts);
  _tlMemo.set(chave,pontos);
  return pontos;
}
function _buildTimeline(opts){
  opts=opts||{};
  const t=today();
  const mesAtual=chaveMes(t.getFullYear(),t.getMonth()+1);

  const porMes=new Map();
  faturasPorMes().forEach(fs=>porMes.set(chaveMes(fs[0].ano,fs[0].mes),fs));

  /* item das listas cai no mês da data prevista; sem data (ou data já vencida),
     vale a partir de agora — igual ao que o hero sempre fez */
  const mesDoItem=it=>{
    if(it.dataPrevista){
      const d=new Date(it.dataPrevista+'T12:00:00');
      if(!isNaN(d)){ const k=chaveMes(d.getFullYear(),d.getMonth()+1); if(k>mesAtual) return k; }
    }
    return mesAtual;
  };
  const extrasPorMes=new Map(), comprasPorMes=new Map();
  const soma=(map,k,v)=>map.set(k,(map.get(k)||0)+(v||0));
  (data.entradasExtras||[]).forEach(e=>{
    if(e.feito) return;
    const modo=e.modo||'unica';
    if(modo==='semPrevisao') return;   // continua a receber, mas não entra na projeção
    const falta=restanteEntrada(e);
    if(falta<=0) return;
    if(modo==='aosPoucos'&&e.dataPrevista){
      /* recebendo em pedaços: espalha o que falta do mês atual até o mês escolhido */
      const kFim=mesDoItem(e);
      const meses=Math.max(1,kFim-mesAtual+1);
      const parte=falta/meses;
      for(let k=mesAtual;k<=kFim;k++) soma(extrasPorMes,k,parte);
    }else{
      soma(extrasPorMes,mesDoItem(e),falta);
    }
  });
  (data.comprasPlanejadas||[]).forEach(c=>{ if(!c.feito&&c.id!==opts.exceto) soma(comprasPorMes,mesDoItem(c),c.valor); });

  /* aportes automáticos das metas saem da conta todo mês, até a meta encher */
  const metasAtivas=(data.metas||[]).filter(m=>m.aporteMensal>0);
  const restanteMeta=metasAtivas.map(m=>(m.valorAlvo||0)>0?Math.max(0,(m.valorAlvo||0)-(m.valorGuardado||0)):Infinity);

  const alvo=getTargetDate();
  let ini=mesAtual, fim=Math.max(mesAtual,chaveMes(alvo.getFullYear(),alvo.getMonth()+1));
  const abrange=k=>{ if(k<ini) ini=k; if(k>fim) fim=k; };
  porMes.forEach((fs,k)=>abrange(k));
  extrasPorMes.forEach((v,k)=>abrange(k));
  comprasPorMes.forEach((v,k)=>abrange(k));
  if(fim-ini>600) fim=ini+600; // trava de segurança

  let cum=data.saldoAtual+(data.dinheiroVivo||0);
  const pontos=[];
  for(let k=ini;k<=fim;k++){
    const ano=Math.floor(k/12), mes=k%12+1;
    const fs=porMes.get(k)||null;
    const m=fs?mesMetrics(fs):monthMetrics({ano,mes,valor:0,pago:true,gastos:[]});
    const extras=extrasPorMes.get(k)||0;
    const compras=comprasPorMes.get(k)||0;
    let aportes=0;
    if(k>mesAtual) metasAtivas.forEach((mt,i)=>{ // o aporte do mês corrente já foi aplicado ao abrir o app
      if(!(restanteMeta[i]>0)) return;
      const v=Math.min(mt.aporteMensal,restanteMeta[i]);
      aportes+=v; restanteMeta[i]-=v;
    });
    const delta=m.saldoMes+extras-compras-aportes;
    cum+=delta;
    pontos.push({k,ano,mes,fs,m,extras,compras,aportes,delta,value:cum,isPast:m.isPast,
      label:MONTH_ABBR[mes-1],monthLabel:MONTH_NAMES[mes-1]+'/'+ano});
  }
  return pontos;
}

/* saldo previsto no fim do mês de uma data — o mesmo número que o gráfico mostra */
function saldoPrevistoEm(alvo,pontos){
  pontos=pontos||buildTimeline();
  const k=chaveMes(alvo.getFullYear(),alvo.getMonth()+1);
  let val=data.saldoAtual+(data.dinheiroVivo||0);
  for(const p of pontos){ if(p.k>k) break; val=p.value; }
  return val;
}

function computeTotals(){
  const target=getTargetDate();
  const kAlvo=chaveMes(target.getFullYear(),target.getMonth()+1);
  const pontos=buildTimeline();

  const workDays=data.tipoRenda==='diaria'?remainingWorkDaysUntil(data.diasTrabalho,target):0;

  let rendaTrabalho=0, gastosMensaisTotal=0, faturasPendentes=0, aportesPrevistos=0;
  pontos.forEach(p=>{
    if(p.k>kAlvo) return;
    rendaTrabalho+=p.m.renda;
    gastosMensaisTotal+=p.m.gastosMensaisCusto;
    faturasPendentes+=p.m.despesas-p.m.gastosMensaisCusto;
    aportesPrevistos+=p.aportes||0;
  });

  const aReceber=(data.entradasExtras||[]).filter(e=>!e.feito);
  const entradasPendentes=aReceber.reduce((s,e)=>s+restanteEntrada(e),0);
  const entradasSemPrevisao=aReceber.filter(e=>e.modo==='semPrevisao').reduce((s,e)=>s+restanteEntrada(e),0);
  const entradasNaProjecao=entradasPendentes-entradasSemPrevisao;
  const comprasPendentes=(data.comprasPlanejadas||[]).filter(c=>!c.feito).reduce((s,c)=>s+c.valor,0);
  const projetado=saldoPrevistoEm(target,pontos);
  return {workDays,rendaTrabalho,gastosMensaisTotal,faturasPendentes,entradasPendentes,
          entradasSemPrevisao,entradasNaProjecao,comprasPendentes,
          aportesPrevistos,projetado,target};
}

