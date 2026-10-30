/* Seleção em rascunho: navegar e tocar em datas nunca grava uma falta. */
const skipCalendar={mes:null,modo:'periodo',inicio:null,fim:null,dias:new Set(),confirmados:0};
function skipDiasSelecionados(){
  if(skipCalendar.modo==='dias') return [...skipCalendar.dias].sort();
  return skipCalendar.inicio?diasDePeriodo(skipCalendar.inicio,skipCalendar.fim||skipCalendar.inicio):[];
}
function limparSelecaoSkip(){
  skipCalendar.inicio=null;skipCalendar.fim=null;skipCalendar.dias.clear();
}
function renderSkipCalendar(foco=null){
  const el=document.getElementById('skip-calendar');if(!el) return;
  if(!skipCalendar.mes) skipCalendar.mes=new Date(today().getFullYear(),today().getMonth(),1,12);
  const mes=skipCalendar.mes,ano=mes.getFullYear(),m=mes.getMonth();
  const salvos=new Set(data.diasNaoTrabalhados||[]),selecionados=new Set(skipDiasSelecionados());
  const titulo=mes.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});
  const primeiro=(new Date(ano,m,1,12).getDay()+6)%7;
  const quantidade=new Date(ano,m+1,0,12).getDate();
  let diasHtml='';
  for(let i=0;i<primeiro;i++) diasHtml+='<span aria-hidden="true"></span>';
  for(let n=1;n<=quantidade;n++){
    const d=new Date(ano,m,n,12),iso=isoDate(d),selecionado=selecionados.has(iso),salvo=salvos.has(iso);
    const label=d.toLocaleDateString(localeAtual(),{dateStyle:'full'})+(salvo?' · '+L('skip.salvo'):'');
    diasHtml+=`<button type="button" class="skip-cal-day${selecionado?' is-selected':''}${salvo?' is-saved':''}" data-skip-date="${iso}" aria-pressed="${selecionado}" aria-label="${esc(label)}"${iso===isoDate(today())?' aria-current="date"':''}>${n}${salvo?'<span class="skip-cal-dot" aria-hidden="true"></span>':''}</button>`;
  }
  const semanaHtml=Array.from({length:7},(_,i)=>{
    const d=new Date(2026,5,1+i,12);
    return `<span title="${esc(d.toLocaleDateString(localeAtual(),{weekday:'long'}))}">${esc(d.toLocaleDateString(localeAtual(),{weekday:'short'}).replace(/\.$/,''))}</span>`;
  }).join('');
  let resumo=skipCalendar.confirmados?L('skip.confirmado').replace('{n}',skipCalendar.confirmados):L('skip.escolher');
  if(selecionados.size){
    const total=[...selecionados].filter(d=>!salvos.has(d)).length;
    resumo=L('skip.selecao').replace('{n}',selecionados.size).replace('{novos}',total);
    if(skipCalendar.modo==='periodo'&&skipCalendar.inicio&&!skipCalendar.fim) resumo+=' '+L('skip.escolherFim');
  }
  el.innerHTML=`<div class="skip-cal-modes" role="group" aria-label="${esc(L('skip.modo'))}">
    <button type="button" data-skip-mode="periodo" aria-pressed="${skipCalendar.modo==='periodo'}">${L('skip.periodo')}</button>
    <button type="button" data-skip-mode="dias" aria-pressed="${skipCalendar.modo==='dias'}">${L('skip.dias')}</button></div>
    <p class="skip-cal-help">${L(skipCalendar.modo==='periodo'?'skip.helpPeriodo':'skip.helpDias')}</p>
    <div class="skip-cal-nav"><button type="button" data-skip-month="-1" aria-label="${esc(L('skip.anterior'))}">‹</button><strong>${esc(titulo)}</strong><button type="button" data-skip-month="1" aria-label="${esc(L('skip.proximo'))}">›</button></div>
    <div class="skip-cal-week" aria-hidden="true">${semanaHtml}</div><div class="skip-cal-grid">${diasHtml}</div>
    <p class="skip-cal-summary" role="status" aria-live="polite">${esc(resumo)}</p>
    <div class="skip-cal-actions"><button type="button" data-skip-clear ${selecionados.size?'':'disabled'}>${L('skip.limpar')}</button><button type="button" class="skip-add-btn" id="skip-day-add" ${selecionados.size?'':'disabled'}>${L('skip.confirmar')}</button></div>`;
  if(foco) el.querySelector(foco)?.focus({preventScroll:true});
}
function setupSkipCalendar(){
  const el=document.getElementById('skip-calendar');if(!el) return;
  el.addEventListener('click',async e=>{
    const btn=e.target.closest('button');if(!btn||btn.disabled) return;
    if(btn.dataset.skipMonth){
      const mes=skipCalendar.mes;
      if((mes.getFullYear()<=1900&&btn.dataset.skipMonth==='-1')||(mes.getFullYear()>=9998&&btn.dataset.skipMonth==='1')) return;
      skipCalendar.mes=new Date(mes.getFullYear(),mes.getMonth()+Number(btn.dataset.skipMonth),1,12);
      renderSkipCalendar(`[data-skip-month="${btn.dataset.skipMonth}"]`);return;
    }
    if(btn.dataset.skipMode){
      if(skipCalendar.modo!==btn.dataset.skipMode){limparSelecaoSkip();skipCalendar.modo=btn.dataset.skipMode;}
      renderSkipCalendar(`[data-skip-mode="${btn.dataset.skipMode}"]`);return;
    }
    const dia=btn.dataset.skipDate;
    if(dia){
      skipCalendar.confirmados=0;
      if(skipCalendar.modo==='dias'){
        if(skipCalendar.dias.has(dia)) skipCalendar.dias.delete(dia);else skipCalendar.dias.add(dia);
      }else if(!skipCalendar.inicio||skipCalendar.fim){skipCalendar.inicio=dia;skipCalendar.fim=null;}
      else{
        const inicio=dia<skipCalendar.inicio?dia:skipCalendar.inicio,fim=dia<skipCalendar.inicio?skipCalendar.inicio:dia;
        if(!diasDePeriodo(inicio,fim).length){el.querySelector('.skip-cal-summary').textContent=L('skip.limite');return;}
        skipCalendar.inicio=inicio;skipCalendar.fim=fim;
      }
      renderSkipCalendar(`[data-skip-date="${dia}"]`);return;
    }
    if(btn.hasAttribute('data-skip-clear')){limparSelecaoSkip();renderSkipCalendar('[data-skip-mode="periodo"]');return;}
    if(btn.id==='skip-day-add'){
      btn.disabled=true;
      const dias=skipDiasSelecionados();
      skipCalendar.confirmados=0;
      for(const d of dias) if(adicionarDiaNaoTrabalhado(d)) skipCalendar.confirmados++;
      limparSelecaoSkip();await persist();render();
      el.querySelector('[data-skip-mode="periodo"]')?.focus({preventScroll:true});
    }
  });
}
