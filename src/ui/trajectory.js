/* ── chart: trajetória do saldo ── */
/* ── trajetória de saldo (compartilhada pelo gráfico e pelas sugestões de compra) ── */
function getTrajectoryPoints(opts){
  const inicial=data.saldoAtual+(data.dinheiroVivo||0);
  const points=[{label:L('cal.hoje'),monthLabel:L('cal.agora'),value:inicial}];
  buildTimeline(opts).forEach(p=>{
    if(p.isPast) return; // meses já encerrados só entram no acumulado, não no desenho
    points.push({label:p.label,monthLabel:p.monthLabel,value:p.value});
  });
  return points;
}

/* sugere o primeiro mês em que o saldo acumulado cobre o valor da compra, mantendo uma folga */
function suggestPurchaseTiming(item){
  const valor=(item&&typeof item==='object')?(item.valor||0):(item||0);
  /* a projeção já desconta as OUTRAS compras planejadas e soma as entradas
     extras; a compra que está sendo avaliada fica de fora pra não se anular */
  const points=getTrajectoryPoints({exceto:item&&item.id});
  if(points.length===0) return null;
  const BUFFER=150;      // folga de segurança pra não zerar o saldo
  const HORIZONTE=12;    // a compra precisa caber no mês E nos 12 meses seguintes
  /* comprar num mês em que o saldo encosta no valor só pra afundar no mês
     seguinte não é "dá pra comprar" — por isso olhamos o menor saldo à frente */
  const cabe=i=>{
    let min=Infinity;
    for(let j=i;j<points.length&&j<=i+HORIZONTE;j++) min=Math.min(min,points[j].value);
    return min>=valor+BUFFER;
  };
  if(cabe(0)) return {when:L('compra.agora'),ok:true};
  for(let i=1;i<points.length;i++){
    if(cabe(i)) return {when:L('compra.aPartirDe').replace('{mes}',points[i].monthLabel),ok:true};
  }
  const ultimo=points[points.length-1].monthLabel||'';
  return {when:L('compra.semPrevisao').replace('{mes}',ultimo),ok:false};
}

function renderChart(){
  const card=document.getElementById('chart-card'); if(!card) return;
  const points=getTrajectoryPoints();

  if(points.length<2||((data.faturas||[]).length===0&&(data.entradasExtras||[]).length===0&&(data.comprasPlanejadas||[]).length===0)){
    card.innerHTML=`<div class="help-text">${L('chart.semMeses')}</div>`;
    return;
  }

  const W=1000,H=240,padL=54,padR=18,padT=22,padB=34;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const vals=points.map(p=>p.value);
  let vMin=Math.min(0,...vals), vMax=Math.max(0,...vals);
  if(vMin===vMax){ vMin-=10; vMax+=10; }
  const pad=(vMax-vMin)*0.12; vMin-=pad; vMax+=pad;

  const x=i=>padL+(innerW*(points.length===1?0:i/(points.length-1)));
  const y=v=>padT+innerH-((v-vMin)/(vMax-vMin))*innerH;
  const zeroY=y(0);

  const maxIdx=vals.indexOf(Math.max(...vals));
  const minIdx=vals.indexOf(Math.min(...vals));

  const linePath=points.map((p,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const areaPath=`${linePath} L${x(points.length-1).toFixed(1)},${(padT+innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT+innerH).toFixed(1)} Z`;

  const gridLines=[0,0.25,0.5,0.75,1].map(f=>{
    const yy=padT+innerH*f;
    const val=vMax-(vMax-vMin)*f;
    return `<line x1="${padL}" y1="${yy}" x2="${W-padR}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>
            <text x="${padL-8}" y="${yy+3}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="var(--muted2)">${formatBRL(val).replace((CURRENCY_INFO[data.moeda]||CURRENCY_INFO.BRL).symbol+' ','')}</text>`;
  }).join('');

  const xLabels=points.map((p,i)=>`
    <text x="${x(i)}" y="${H-12}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="9.5" fill="var(--muted2)">${esc(p.label)}</text>`).join('');

  const dots=points.map((p,i)=>{
    let color='var(--disney-blue-deep)', r=4;
    if(i===maxIdx&&maxIdx!==0){ color='var(--pos)'; r=5.5; }
    if(i===minIdx&&minIdx!==0){ color='var(--neg)'; r=5.5; }
    if(p.value<0) color='var(--neg)';
    const showLabel=(i===maxIdx&&maxIdx!==0)||(i===minIdx&&minIdx!==0)||i===0||i===points.length-1;
    return `<circle cx="${x(i)}" cy="${y(p.value)}" r="${r}" fill="${color}" stroke="var(--white)" stroke-width="1.5" data-tt="${esc(p.monthLabel)}" data-tt-val="${esc(formatBRL(p.value))}"/>
      ${showLabel?`<text x="${x(i)}" y="${y(p.value)-10}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="600" font-size="10.5" fill="${color}">${formatBRL(p.value)}</text>`:''}`;
  }).join('');

  card.innerHTML=`
    <div class="chart-scroll">
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--disney-blue-deep)" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="var(--disney-blue-deep)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <line x1="${padL}" y1="${zeroY}" x2="${W-padR}" y2="${zeroY}" stroke="var(--neg)" stroke-width="1" stroke-dasharray="3,3" opacity="0.55"/>
      <path d="${areaPath}" fill="url(#chartFade)"/>
      <path d="${linePath}" fill="none" stroke="var(--disney-blue-deep)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>
    </div>
    <div class="chart-legend">
      <span><i style="background:var(--pos)"></i> ${L('cal.legendaMelhor')}</span>
      <span><i style="background:var(--neg)"></i> ${L('cal.legendaApertado')}</span>
      <span><i style="background:var(--disney-blue-deep)"></i> ${L('cal.trajetoriaPrevista')}</span>
    </div>`;
  attachChartTooltip(card);
}

