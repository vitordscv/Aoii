/* ─── tour guiado: 5 passos, todos com alvo visível na tela inicial ─── */
function startTour(){
  const idioma=data.idioma||'pt';
  const STEPS_I18N={
    pt:[
      {sel:"#hero-content", title:"Isto é uma previsão", text:"O número grande não é o seu saldo de hoje: é quanto você deve ter na data escolhida, já descontando o que ainda vai sair. É para isso que o app existe.", tab:'view-resumo'},
      {sel:"#stat-chips", title:"De onde ele sai", text:"Da sua renda até lá, menos o que falta pagar, mais o que falta receber. Quanto mais coisas você cadastrar, mais perto da realidade fica.", tab:'view-resumo'},
      {sel:"#gasto-fab", title:"Toda compra entra aqui", text:"Toque no + assim que gastar. Leva cinco segundos e a previsão lá em cima se refaz na hora.", tab:'view-resumo'},
      {sel:".bn-item[data-target=\"view-fixos\"]", title:"O que se repete", text:"Aluguel, internet, assinaturas: cadastre uma vez em Fixos e o app desconta sozinho todo mês, sem você lembrar.", tab:'view-resumo'},
      {sel:"#topbar-settings-btn", title:"Comece por aqui", text:"Sua renda e seu cartão ficam nas Configurações. Sem eles a previsão fica pela metade — é o primeiro lugar para ir agora.", tab:'view-resumo'},
    ],
    en:[
      {sel:"#hero-content", title:"This is a forecast", text:"The big number is not today's balance: it is what you should have on the chosen date, with what is still going out already deducted. That is what this app is for.", tab:'view-resumo'},
      {sel:"#stat-chips", title:"Where it comes from", text:"Your income until then, minus what is left to pay, plus what is left to receive. The more you record, the closer to reality it gets.", tab:'view-resumo'},
      {sel:"#gasto-fab", title:"Every purchase goes here", text:"Tap + as soon as you spend. It takes five seconds and the forecast above redoes itself right away.", tab:'view-resumo'},
      {sel:".bn-item[data-target=\"view-fixos\"]", title:"What repeats", text:"Rent, internet, subscriptions: add them once under Bills and the app deducts them every month on its own.", tab:'view-resumo'},
      {sel:"#topbar-settings-btn", title:"Start here", text:"Your income and your card live in Settings. Without them the forecast is only half done — that is the first place to go now.", tab:'view-resumo'},
    ],
    es:[
      {sel:"#hero-content", title:"Esto es una previsión", text:"El número grande no es tu saldo de hoy: es cuánto deberías tener en la fecha elegida, ya descontando lo que aún va a salir. Para eso existe la app.", tab:'view-resumo'},
      {sel:"#stat-chips", title:"De dónde sale", text:"Tus ingresos hasta esa fecha, menos lo que falta pagar, más lo que falta cobrar. Cuanto más registres, más se acerca a la realidad.", tab:'view-resumo'},
      {sel:"#gasto-fab", title:"Cada compra entra aquí", text:"Toca el + en cuanto gastes. Lleva cinco segundos y la previsión de arriba se rehace al instante.", tab:'view-resumo'},
      {sel:".bn-item[data-target=\"view-fixos\"]", title:"Lo que se repite", text:"Alquiler, internet, suscripciones: regístralos una vez en Fijos y la app los descuenta sola cada mes.", tab:'view-resumo'},
      {sel:"#topbar-settings-btn", title:"Empieza por aquí", text:"Tus ingresos y tu tarjeta están en Configuración. Sin ellos la previsión queda a medias — es el primer lugar al que ir ahora.", tab:'view-resumo'},
    ],
    fr:[
      {sel:"#hero-content", title:"Ceci est une prévision", text:"Le grand nombre n'est pas votre solde du jour : c'est ce que vous devriez avoir à la date choisie, ce qui doit encore sortir étant déjà déduit. C'est à cela que sert l'app.", tab:'view-resumo'},
      {sel:"#stat-chips", title:"D'où il vient", text:"Vos revenus jusque-là, moins ce qu'il reste à payer, plus ce qu'il reste à recevoir. Plus vous enregistrez, plus c'est proche de la réalité.", tab:'view-resumo'},
      {sel:"#gasto-fab", title:"Chaque achat passe ici", text:"Touchez le + dès que vous dépensez. Cela prend cinq secondes et la prévision au-dessus se refait aussitôt.", tab:'view-resumo'},
      {sel:".bn-item[data-target=\"view-fixos\"]", title:"Ce qui revient", text:"Loyer, internet, abonnements : saisissez-les une fois dans Factures et l'app les déduit seule chaque mois.", tab:'view-resumo'},
      {sel:"#topbar-settings-btn", title:"Commencez ici", text:"Vos revenus et votre carte sont dans Paramètres. Sans eux la prévision reste à moitié faite — c'est le premier endroit où aller maintenant.", tab:'view-resumo'},
    ],
    it:[
      {sel:"#hero-content", title:"Questa è una previsione", text:"Il numero grande non è il saldo di oggi: è quanto dovresti avere alla data scelta, già tolto ciò che deve ancora uscire. L'app serve a questo.", tab:'view-resumo'},
      {sel:"#stat-chips", title:"Da dove viene", text:"Il tuo reddito fino a quella data, meno ciò che resta da pagare, più ciò che resta da ricevere. Più registri, più si avvicina alla realtà.", tab:'view-resumo'},
      {sel:"#gasto-fab", title:"Ogni spesa entra qui", text:"Tocca il + appena spendi. Ci vogliono cinque secondi e la previsione qui sopra si rifà subito.", tab:'view-resumo'},
      {sel:".bn-item[data-target=\"view-fixos\"]", title:"Ciò che si ripete", text:"Affitto, internet, abbonamenti: inseriscili una volta in Bollette e l'app li scala da sola ogni mese.", tab:'view-resumo'},
      {sel:"#topbar-settings-btn", title:"Comincia da qui", text:"Il tuo reddito e la tua carta stanno nelle Impostazioni. Senza, la previsione resta a metà — è il primo posto dove andare adesso.", tab:'view-resumo'},
    ],
  };
  const steps=STEPS_I18N[idioma]||STEPS_I18N.pt;
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
  async function finalizar(aplicar){
    if(aplicar){
      const rendaLida=parseNum(document.getElementById('ob-renda-valor').value);
      const saldoLido=parseNum(document.getElementById('ob-saldo').value);
      const rendaValor=Number.isFinite(rendaLida)&&rendaLida>=0?rendaLida:0;
      const saldoValor=Number.isFinite(saldoLido)?saldoLido:0;
      configurarPerfilFinanceiro({tipoRenda:tipoEl.value,renda:rendaValor,saldoAtual:saldoValor});
      const cNome=(document.getElementById('ob-cartao-nome').value||'').trim();
      if(cNome){
        const cLimite=parseNum(document.getElementById('ob-cartao-limite').value)||0;
        const cFechamento=parseInt(document.getElementById('ob-cartao-fechamento').value,10)||null;
        const cVencimento=parseInt(document.getElementById('ob-cartao-vencimento').value,10)||null;
        criarCartao({nome:cNome,limite:cLimite,diaFechamento:cFechamento,diaVencimento:cVencimento});
      }
    }
    data.onboardingCompleto=true;
    backdrop.style.display='none'; dialog.style.display='none';
    if(restaurar){ restaurar(); restaurar=null; }
    await persist(); render();
    if(!data.tourCompleto) setTimeout(startTour,350);
  }
  document.getElementById('ob-confirm-btn').addEventListener('click',()=>finalizar(true));
  document.getElementById('ob-skip-btn').addEventListener('click',()=>finalizar(false));
  restaurar=ativarDialogo(dialog,backdrop,document.getElementById('ob-idioma'),()=>finalizar(false));
}
