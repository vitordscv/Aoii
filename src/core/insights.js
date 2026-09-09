/* ── insights automáticos do Resumo ── */
function computeInsights(){
  const hoje=new Date();
  const y=hoje.getFullYear(),m=hoje.getMonth();
  const pm=m===0?11:m-1, py=m===0?y-1:y;
  const doMes=[],doAnterior=[];
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00'); if(isNaN(d)) return;
    if(d.getFullYear()===y&&d.getMonth()===m) doMes.push(t);
    else if(d.getFullYear()===py&&d.getMonth()===pm) doAnterior.push(t);
  });
  const insights=[];
  if(doMes.length){
    const porCat={};
    doMes.forEach(t=>{ porCat[t.categoria]=(porCat[t.categoria]||0)+t.valor; });
    const top=Object.entries(porCat).sort((a,b)=>b[1]-a[1])[0];
    insights.push({title:L('insights.maiorCategoria'),value:formatBRL(top[1]),sub:top[0],categoria:top[0]});
    const maior=doMes.reduce((a,b)=>b.valor>a.valor?b:a);
    insights.push({icon:'💸',title:L('insights.maiorGasto'),value:formatBRL(maior.valor),sub:maior.nome});
  }
  if(doMes.length&&doAnterior.length){
    const tot=doMes.reduce((s,t)=>s+t.valor,0), ant=doAnterior.reduce((s,t)=>s+t.valor,0);
    const delta=tot-ant;
    const pct=ant>0?Math.abs(delta/ant*100).toFixed(0)+'%':'';
    insights.push({icon:delta>0?'📈':'📉',title:L('insights.vsMesAnterior'),
      value:(delta>0?'+':'−')+formatBRL(Math.abs(delta)),
      sub:delta>0?`${L('insights.gastandoMais').replace('{pct}',pct)}`:`${L('insights.gastandoMenos').replace('{pct}',pct)}`});
  }
  return insights.slice(0,3);
}
