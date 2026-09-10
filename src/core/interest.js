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
function atualizarTaxasManuais(taxas,atualizadoEm){
  if(!taxas||typeof taxas!=='object') return false;
  const proximas={};
  for(const chave of ['cdi','selic']){
    if(!(chave in taxas)) continue;
    const valor=taxas[chave];
    if(valor!==null&&(!Number.isFinite(valor)||valor<0)) return false;
    proximas[chave]=valor;
  }
  if(!Object.keys(proximas).length) return false;
  if(!data.taxasManuais) data.taxasManuais={cdi:null,selic:null,atualizadoEm:null};
  Object.assign(data.taxasManuais,proximas);
  data.taxasManuais.atualizadoEm=atualizadoEm||new Date().toISOString();
  return true;
}

/* Juros simples e compostos, com aporte mensal opcional.

   Os dois lados usam A MESMA taxa mensal. Isso não é detalhe: antes o simples
   usava a taxa proporcional (rAno/12) e o composto a equivalente
   ((1+rAno)^(1/12)-1), que é sempre menor. Com aporte mensal, o simples
   passava na frente do composto em qualquer prazo de até um ano — a tela
   dizia que juros simples rendem mais que compostos, o que ninguém acredita
   e com razão: não eram dois regimes comparados, eram duas taxas diferentes.

   Com a mesma taxa mensal a comparação é honesta: iguais no primeiro mês,
   composto à frente daí em diante, sempre. O preço é que "12% a.a." no
   simples fecha o ano em 11,39% — que é o que juros simples de fato dão
   quando a taxa mensal é a equivalente da anual. */
function jurosProjetados(principal,aporteMensal,taxaAnualPct,meses){
  const rMes=Math.pow(1+taxaAnualPct/100,1/12)-1; // equivalente mensal
  let composto=principal*Math.pow(1+rMes,meses);
  let simples=principal*(1+rMes*meses);
  for(let i=1;i<=meses;i++){
    composto+=aporteMensal*Math.pow(1+rMes,meses-i);
    simples+=aporteMensal*(1+rMes*(meses-i));
  }
  const investido=principal+aporteMensal*meses;
  return {simples,composto,investido};
}
