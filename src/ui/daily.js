/* ═══ ORÇAMENTO DIÁRIO, STATUS DO MÊS, CALENDÁRIO E EVOLUÇÃO DOS FIXOS ═══ */

/* quanto dá pra gastar por dia até o fim do mês, com a mesma lógica do monthMetrics */
function computeDailyBudget(){
  const t=today();
  const ano=t.getFullYear(), mes=t.getMonth()+1;
  const monthEnd=new Date(ano,mes,0);
  const diasRestantes=Math.max(1,Math.round((monthEnd-t)/86400000)+1);
  // renda restante do mês
  let renda=0;
  if(data.tipoRenda==='diaria'){
    const skip=new Set(data.diasNaoTrabalhados||[]);
    renda=daysBetweenInclusive(t,monthEnd,new Set(data.diasTrabalho),skip)*(data.rendaDiaria||0);
  }else if(data.tipoRenda==='mensal'){
    const rmDate=dataNoMes(ano,mes,data.rendaMensal.diaDoMes);
    renda=rmDate>t?(data.rendaMensal.valor||0):0;
  }
  renda+=rendasRecorrentesEntre(t,monthEnd);
  // despesas restantes do mês: faturas não pagas + gastos fixos que ainda vencem
  let despesas=0;
  (data.faturas||[]).filter(f=>f.ano===ano&&f.mes===mes).forEach(f=>{
    despesas+=(f.pago?0:f.valor)+(f.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
  });
  (data.gastosMensais||[]).forEach(g=>{
    if(!gastoFixoAtivoEm(g,ano,mes)) return;
    const d=dataNoMes(ano,mes,g.diaDoMes);
    if(d>t) despesas+=g.valor;
  });
  const pontoDoMes=buildTimeline().find(p=>p.k===chaveMes(ano,mes));
  const disponivel=pontoDoMes
    ? pontoDoMes.value
    : (data.saldoAtual||0)+(data.dinheiroVivo||0)+renda-despesas;
  // reserva mensal das metas com prazo: (falta ÷ meses restantes), somada
  let reservaMetas=0;
  (data.metas||[]).forEach(mt=>{
    const alvo=mt.valorAlvo||0, guard=mt.valorGuardado||0;
    if(alvo<=0||guard>=alvo||!mt.dataAlvo) return;
    if(mt.aporteMensal>0) return; // já sai da conta pelo aporte automático
    const meses=metaMonthsRemaining(mt.dataAlvo);
    if(meses===null||meses<=0) return;
    reservaMetas+=(alvo-guard)/meses;
  });
  const disponivelLivre=disponivel-reservaMetas;
  const isoHoje=isoDate(t);
  const gastoHoje=transacoesGasto().filter(x=>x.data===isoHoje).reduce((s,x)=>s+x.valor,0);
  // cota de hoje calculada sobre o dinheiro do início do dia (antes dos gastos de hoje)
  const porDiaHoje=(disponivelLivre+gastoHoje)/diasRestantes;
  const restanteHoje=porDiaHoje-gastoHoje;
  const porDia=disponivelLivre/diasRestantes;
  return {porDia,porDiaHoje,restanteHoje,diasRestantes,disponivel,disponivelLivre,reservaMetas,gastoHoje,renda};
}

function renderDailyBudget(){
  const el=document.getElementById('daily-card'); if(!el) return;
  if(data.gastoDiario===false){ el.innerHTML=''; return; }
  const b=computeDailyBudget();
  const t=today();
  const lastDay=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();
  const diaAtual=t.getDate();
  const rendaMedia=rendaMediaMensal();
  const pct=rendaMedia>0?(b.disponivel/rendaMedia)*100:null;
  let badge,icon,frase;
  if(b.disponivel<0){ badge=L('daily.noVermelho'); icon='🚨'; frase=L('daily.fraseVermelho'); }
  else if(pct===null){ badge=L('daily.semRenda'); icon='⚙️'; frase=L('daily.fraseSemRenda'); }
  else if(pct>=60){ badge=L('daily.maravilhoso'); icon='💎'; frase=L('daily.fraseMaravilhoso'); }
  else if(pct>=35){ badge=L('daily.muitoBom'); icon='✨'; frase=L('daily.fraseMuitoBom'); }
  else if(pct>=15){ badge=L('daily.moderado'); icon='🌤️'; frase=L('daily.fraseModerado'); }
  else{ badge=L('daily.apertado'); icon='⚠️'; frase=L('daily.fraseApertado'); }
  const pctTxt=pct!==null&&b.disponivel>=0?` (${Math.max(0,pct).toFixed(0)}% ${L('daily.daRenda')})`:'';
  const neg=b.restanteHoje<0;
  const estourou=neg&&b.porDiaHoje>=0;
  el.innerHTML=`
    <div class="daily-card">
      <div class="daily-main">
        <div class="daily-eyebrow">${L('daily.podeGastarHoje')}</div>
        <div class="daily-value${neg?' neg':''}" data-countup="${b.restanteHoje}" data-countkey="daily">${formatBRL(b.restanteHoje)}</div>
        <div class="daily-days">${estourou?`${L('daily.passou')} ${formatBRL(Math.abs(b.restanteHoje))} ${L('daily.daCotaHoje')} · `:''}${L('daily.cotaDe')} ${formatBRL(Math.max(0,b.porDiaHoje))}/${L('daily.dia')} · ${b.diasRestantes} ${b.diasRestantes===1?L('daily.diaRestante'):L('daily.diasRestantes')}${b.gastoHoje>0&&!estourou?` · ${L('daily.gastouHoje')} ${formatBRL(b.gastoHoje)}`:''}</div>
        ${b.reservaMetas>0?`<div class="daily-reserva">🎯 ${L('daily.guardando')} ${formatBRL(b.reservaMetas)}/${L('daily.mes')} ${L('daily.prasMetas')}</div>`:''}
        <div class="mp-track"><div class="mp-fill" style="width:${((diaAtual/lastDay)*100).toFixed(1)}%;"></div></div>
        <div class="daily-foot"><span>${L('daily.diaDe')} ${diaAtual} ${L('daily.de')} ${lastDay}</span><span>${L('daily.projecaoFim')}: ${formatBRL(b.disponivel)}${b.reservaMetas>0?` · ${L('daily.livre')} ${formatBRL(b.disponivelLivre)}`:''}</span></div>
      </div>
      <div class="status-banner">
        <div class="sb-icon">${icon}</div>
        <div>
          <div class="sb-badge">${badge}</div>
          <div class="sb-text">${L('daily.saldoProjetado')} <strong>${formatBRL(b.disponivel)}</strong>${pctTxt}. ${frase}</div>
        </div>
      </div>
    </div>`;
}

/* calendário: gasto real × planejado × saldo projetado, dia a dia */
function renderCalendarioMes(){
  const el=document.getElementById('calendario-card'); if(!el) return;
  const b=computeDailyBudget();
  const t=today();
  const ano=t.getFullYear(), mes=t.getMonth()+1, diaHoje=t.getDate();
  const lastDay=new Date(ano,mes,0).getDate();
  const prefixo=`${ano}-${String(mes).padStart(2,'0')}`;
  const gastoDia={};
  transacoesGasto().forEach(x=>{
    if(!x.data||String(x.data).slice(0,7)!==prefixo) return;
    const d=parseInt(String(x.data).slice(8,10),10);
    if(d>=1) gastoDia[d]=(gastoDia[d]||0)+x.valor;
  });
  let gastoRealizado=0;
  Object.keys(gastoDia).forEach(d=>{ if(parseInt(d,10)<=diaHoje) gastoRealizado+=gastoDia[d]; });
  // projeção "vista no dia 1": o disponível LIVRE (após reserva das metas) devolvido dos gastos do mês
  let proj=b.disponivelLivre+gastoRealizado;
  const rows=[];
  for(let d=1;d<=lastDay;d++){
    const diasRest=lastDay-d+1;
    const plan=proj/diasRest;
    const wd=WEEKDAY_ABBR[new Date(ano,mes-1,d).getDay()];
    if(d<=diaHoje){
      const g=gastoDia[d]||0;
      proj-=g;
      rows.push({d,wd,plan,g,saldo:proj,futuro:false});
    }else{
      proj-=plan;
      rows.push({d,wd,plan,g:null,saldo:proj,futuro:true});
    }
  }
  el.innerHTML=`
    <div class="cal-scroll">
    <div class="cal-head"><span>${L('cal.dia')}</span><span>${L('cal.gasto')}</span><span>${L('cal.planejado')}</span><span>${L('cal.saldo')}</span></div>
    ${rows.map(r=>{
      const hoje=r.d===diaHoje;
      let gastoHtml;
      if(r.futuro) gastoHtml='<span>—</span>';
      else if(r.g>0){
        const ok=r.g<=r.plan+0.005;
        gastoHtml=`<span class="cal-gasto ${ok?'ok':'over'}">${formatBRL(r.g)}${ok?' ✓':''}</span>`;
      }else gastoHtml=`<span class="cal-gasto">${formatBRL(0)}</span>`;
      return `
      <div class="cal-row${hoje?' today':''}${(!r.futuro&&!hoje)?' passado':''}">
        <span class="cal-dia">${String(r.d).padStart(2,'0')}<small>${r.wd}</small></span>
        ${gastoHtml}
        <span class="cal-plan">${formatBRL(Math.max(0,r.plan))}</span>
        <span class="cal-saldo${r.saldo<0?' neg':''}">${formatBRL(r.saldo)}</span>
      </div>`;
    }).join('')}
    </div>
    ${b.reservaMetas>0?`<div class="cal-nota">🎯 ${L('cal.reservandoMetas').replace('{valor}',formatBRL(b.reservaMetas))}</div>`:''}`;
  // centraliza o dia de hoje dentro do card (sem mexer no scroll da página)
  const scroll=el.querySelector('.cal-scroll');
  const todayRow=el.querySelector('.cal-row.today');
  if(scroll&&todayRow) scroll.scrollTop=Math.max(0,todayRow.offsetTop-scroll.clientHeight/2+todayRow.clientHeight/2);
  if(scroll){
    const marcar=()=>scroll.classList.toggle('rolado',scroll.scrollTop>2);
    scroll.addEventListener('scroll',marcar,{passive:true});
    marcar();
  }
}

/* evolução mensal dos gastos fixos — clean, com período de 3M / 6M / 1A */
let gfePeriodo=6;
function renderGfEvolucao(){
  const el=document.getElementById('gf-evolucao-card'); if(!el) return;
  if((data.gastosMensais||[]).length===0){ el.innerHTML=''; el.style.display='none'; return; }
  const hoje=new Date();
  const n=gfePeriodo;
  const meses=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(hoje.getFullYear(),hoje.getMonth()-i,1);
    const ano=d.getFullYear(),mes=d.getMonth()+1;
    const total=(data.gastosMensais||[]).reduce((s,g)=>s+(gastoFixoAtivoEm(g,ano,mes)?g.valor:0),0);
    meses.push({ano,mes,total});
  }
  if(meses.every(m=>m.total<=0)){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='';
  const atualTotal=meses[meses.length-1].total;
  const prevTotal=meses.length>1?meses[meses.length-2].total:atualTotal;
  const delta=atualTotal-prevTotal;
  let deltaHtml;
  if(Math.abs(delta)<0.005) deltaHtml=`<div class="gfe-delta flat">— estável vs mês anterior</div>`;
  else if(delta>0) deltaHtml=`<div class="gfe-delta up">▲ +${formatBRL(delta)} vs mês anterior</div>`;
  else deltaHtml=`<div class="gfe-delta down">▼ −${formatBRL(Math.abs(delta))} vs mês anterior</div>`;
  const max=Math.max(1,...meses.map(m=>m.total));
  const W=700,H=168,padL=10,padR=10,padT=24,padB=26;
  const step=(W-padL-padR)/n;
  const bw=Math.min(44,step*0.4);
  const innerH=H-padT-padB;
  const base=H-padB;
  const barras=meses.map((m,i)=>{
    const h=(m.total/max)*innerH;
    const x=padL+step*i+(step-bw)/2;
    const y=base-h;
    const atual=i===n-1;
    const tt=`<title>${MONTH_ABBR[m.mes-1]}/${m.ano} — ${formatBRL(m.total)}</title>`;
    const bar=m.total>0
      ?`<rect class="gf-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(3,h).toFixed(1)}" rx="${Math.min(7,bw/2).toFixed(1)}" fill="${atual?'var(--pos)':'var(--mist-lilac)'}" style="animation-delay:${(i*0.04).toFixed(2)}s">${tt}</rect>`
      :`<rect x="${x.toFixed(1)}" y="${(base-3).toFixed(1)}" width="${bw.toFixed(1)}" height="3" rx="1.5" fill="var(--mist-lilac)">${tt}</rect>`;
    const val=(atual&&m.total>0)?`<text x="${(x+bw/2).toFixed(1)}" y="${Math.max(12,y-8).toFixed(1)}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="700" font-size="11" fill="var(--pos)">${formatBRL(m.total)}</text>`:'';
    const lbl=`<text x="${(padL+step*i+step/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="${n>=12?'9':'10'}" fill="${atual?'var(--pos)':'var(--muted2)'}" font-weight="${atual?'700':'400'}">${MONTH_ABBR[m.mes-1]}</text>`;
    return bar+val+lbl;
  }).join('');
  el.innerHTML=`
    <div class="gfe-top">
      <div>
        <div class="gfe-title">Evolução mensal</div>
        <div class="gfe-value">${formatBRL(atualTotal)}</div>
        ${deltaHtml}
      </div>
      <div class="gfe-seg" role="tablist">
        <button type="button" class="${gfePeriodo===3?'active':''}" data-n="3">3M</button>
        <button type="button" class="${gfePeriodo===6?'active':''}" data-n="6">6M</button>
        <button type="button" class="${gfePeriodo===12?'active':''}" data-n="12">1A</button>
      </div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;margin-top:4px;">
      <line x1="${padL}" y1="${base}" x2="${W-padR}" y2="${base}" stroke="var(--line)" stroke-width="1"/>
      ${barras}
    </svg>`;
  el.querySelectorAll('.gfe-seg button').forEach(btn=>btn.addEventListener('click',()=>{
    gfePeriodo=parseInt(btn.getAttribute('data-n'),10)||6;
    vibrate(6);
    renderGfEvolucao();
  }));
}

