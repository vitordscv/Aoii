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

function definirOrcamento(categoria,valor){
  if(!CATS().includes(categoria)) return null;
  valor=Number(valor);
  if(!Number.isFinite(valor)||valor<0) return null;
  if(!data.orcamentos) data.orcamentos={};
  data.orcamentos[categoria]=valor;
  return valor;
}
