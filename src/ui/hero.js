/* ── hero ── */
/* O texto que explicava a conta continua existindo — mudou de lugar: era um
   parágrafo fixo, virou o conteúdo da dica. */
function subDoHero(){
  return (data.tipoRenda==='diaria'?L('hero.subDiaria'):L('hero.subMensal'))+' '+L('hero.subComum');
}

/* O carimbo de "atualizado em" só informa quando está velho. Atualizado hoje,
   ele ocupava duas linhas pra dizer "hoje". Três dias é o ponto em que o
   número na tela pode já não ser o da conta. */
function saldoEstaVelho(){
  const d=data.saldoAtualizadoEm?new Date(data.saldoAtualizadoEm):null;
  if(!d||isNaN(d.getTime())) return true;
  return (Date.now()-d.getTime()) > 3*24*60*60*1000;
}

/* Dinheiro num campo editável: formatado enquanto se olha, cru enquanto se
   digita. Formatar durante a digitação briga com quem está escrevendo. */
function valorDeCampo(n){
  const v=Number(n)||0;
  return v.toLocaleString(localeAtual(),{minimumFractionDigits:2,maximumFractionDigits:2});
}
function ligarCampoDeDinheiro(el){
  if(!el) return;
  el.addEventListener('focus',()=>{ const n=parseNum(el.value); el.value=isNaN(n)?'':String(n); el.select(); });
  el.addEventListener('blur',()=>{ const n=parseNum(el.value); el.value=valorDeCampo(isNaN(n)?0:n); });
}

function renderHero(){
  const t=computeTotals();
  const neg=t.projetado<0;
  const targetVal=data.dataAlvo||defaultTargetValue();
  document.getElementById('hero-content').innerHTML=`
    <div class="hero-eyebrow-row">
      <span class="hero-eyebrow">${L('hero.saldoEstimado')}</span>
      <input type="date" class="hero-date-input" id="hero-date-input" value="${esc(targetVal)}" aria-label="${esc(L('hero.saldoEstimado'))}">
    </div>
    <div class="hero-number${neg?' negativo':''}" data-countup="${t.projetado}" data-countkey="hero-projetado">${formatBRL(t.projetado)}<button type="button" class="info-tip-btn hero-tip-btn" data-tip="${esc(subDoHero())}" aria-label="${esc(L('hero.comoCalcula'))}">i</button></div>

    <div class="saldo-row">
      <div class="saldo-field">
        <label for="saldo-atual-input">${L('hero.saldoAtual')}</label>
        <input type="text" inputmode="decimal" step="0.01" id="saldo-atual-input" value="${valorDeCampo(data.saldoAtual)}">
      </div>
      <div class="saldo-field">
        <label for="dinheiro-vivo-input">${L('hero.dinheiroVivo')}</label>
        <input type="text" inputmode="decimal" step="0.01" id="dinheiro-vivo-input" value="${valorDeCampo(data.dinheiroVivo)}">
      </div>
      <div class="saldo-field saldo-total-field">
        <label>${L('hero.totalDisponivel')}</label>
        <div class="saldo-total-value" data-countup="${data.saldoAtual+(data.dinheiroVivo||0)}" data-countkey="hero-total">${formatBRL(data.saldoAtual+(data.dinheiroVivo||0))}</div>
      </div>
    </div>
    ${saldoEstaVelho()?`<div class="saldo-updated">${L('hero.saldoAtualizado')} ${fmtDate(data.saldoAtualizadoEm)}${data.dinheiroVivo?` · ${L('hero.dinheiroAtualizado')} ${fmtDate(data.dinheiroVivoAtualizadoEm)}`:''}</div>`:''}
  `;
  /* formatado ao olhar, cru ao digitar — ver ligarCampoDeDinheiro() */
  ligarCampoDeDinheiro(document.getElementById('saldo-atual-input'));
  ligarCampoDeDinheiro(document.getElementById('dinheiro-vivo-input'));
  document.getElementById('saldo-atual-input').addEventListener('change',async e=>{
    const v=parseNum(e.target.value);
    if(atualizarSaldoConta(v)!==null){ await persist(); render(); }
  });
  document.getElementById('dinheiro-vivo-input').addEventListener('change',async e=>{
    const v=parseNum(e.target.value);
    if(atualizarDinheiroVivo(v)!==null){ await persist(); render(); }
  });
  document.getElementById('hero-date-input').addEventListener('change',async e=>{
    if(atualizarDataAlvo(e.target.value||defaultTargetValue())){ await persist(); render(); }
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
    chips.push({label:L('chips.diasTrabalhoCurto'), dica:`${L('chips.diasTrabalho')} ${shortDate}${skipped?' (−'+skipped+')':''}`, value:String(t.workDays), num:t.workDays, fmt:'int', key:'dias'});
    chips.push({label:L('chips.rendaTrabalhoCurto'), dica:`${L('chips.rendaTrabalho')} ${shortDate}`, value:formatBRL(t.rendaTrabalho), num:t.rendaTrabalho, key:'renda'});
  }else{
    chips.push({label:L('chips.rendaPrevistaCurto'), dica:`${L('chips.rendaPrevista')} ${shortDate}`, value:formatBRL(t.rendaTrabalho), num:t.rendaTrabalho, key:'renda'});
  }
  chips.push({label:L('chips.aReceberCurto'), dica:L('chips.aReceber'), value:formatBRL(t.entradasPendentes), num:t.entradasPendentes, key:'receber'});
  chips.push({label:L('chips.aPagarCurto'), dica:L('chips.aPagar'), value:formatBRL(aPagar), num:aPagar, key:'pagar'});
  document.getElementById('stat-chips').innerHTML=chips.map(c=>`
    <div class="chip">
      <div class="chip-label">${esc(c.label)}${c.dica?` <button type="button" class="info-tip-btn chip-tip-btn" data-tip="${esc(c.dica)}" aria-label="${esc(c.dica)}">?</button>`:''}</div>
      <div class="chip-value" data-countup="${c.num}" data-countkey="chip-${c.key}" data-countfmt="${c.fmt||'moeda'}">${c.value}</div>
    </div>`).join('');

  const tt=document.getElementById('timeline-title');
  if(tt) tt.textContent=L('main.linhaDoTempo')+' — '+
    t.target.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});
}
