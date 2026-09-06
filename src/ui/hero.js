/* ── hero ── */
function renderHero(){
  const t=computeTotals();
  const neg=t.projetado<0;
  const targetVal=data.dataAlvo||defaultTargetValue();
  document.getElementById('hero-content').innerHTML=`
    <div class="hero-eyebrow-row">
      <span class="hero-eyebrow">${L('hero.saldoEstimado')}</span>
      <input type="date" class="hero-date-input" id="hero-date-input" value="${esc(targetVal)}">
    </div>
    <div class="hero-number${neg?' negativo':''}" data-countup="${t.projetado}" data-countkey="hero-projetado">${formatBRL(t.projetado)}</div>
    <div class="hero-sub">${data.tipoRenda==='diaria'?L('hero.subDiaria'):L('hero.subMensal')} ${L('hero.subComum')}</div>
    <div class="saldo-row">
      <div class="saldo-field">
        <label>${L('hero.saldoAtual')}</label>
        <input type="text" inputmode="decimal" step="0.01" id="saldo-atual-input" value="${data.saldoAtual}">
      </div>
      <div class="saldo-field">
        <label>${L('hero.dinheiroVivo')}</label>
        <input type="text" inputmode="decimal" step="0.01" id="dinheiro-vivo-input" value="${data.dinheiroVivo||0}">
      </div>
      <div class="saldo-field saldo-total-field">
        <label>${L('hero.totalDisponivel')}</label>
        <div class="saldo-total-value" data-countup="${data.saldoAtual+(data.dinheiroVivo||0)}" data-countkey="hero-total">${formatBRL(data.saldoAtual+(data.dinheiroVivo||0))}</div>
      </div>
    </div>
    <div class="saldo-updated">${L('hero.saldoAtualizado')} ${fmtDate(data.saldoAtualizadoEm)}${data.dinheiroVivo?` · ${L('hero.dinheiroAtualizado')} ${fmtDate(data.dinheiroVivoAtualizadoEm)}`:''}</div>
  `;
  document.getElementById('saldo-atual-input').addEventListener('change',async e=>{
    const v=parseNum(e.target.value);
    data.saldoAtual=isNaN(v)?0:v;
    data.saldoAtualizadoEm=new Date().toISOString();
    await persist(); render();
  });
  document.getElementById('dinheiro-vivo-input').addEventListener('change',async e=>{
    const v=parseNum(e.target.value);
    data.dinheiroVivo=isNaN(v)?0:v;
    data.dinheiroVivoAtualizadoEm=new Date().toISOString();
    await persist(); render();
  });
  document.getElementById('hero-date-input').addEventListener('change',async e=>{
    data.dataAlvo=e.target.value||defaultTargetValue();
    await persist(); render();
  });
}

/* ── chips ── */
function renderChips(){
  const t=computeTotals();
  const aPagar=t.gastosMensaisTotal+t.faturasPendentes+t.comprasPendentes+t.aportesPrevistos;
  const shortDate=t.target.toLocaleDateString(localeAtual(),{month:'short',year:'numeric'}).replace('.','');
  const skipped=(data.diasNaoTrabalhados||[]).length;
  const chips=[];
  if(data.tipoRenda==='diaria'){
    chips.push({label:`${L('chips.diasTrabalho')} ${shortDate}${skipped?' (−'+skipped+')':''}`, value:String(t.workDays), num:t.workDays, fmt:'int', key:'dias'});
    chips.push({label:`${L('chips.rendaTrabalho')} ${shortDate}`, value:formatBRL(t.rendaTrabalho), num:t.rendaTrabalho, key:'renda'});
  }else{
    chips.push({label:`${L('chips.rendaPrevista')} ${shortDate}`, value:formatBRL(t.rendaTrabalho), num:t.rendaTrabalho, key:'renda'});
  }
  chips.push({label:L('chips.aReceber'), value:formatBRL(t.entradasPendentes), num:t.entradasPendentes, key:'receber'});
  chips.push({label:L('chips.aPagar'), value:formatBRL(aPagar), num:aPagar, key:'pagar'});
  document.getElementById('stat-chips').innerHTML=chips.map(c=>`
    <div class="chip">
      <div class="chip-label">${esc(c.label)}</div>
      <div class="chip-value" data-countup="${c.num}" data-countkey="chip-${c.key}" data-countfmt="${c.fmt||'moeda'}">${c.value}</div>
    </div>`).join('');

  const tt=document.getElementById('timeline-title');
  if(tt) tt.textContent=L('main.linhaDoTempo')+' — '+
    t.target.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});
}

