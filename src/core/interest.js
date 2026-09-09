/* ── investimentos: taxas, mediana de dividendos e juros ── */
function mediana(arr){
  if(!arr.length) return 0;
  const s=[...arr].sort((a,b)=>a-b);
  const mid=Math.floor(s.length/2);
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}
function taxaAnualDisponivel(qual){ // 'cdi' | 'selic' → % a.a. ou null
  const tm=data.taxasManuais||{};
  return (typeof tm[qual]==='number'&&tm[qual]>0)?tm[qual]:null;
}

/* juros simples e compostos, com aporte mensal opcional */
function jurosProjetados(principal,aporteMensal,taxaAnualPct,meses){
  const rAno=taxaAnualPct/100;
  const rMes=Math.pow(1+rAno,1/12)-1; // equivalente mensal (composto)
  const rMesSimples=rAno/12;          // proporcional (simples)
  let composto=principal*Math.pow(1+rMes,meses);
  let simples=principal*(1+rMesSimples*meses);
  for(let i=1;i<=meses;i++){
    composto+=aporteMensal*Math.pow(1+rMes,meses-i);
    simples+=aporteMensal*(1+rMesSimples*(meses-i));
  }
  const investido=principal+aporteMensal*meses;
  return {simples,composto,investido};
}
