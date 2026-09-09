/* ── reserva de emergência: meta calculada a partir dos gastos fixos ativos ── */
function custoMensalEssencial(){
  const hoje=today();
  const ano=hoje.getFullYear(), mes=hoje.getMonth()+1;
  const num=v=>{ const n=parseNum(v); return isNaN(n)?0:n; };

  const fixos=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,ano,mes)).reduce((s,g)=>s+num(g.valor),0);

  /* média da fatura: usa os meses já fechados; se não houver nenhum ainda,
     cai pro mês atual pra não zerar o cálculo de quem começou a usar agora */
  const totalFatura=f=>num(f.valor)+(f.gastos||[]).reduce((a,g)=>a+num(g.valor),0);
  const kAtual=chaveMes(ano,mes);
  const porMesFat=new Map();
  (data.faturas||[]).forEach(f=>{
    const k=chaveMes(f.ano,f.mes);
    if(k>=kAtual) return; // só meses já fechados
    porMesFat.set(k,(porMesFat.get(k)||0)+totalFatura(f));
  });
  let chaves=[...porMesFat.keys()].sort((a,b)=>a-b).slice(-3); // os 3 ÚLTIMOS meses
  if(chaves.length===0){ // ninguém fechou ainda: cai pro mês atual, somando os cartões
    (data.faturas||[]).forEach(f=>{
      const k=chaveMes(f.ano,f.mes);
      if(k===kAtual) porMesFat.set(k,(porMesFat.get(k)||0)+totalFatura(f));
    });
    chaves=[...porMesFat.keys()];
  }
  const mediaFatura=chaves.length?chaves.reduce((s,k)=>s+porMesFat.get(k),0)/chaves.length:0;

  const custo=fixos+mediaFatura;
  if(custo>0) return custo;

  /* último recurso: média do que realmente saiu nos últimos 3 meses com movimento */
  const meses=[];
  for(let i=1;i<=3;i++){ let m=mes-i,a=ano; while(m<1){ m+=12; a--; } meses.push(computeMonthSpend(a,m)); }
  const comMovimento=meses.filter(v=>v>0);
  return comMovimento.length?comMovimento.reduce((s,v)=>s+v,0)/comMovimento.length:0;
}
