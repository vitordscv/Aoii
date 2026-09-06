function renderPatrimonioChart(points){
  if(points.length<2) return `<div class="patrimonio-empty">${L('pat.volteProximoMes')}</div>`;
  const W=700,H=180,padL=54,padR=14,padT=16,padB=26;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const vals=points.map(p=>p.valor);
  let vMin=Math.min(0,...vals), vMax=Math.max(0,...vals);
  if(vMin===vMax){ vMin-=10; vMax+=10; }
  const pad=(vMax-vMin)*0.12; vMin-=pad; vMax+=pad;
  const x=i=>padL+(innerW*(points.length===1?0:i/(points.length-1)));
  const y=v=>padT+innerH-((v-vMin)/(vMax-vMin))*innerH;
  const linePath=points.map((p,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const areaPath=`${linePath} L${x(points.length-1).toFixed(1)},${(padT+innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT+innerH).toFixed(1)} Z`;
  // evita labels amontoados: mostra no máx ~6 rótulos no eixo x, sem exigir scroll horizontal
  const step=Math.max(1,Math.ceil(points.length/6));
  const xLabels=points.map((p,i)=>{
    if(i%step!==0&&i!==points.length-1) return '';
    return `<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9" fill="var(--muted2)">${MONTH_ABBR[p.mes-1]}</text>`;
  }).join('');
  const dots=points.map((p,i)=>`<circle cx="${x(i)}" cy="${y(p.valor)}" r="3.5" fill="var(--disney-blue-deep)" stroke="var(--white)" stroke-width="1.2" data-tt="${MONTH_ABBR[p.mes-1]}/${p.ano}" data-tt-val="${esc(formatBRL(p.valor))}"/>`).join('');
  return `
    <div class="patrimonio-chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="patFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--disney-blue-deep)" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="var(--disney-blue-deep)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#patFade)"/>
        <path d="${linePath}" fill="none" stroke="var(--disney-blue-deep)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
        ${xLabels}
      </svg>
    </div>`;
}

function renderPatrimonio(){
  const card=document.getElementById('patrimonio-card'); if(!card) return;
  ensurePatrimonioSnapshot();

  const hoje=new Date();
  const ano=hoje.getFullYear(), mes=hoje.getMonth()+1;
  const list=(data.patrimonioHistorico||[]).slice().sort((a,b)=>(a.ano*12+a.mes)-(b.ano*12+b.mes));
  const atual=list.find(p=>p.ano===ano&&p.mes===mes);
  const valorAtual=atual?atual.valor:patrimonioCalculado();
  const idx=list.indexOf(atual);
  const anterior=idx>0?list[idx-1]:null;
  let deltaHtml='';
  if(anterior){
    const delta=valorAtual-anterior.valor;
    const cls=delta>0.005?'pos':(delta<-0.005?'neg':'flat');
    const sign=delta>0.005?'+':'';
    deltaHtml=`<div class="patrimonio-delta ${cls}">${sign}${formatBRL(delta)} ${L('pat.desde')} ${MONTH_ABBR[anterior.mes-1]}</div>`;
  }

  const last12=list.slice(-12);

  card.innerHTML=`
    <div class="patrimonio-top">
      <div>
        <div class="patrimonio-value" data-countup="${valorAtual}" data-countkey="patrimonio">${formatBRL(valorAtual)}</div>
        ${deltaHtml}
        <div class="patrimonio-tag">${L(data.reservaNaConta===false?'pat.calculadoComReserva':'pat.calculado')}</div>
      </div>
    </div>
    ${renderPatrimonioChart(last12)}`;

  const patWrap=card.querySelector('.patrimonio-chart-wrap');
  if(patWrap) attachChartTooltip(patWrap);

}


