function renderSettings(){
  document.querySelectorAll('#cfg-tipo-renda .segmented-btn').forEach(btn=>{
    const ativo=btn.getAttribute('data-tipo')===data.tipoRenda;
    btn.classList.toggle('active',ativo); btn.setAttribute('aria-pressed',ativo?'true':'false');
  });
  document.getElementById('renda-diaria-fields').style.display=data.tipoRenda==='diaria'?'':'none';
  document.getElementById('renda-mensal-fields').style.display=data.tipoRenda==='mensal'?'':'none';
  document.getElementById('cfg-renda-diaria').value=data.rendaDiaria;
  document.getElementById('cfg-renda-mensal-valor').value=data.rendaMensal.valor;
  document.getElementById('cfg-renda-mensal-dia').value=data.rendaMensal.diaDoMes;
  renderCartoesList();
  renderCategoriasList();
  renderViagensList();
  document.getElementById('cfg-moeda').value=data.moeda||'BRL';
  const idiomaEl=document.getElementById('cfg-idioma');
  if(idiomaEl) idiomaEl.value=data.idioma||'pt';
  const fiEl=document.getElementById('cfg-fundo-ilustrado');
  if(fiEl) fiEl.checked=data.fundoIlustrado!==false;
  const tanEl=document.getElementById('cfg-tema-auto-noite');
  if(tanEl) tanEl.checked=!!data.temaAutoNoite;
  const gdEl=document.getElementById('cfg-gasto-diario');
  if(gdEl) gdEl.checked=data.gastoDiario!==false;
  const iaCheck=document.getElementById('ia-ativa-check');
  const iaFields=document.getElementById('ia-fields');
  const iaChaveInput=document.getElementById('ia-chave-input');
  if(iaCheck){
    iaCheck.checked=data.iaAtiva===true;
    if(iaFields) iaFields.style.display=data.iaAtiva===true?'block':'none';
  }
  if(iaChaveInput && document.activeElement!==iaChaveInput) iaChaveInput.value=getIaChave();
  document.getElementById('cfg-dias-trabalho').innerHTML=WEEKDAY_ABBR.map((nm,idx)=>`
    <label class="weekday-chip">
      <input type="checkbox" data-weekday="${idx}" ${(data.diasTrabalho||[]).includes(idx)?'checked':''}>
      ${nm}
    </label>`).join('');
  document.querySelectorAll('#cfg-dias-trabalho input').forEach(el=>el.addEventListener('change',async()=>{
    const dias=[...document.querySelectorAll('#cfg-dias-trabalho input')]
      .filter(c=>c.checked).map(c=>parseInt(c.getAttribute('data-weekday'),10));
    if(!definirDiasTrabalho(dias)) return;
    await persist(); render();
  }));
  renderSkipDays();
}

function renderSkipDays(){
  const list=data.diasNaoTrabalhados||[];
  const el=document.getElementById('skip-days-list'); if(!el) return;
  if(list.length===0){
    el.innerHTML=`<span class="skip-empty">${L('skip.nenhumDiaMarcado')}</span>`; return;
  }
  el.innerHTML=[...list].sort().map(ds=>{
    const d=new Date(ds+'T12:00:00');
    const label=d.toLocaleDateString(localeAtual(),{weekday:'short',day:'2-digit',month:'short',year:'2-digit'});
    return `<span class="skip-tag">${esc(label)}<button data-action="del-skip" data-date="${ds}" title="${esc(L('btn.remover'))}">✕</button></span>`;
  }).join('');
  el.querySelectorAll('[data-action="del-skip"]').forEach(btn=>btn.addEventListener('click',async e=>{
    const date=e.target.getAttribute('data-date');
    if(!removerDiaNaoTrabalhado(date)) return;
    await persist(); render();
  }));
}
