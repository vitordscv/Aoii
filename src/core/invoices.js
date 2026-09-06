/* ── faturas agrupadas por mês ──
   com mais de um cartão existe UMA fatura por cartão no mesmo mês; sem agrupar,
   renda e gastos fixos do mês seriam contados uma vez por cartão ── */
function faturasPorMes(){
  const byMonth=new Map();
  [...data.faturas].sort((a,b)=>(a.ano*12+a.mes)-(b.ano*12+b.mes)).forEach(f=>{
    const k=f.ano*12+f.mes;
    if(!byMonth.has(k)) byMonth.set(k,[]);
    byMonth.get(k).push(f);
  });
  return [...byMonth.values()];
}

/* métricas do mês inteiro: renda + gastos fixos 1x, faturas de todos os cartões */
function mesMetrics(fs){
  const m=monthMetrics(fs[0]); // renda + gastos fixos do mês (1x)
  for(let i=1;i<fs.length;i++){ // demais cartões: soma só a parte de fatura deles
    const extra=(fs[i].pago?0:fs[i].valor)+(fs[i].gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
    m.despesas+=extra; m.saldoMes-=extra;
  }
  return m;
}

