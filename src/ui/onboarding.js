/* ─── tour guiado: 5 passos, todos com alvo visível na tela inicial ─── */
/* Os textos moram nos cinco dicionários, como todo o resto da interface.
   Ficaram um bom tempo aqui dentro, escritos cinco vezes à mão: a auditoria
   conta as chaves usadas contra as definidas e não enxergava nenhuma delas,
   então um sexto idioma entraria com o tour calado em português, sem nada
   reprovar. Aqui sobrou só o que é estrutura: o alvo de cada passo. */
const TOUR_PASSOS=[
  {sel:'#hero-content', chave:'p1'},
  {sel:'#stat-chips', chave:'p2'},
  {sel:'#gasto-fab', chave:'p3'},
  {sel:'.bn-item[data-target="view-fixos"]', chave:'p4'},
  {sel:'#topbar-settings-btn', chave:'p5'},
];

function startTour(){
  const steps=TOUR_PASSOS.map(p=>({
    sel:p.sel,
    title:L('tour.'+p.chave+'Titulo'),
    text:L('tour.'+p.chave+'Texto'),
    tab:'view-resumo',
  }));
  let i=0;
  const blocker=document.createElement('div'); blocker.className='tour-blocker';
  const spot=document.createElement('div'); spot.className='tour-spotlight';
  const callout=document.createElement('div'); callout.className='tour-callout';
  callout.setAttribute('role','dialog'); callout.setAttribute('aria-modal','true');
  callout.setAttribute('aria-labelledby','tour-callout-title'); callout.setAttribute('aria-describedby','tour-callout-text');
  callout.innerHTML=`<div class="tour-callout-title" id="tour-callout-title"></div><div class="tour-callout-text" id="tour-callout-text"></div><div class="tour-callout-foot"><span class="tour-callout-progress"></span><div class="tour-callout-actions"><button type="button" class="tour-skip">${L('tour.skip')}</button><button type="button" class="tour-next">${L('tour.next')}</button></div></div>`;
  document.body.append(blocker,spot,callout);
  let restaurar=null;
  async function finish(){
    data.tourCompleto=true; await persist();
    if(restaurar){ restaurar(); restaurar=null; }
    blocker.remove(); spot.remove(); callout.remove();
    window.removeEventListener('resize',position);
  }
  function position(){
    const step=steps[i]; if(!step) return;
    const el=document.querySelector(step.sel);
    if(!el){ i++; return step_next(); }
    function place(){
      const r=el.getBoundingClientRect();
      const pad=6;
      spot.style.top=(r.top-pad)+'px'; spot.style.left=(r.left-pad)+'px';
      spot.style.width=(r.width+pad*2)+'px'; spot.style.height=(r.height+pad*2)+'px';
      callout.querySelector('.tour-callout-title').textContent=step.title;
      callout.querySelector('.tour-callout-text').textContent=step.text;
      callout.querySelector('.tour-callout-progress').textContent=`${i+1}/${steps.length}`;
      callout.querySelector('.tour-next').textContent=L(i===steps.length-1?'tour.done':'tour.next');
      const cw=callout.offsetWidth||300;
      /* Centralizar sob o alvo só funciona quando os dois têm largura parecida.
         Num monitor largo o alvo pode ter 1000 px e a caixa 300: centralizada,
         ela aterrissa no meio do nada e parece uma janela solta, sem ligação
         com o que está destacando. Quando o alvo é bem mais largo, a caixa
         encosta na borda esquerda dele. */
      const alvoMuitoLargo=r.width>cw*1.6;
      const desejado=alvoMuitoLargo ? r.left+24 : r.left+r.width/2-cw/2;
      let left=Math.min(window.innerWidth-cw-14,Math.max(14,desejado));
      const spaceBelow=window.innerHeight-r.bottom;
      const top=spaceBelow>180?r.bottom+pad+14:Math.max(14,r.top-pad-14-callout.offsetHeight);
      callout.style.left=left+'px'; callout.style.top=top+'px';
    }
    const r0=el.getBoundingClientRect();
    // se o elemento ficou fora da tela (abas mais longas, tipo Economias), rola até ele antes de posicionar
    if(r0.top<0||r0.bottom>window.innerHeight){
      window.scrollTo({top:Math.max(0,r0.top+window.scrollY-window.innerHeight/2+r0.height/2),behavior:'auto'});
      setTimeout(place,80);
    }else{
      place();
    }
  }
  function step_next(){
    if(i>=steps.length){ finish(); return; }
    const step=steps[i];
    if(step.tab){ const tabBtn=document.querySelector(`.bn-item[data-target="${step.tab}"]`); if(tabBtn) tabBtn.click(); }
    setTimeout(position,step.tab?260:0);
  }
  callout.querySelector('.tour-next').addEventListener('click',()=>{ i++; if(i>=steps.length) finish(); else step_next(); });
  callout.querySelector('.tour-skip').addEventListener('click',finish);
  window.addEventListener('resize',position);
  restaurar=ativarDialogo(callout,blocker,callout.querySelector('.tour-next'),finish);
  step_next();
}

/* ─── assistente de primeiro uso: preenche o essencial pra não cair de paraquedas na tela cheia ─── */
function setupOnboarding(){
  if(data.onboardingCompleto) return;
  const backdrop=document.getElementById('onboarding-backdrop');
  const dialog=document.getElementById('onboarding-dialog');
  if(!backdrop||!dialog) return;
  backdrop.style.display='block'; dialog.style.display='block';
  let restaurar=null;
  const idiomaEl=document.getElementById('ob-idioma');
  const moedaEl=document.getElementById('ob-moeda');
  if(idiomaEl) idiomaEl.value=data.idioma||'pt';
  if(moedaEl) moedaEl.value=data.moeda||'BRL';
  idiomaEl?.addEventListener('change',async()=>{
    if(!definirIdioma(idiomaEl.value)) return;
    await persist();
    applyIdioma();
  });
  moedaEl?.addEventListener('change',async()=>{
    if(!definirMoeda(moedaEl.value)) return;
    await persist();
    render();
  });
  const tipoEl=document.getElementById('ob-tipo-renda');
  const rendaLabel=document.getElementById('ob-renda-label');
  tipoEl.addEventListener('change',()=>{ rendaLabel.textContent=L(tipoEl.value==='diaria'?'ob.valorDiaria':'ob.salarioMensal'); });
  /* Este diálogo é a primeira coisa que a pessoa vê no app. Ele chamava os dois
     comandos e ignorava o retorno: dia de fechamento "45" devolvia null, o
     cartão não era criado e o diálogo fechava assim mesmo — ela saía achando
     que tinha cadastrado. Agora a recusa é dita, e só o cartão é perdido:
     obrigar a corrigir logo na abertura seria pior do que deixar pra depois. */
  async function finalizar(aplicar){
    const avisos=[];
    if(aplicar){
      const rendaLida=parseNum(document.getElementById('ob-renda-valor').value);
      const saldoLido=parseNum(document.getElementById('ob-saldo').value);
      const rendaValor=Number.isFinite(rendaLida)&&rendaLida>=0?rendaLida:0;
      const saldoValor=Number.isFinite(saldoLido)?saldoLido:0;
      if(!configurarPerfilFinanceiro({tipoRenda:tipoEl.value,renda:rendaValor,saldoAtual:saldoValor})) avisos.push(L('erro.obPerfil'));
      const cNome=(document.getElementById('ob-cartao-nome').value||'').trim();
      if(cNome){
        const cLimite=parseNumOpcional(document.getElementById('ob-cartao-limite').value);
        const cFechamento=parseInt(document.getElementById('ob-cartao-fechamento').value,10)||null;
        const cVencimento=parseInt(document.getElementById('ob-cartao-vencimento').value,10)||null;
        if(!criarCartao({nome:cNome,limite:cLimite,diaFechamento:cFechamento,diaVencimento:cVencimento})) avisos.push(L('erro.obCartao'));
      }
    }
    data.onboardingCompleto=true;
    backdrop.style.display='none'; dialog.style.display='none';
    if(restaurar){ restaurar(); restaurar=null; }
    await persist(); render();
    for(const aviso of avisos) await alertDialog(aviso);
    if(!data.tourCompleto) setTimeout(startTour,350);
  }
  document.getElementById('ob-confirm-btn').addEventListener('click',()=>finalizar(true));
  document.getElementById('ob-skip-btn').addEventListener('click',()=>finalizar(false));
  restaurar=ativarDialogo(dialog,backdrop,document.getElementById('ob-idioma'),()=>finalizar(false));
}
