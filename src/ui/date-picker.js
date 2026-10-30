/* Um seletor compartilhado para datas estáticas e campos recriados por render().
   O input original mantém o valor ISO e os eventos de negócio existentes. */
let calendarioRestaurar=null,calendarioAoFechar=null;
function fecharCalendario(){
  const dialog=document.getElementById('calendar-dialog');if(dialog.hidden) return;
  dialog.hidden=true;document.getElementById('calendar-backdrop').hidden=true;
  if(calendarioAoFechar) calendarioAoFechar();calendarioAoFechar=null;
  if(calendarioRestaurar) calendarioRestaurar();calendarioRestaurar=null;
}
function abrirCalendario(titulo,conteudo,aoFechar=null){
  fecharCalendario();
  const dialog=document.getElementById('calendar-dialog'),bd=document.getElementById('calendar-backdrop');
  const corpo=document.getElementById('calendar-dialog-body');corpo.replaceChildren(conteudo);
  conteudo.hidden=false;document.getElementById('calendar-dialog-title').textContent=titulo;
  calendarioAoFechar=aoFechar;dialog.hidden=false;bd.hidden=false;
  calendarioRestaurar=ativarDialogo(dialog,bd,document.getElementById('calendar-close'),fecharCalendario);
  animarInterface(dialog,'modal');animarInterface(bd,'fundo');
}
function setupDatePickers(){
  const proxies=new Map();
  const dialog=document.getElementById('calendar-dialog');
  function ajustarViewport(){
    const vv=window.visualViewport;
    dialog.style.setProperty('--calendar-visible-height',(vv?vv.height:innerHeight)+'px');
    dialog.style.setProperty('--calendar-visible-top',(vv?vv.offsetTop:0)+'px');
  }
  window.visualViewport?.addEventListener('resize',ajustarViewport);
  window.visualViewport?.addEventListener('scroll',ajustarViewport);
  window.addEventListener('resize',ajustarViewport);ajustarViewport();
  function rotulo(input){
    const label=input.id?document.querySelector(`label[for="${input.id}"]`):null;
    return input.getAttribute('aria-label')||input.title||label?.textContent.trim()||L('date.escolher');
  }
  function texto(input){
    return diaCalendarioValido(input.value)?new Date(input.value+'T12:00:00').toLocaleDateString(localeAtual(),{day:'2-digit',month:'short',year:'numeric'}):L('date.escolher');
  }
  function sincronizar(){
    for(const [input,btn] of proxies){if(!input.isConnected){btn.remove();proxies.delete(input);}}
    document.querySelectorAll('input[type="date"]').forEach(input=>{
      let btn=proxies.get(input);
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.className=input.className+' date-trigger';
        btn.setAttribute('aria-haspopup','dialog');btn.setAttribute('aria-controls','calendar-dialog');
        input.after(btn);input.hidden=true;input.tabIndex=-1;proxies.set(input,btn);
        btn.addEventListener('click',()=>abrirData(input,btn));
      }
      const label=rotulo(input),valor=texto(input);
      if(btn.textContent!==valor) btn.textContent=valor;
      if(btn.getAttribute('aria-label')!==label+': '+valor) btn.setAttribute('aria-label',label+': '+valor);
      if(btn.title!==label) btn.title=label;
      if(btn.disabled!==input.disabled) btn.disabled=input.disabled;
    });
  }
  function abrirData(input,acionador){
    if(!input.isConnected||input.disabled||input.readOnly) return;
    let selecionada=diaCalendarioValido(input.value)?input.value:'';
    const limpavel=!input.required&&!['hero-date-input','gasto-data','inv-div-data'].includes(input.id);
    let mes=selecionada?new Date(selecionada+'T12:00:00'):today();
    mes=new Date(mes.getFullYear(),mes.getMonth(),1,12);
    const corpo=document.createElement('div');corpo.className='date-calendar';
    function permitido(iso){return (!input.min||iso>=input.min)&&(!input.max||iso<=input.max);}
    function desenhar(foco=null){
      const ano=mes.getFullYear(),m=mes.getMonth(),offset=(mes.getDay()+6)%7;
      const ultimo=new Date(ano,m+1,0,12).getDate();let diasHtml='';
      for(let i=0;i<offset;i++) diasHtml+='<span aria-hidden="true"></span>';
      for(let n=1;n<=ultimo;n++){
        const d=new Date(ano,m,n,12),iso=isoDate(d);
        diasHtml+=`<button type="button" class="skip-cal-day${iso===selecionada?' is-selected':''}" data-date-day="${iso}" aria-label="${esc(d.toLocaleDateString(localeAtual(),{dateStyle:'full'}))}" aria-pressed="${iso===selecionada}"${permitido(iso)?'':' disabled'}${iso===isoDate(today())?' aria-current="date"':''}>${n}</button>`;
      }
      const mesesHtml=Array.from({length:12},(_,i)=>`<option value="${i}"${i===m?' selected':''}>${esc(new Date(2026,i,1,12).toLocaleDateString(localeAtual(),{month:'long'}))}</option>`).join('');
      const anoAtual=today().getFullYear(),anos=new Set([ano]);
      for(let a=1900;a<=Math.min(9998,anoAtual+100);a++) anos.add(a);
      const anosHtml=[...anos].sort((a,b)=>a-b).map(a=>`<option value="${a}"${a===ano?' selected':''}${a===anoAtual?` aria-label="${a} · ${esc(L('date.anoAtual'))}"`:''}>${a}${a===anoAtual?' •':''}</option>`).join('');
      const semanaHtml=Array.from({length:7},(_,i)=>`<span>${esc(new Date(2026,5,1+i,12).toLocaleDateString(localeAtual(),{weekday:'short'}).replace(/\.$/,''))}</span>`).join('');
      corpo.innerHTML=`<div class="date-month-nav"><button type="button" data-date-prev aria-label="${esc(L('skip.anterior'))}">‹</button><select data-date-month aria-label="${esc(L('date.mes'))}">${mesesHtml}</select><select data-date-year aria-label="${esc(L('date.ano'))}">${anosHtml}</select><button type="button" data-date-next aria-label="${esc(L('skip.proximo'))}">›</button></div>
        <div class="skip-cal-week" aria-hidden="true">${semanaHtml}</div><div class="skip-cal-grid">${diasHtml}</div>
        <p class="skip-cal-summary" aria-live="polite">${selecionada?esc(new Date(selecionada+'T12:00:00').toLocaleDateString(localeAtual(),{dateStyle:'long'})):L('date.escolher')}</p>
        <div class="date-shortcuts"><button type="button" data-date-today${permitido(isoDate(today()))?'':' disabled'}>${L('date.hoje')}</button><button type="button" data-date-clear${limpavel?'':' disabled'}>${L('date.limpar')}</button></div>
        <div class="skip-cal-actions"><button type="button" data-date-cancel>${L('date.cancelar')}</button><button type="button" class="skip-add-btn" data-date-confirm${!selecionada&&!limpavel?' disabled':''}>${L('date.confirmar')}</button></div>`;
      if(foco) corpo.querySelector(foco)?.focus({preventScroll:true});
    }
    corpo.addEventListener('click',e=>{
      const btn=e.target.closest('button');if(!btn||btn.disabled) return;
      if(btn.dataset.dateDay){selecionada=btn.dataset.dateDay;desenhar(`[data-date-day="${selecionada}"]`);animarInterface(corpo.querySelector(`[data-date-day="${selecionada}"]`),'selecao');}
      else if(btn.hasAttribute('data-date-prev')||btn.hasAttribute('data-date-next')){
        const passo=btn.hasAttribute('data-date-prev')?-1:1;
        const proximo=new Date(mes.getFullYear(),mes.getMonth()+passo,1,12);
        if(proximo.getFullYear()<1900||proximo.getFullYear()>9998) return;
        mes=proximo;desenhar(passo<0?'[data-date-prev]':'[data-date-next]');animarInterface(corpo.querySelector('.skip-cal-grid'),'mes');
      }else if(btn.hasAttribute('data-date-today')){
        selecionada=isoDate(today());mes=new Date(today().getFullYear(),today().getMonth(),1,12);desenhar('[data-date-today]');
      }else if(btn.hasAttribute('data-date-clear')){selecionada='';desenhar('[data-date-clear]');}
      else if(btn.hasAttribute('data-date-cancel')) fecharCalendario();
      else if(btn.hasAttribute('data-date-confirm')){
        if(!input.isConnected){fecharCalendario();return;}
        const mudou=input.value!==selecionada;
        fecharCalendario();input.value=selecionada;sincronizar();
        if(mudou){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
        if(acionador.isConnected) acionador.focus({preventScroll:true});
      }
    });
    corpo.addEventListener('change',e=>{
      if(!e.target.matches('[data-date-month],[data-date-year]')) return;
      const ano=Number(corpo.querySelector('[data-date-year]').value),m=Number(corpo.querySelector('[data-date-month]').value);
      if(!Number.isInteger(ano)||ano<1900||ano>9998){e.target.reportValidity();return;}
      const foco=e.target.matches('[data-date-year]')?'[data-date-year]':'[data-date-month]';
      mes=new Date(ano,m,1,12);desenhar(foco);
      animarInterface(corpo.querySelector('.skip-cal-grid'),'mes');
    });
    desenhar();abrirCalendario(rotulo(input),corpo);
  }
  document.getElementById('calendar-close').addEventListener('click',fecharCalendario);
  document.getElementById('calendar-backdrop').addEventListener('click',fecharCalendario);
  document.addEventListener('change',sincronizar);
  document.addEventListener('click',e=>{
    const label=e.target.closest('label[for]');if(!label) return;
    const input=document.getElementById(label.htmlFor),btn=proxies.get(input);
    if(btn){e.preventDefault();btn.click();}
  });
  new MutationObserver(sincronizar).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','lang','value']});
  sincronizar();
}
