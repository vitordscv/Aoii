function renderSaudeFinanceira(){
  const el=document.getElementById('saude-financeira-card'); if(!el) return;
  const {score,motivos}=computeSaudeFinanceira();
  /* sem nada cadastrado não há nota: diz o que falta, em vez de inventar um
     número que só mede a ausência de problema — ver computeSaudeFinanceira() */
  if(score===null){
    el.innerHTML=`
    <div class="saude-card saude-sem-dado">
      <div class="saude-top"><span class="saude-label">${esc(L('saude.titulo'))}</span></div>
      <div class="saude-motivos">${esc(L('saude.semDado'))}</div>
    </div>`;
    return;
  }
  const label=score>=75?L('saude.boa'):score>=40?L('saude.regular'):L('saude.atencao');
  const cls=score>=75?'boa':score>=40?'regular':'atencao';
  el.innerHTML=`
  <div class="saude-card ${cls}">
    <div class="saude-top">
      <span class="saude-label">${L('saude.titulo')}: ${esc(label)} <button type="button" class="info-tip-btn" data-tip="${esc(L('saude.tip'))}">?</button></span>
      <span class="saude-score">${score}/100</span>
    </div>
    <div class="saude-bar-track"><div class="saude-bar-fill" style="width:${score}%;"></div></div>
    <div class="saude-motivos">${motivos.map(m=>esc(m)).join(' · ')}</div>
  </div>`;
}

function renderWeekSummary(){
  const el=document.getElementById('week-summary-card'); if(!el) return;
  const w=computeWeekSummary();
  if(w.gastoSemana<=0&&w.livreAteFimDoMes===null){ el.innerHTML=''; return; }
  el.innerHTML=`
  <div class="week-summary-box">
    <div class="week-summary-item">
      <span class="lbl" data-i18n="week.ultimos7dias">Últimos 7 dias</span>
      <span class="val">${formatBRL(w.gastoSemana)}</span>
    </div>
    ${w.livreAteFimDoMes!==null?`
    <div class="week-summary-item">
      <span class="lbl" data-i18n="week.livreAteFim">Livre até o fim do mês</span>
      <span class="val ${w.livreAteFimDoMes<=0?'neg':''}">${formatBRL(w.livreAteFimDoMes)} <small>· ${w.diasRestantes} ${w.diasRestantes===1?L('common.day'):L('common.days')}</small></span>
    </div>`:''}
  </div>`;
}

function renderMonthComparison(){
  const el=document.getElementById('mes-comparacao'); if(!el) return;
  const t=today();
  const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  let prevMes=mesA-1, prevAno=anoA; if(prevMes<1){ prevMes=12; prevAno--; }
  const atual=computeMonthSpend(anoA,mesA);
  const passado=computeMonthSpend(prevAno,prevMes);
  if(passado<=0){ el.innerHTML=''; return; }
  const pct=Math.round(((atual-passado)/passado)*100);
  if(pct===0){ el.innerHTML=`<span class="mes-comp-neutro">${L('comp.igual')}</span>`; return; }
  const up=pct>0;
  el.innerHTML=`<span class="${up?'mes-comp-up':'mes-comp-down'}">${up?'📈':'📉'} ${L(up?'comp.aMais':'comp.aMenos').replace('{pct}',Math.abs(pct)+'%')}</span>`;
}
