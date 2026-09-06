/* ── aviso de meta perto do prazo ── */
/* ── calcula sobra mensal média real (renda - gastos fixos - fatura média) ── */
function sobraMensalMedia(){
  const meses=buildTimeline().filter(p=>!p.isPast);
  if(meses.length===0) return null;
  return meses.reduce((s,p)=>s+p.m.saldoMes,0)/meses.length;
}

/* ── renda média mensal (baseado nas próximas faturas da linha do tempo) ── */
function rendaMediaMensal(){
  const meses=buildTimeline().filter(p=>!p.isPast);
  const totalRR=rendasRecorrentesAtivas().reduce((s,r)=>s+r.valor,0);
  if(meses.length===0){
    return (data.tipoRenda==='mensal'?(data.rendaMensal.valor||0):0)+totalRR;
  }
  return Math.max(meses.reduce((s,p)=>s+p.m.renda,0)/meses.length,totalRR);
}

