/* ─── tour guiado: aponta pra 5 pontos-chave do app, um por vez, estilo tutorial de jogo ─── */
function startTour(){
  const idioma=data.idioma||'pt';
  const STEPS_I18N={
    pt:[
      {sel:'.hero', title:'Seu resumo', text:'Aqui fica o saldo estimado, dias de trabalho, renda e quanto falta receber/pagar até a data escolhida.', tab:'view-resumo'},
      {sel:'#gasto-fab', title:'Registrar um gasto', text:'Toque no + sempre que fizer uma compra — escolha dinheiro, pix, débito ou crédito.', tab:'view-resumo'},
      {sel:'#transacoes-list', title:'Diário', text:'Aqui fica o histórico de tudo que você já lançou, dia por dia. Deslize um item pra editar ou apagar.', tab:'view-diario'},
      {sel:'#gf-new-btn', title:'Fixos', text:'Contas que se repetem todo mês (internet, aluguel, assinaturas) — cadastre aqui uma vez e elas entram sozinhas no cálculo todo mês.', tab:'view-fixos'},
      {sel:'#rr-new-btn', title:'Entradas', text:'Fontes de renda recorrente (salário, freelas fixos) além da renda principal ficam aqui.', tab:'view-entradas'},
      {sel:'#inv-new-btn', title:'Economias', text:'Acompanhe investimentos, metas de poupança e seu patrimônio ao longo do tempo.', tab:'view-economias'},
      {sel:'#topbar-settings-btn', title:'Configurações', text:'Ajuste renda, cartões, categorias e temas por aqui sempre que precisar.', tab:'view-resumo'},
    ],
    en:[
      {sel:'.hero', title:'Your overview', text:'Estimated balance, work days, income and what\'s still due/owed until the chosen date.', tab:'view-resumo'},
      {sel:'#gasto-fab', title:'Log an expense', text:'Tap + whenever you make a purchase — choose cash, Pix, debit or credit.', tab:'view-resumo'},
      {sel:'#transacoes-list', title:'Journal', text:'History of everything you\'ve logged, day by day. Swipe an item to edit or delete.', tab:'view-diario'},
      {sel:'#gf-new-btn', title:'Bills', text:'Recurring bills (internet, rent, subscriptions) — register once and they factor into the calculation every month automatically.', tab:'view-fixos'},
      {sel:'#rr-new-btn', title:'Income', text:'Recurring income sources (salary, steady freelance work) besides your main income live here.', tab:'view-entradas'},
      {sel:'#inv-new-btn', title:'Savings', text:'Track investments, savings goals and your net worth over time.', tab:'view-economias'},
      {sel:'#topbar-settings-btn', title:'Settings', text:'Adjust income, cards, categories and themes here whenever you need.', tab:'view-resumo'},
    ],
    es:[
      {sel:'.hero', title:'Tu resumen', text:'Saldo estimado, días trabajados, ingresos y cuánto falta por cobrar/pagar hasta la fecha elegida.', tab:'view-resumo'},
      {sel:'#gasto-fab', title:'Registrar un gasto', text:'Toca el + cada vez que hagas una compra — elige efectivo, Pix, débito o crédito.', tab:'view-resumo'},
      {sel:'#transacoes-list', title:'Diario', text:'Historial de todo lo que registraste, día a día. Desliza un ítem para editar o borrar.', tab:'view-diario'},
      {sel:'#gf-new-btn', title:'Fijos', text:'Cuentas que se repiten cada mes (internet, alquiler, suscripciones) — regístralas una vez y entran solas en el cálculo cada mes.', tab:'view-fixos'},
      {sel:'#rr-new-btn', title:'Ingresos', text:'Fuentes de ingreso recurrentes (salario, freelance fijo) además del ingreso principal están aquí.', tab:'view-entradas'},
      {sel:'#inv-new-btn', title:'Ahorros', text:'Sigue inversiones, metas de ahorro y tu patrimonio a lo largo del tiempo.', tab:'view-economias'},
      {sel:'#topbar-settings-btn', title:'Configuración', text:'Ajusta ingresos, tarjetas, categorías y temas aquí siempre que lo necesites.', tab:'view-resumo'},
    ],
    fr:[
      {sel:'.hero', title:'Votre aperçu', text:'Solde estimé, jours travaillés, revenus et ce qui reste à recevoir/payer jusqu\'à la date choisie.', tab:'view-resumo'},
      {sel:'#gasto-fab', title:'Enregistrer une dépense', text:'Appuyez sur + à chaque achat — choisissez espèces, Pix, débit ou crédit.', tab:'view-resumo'},
      {sel:'#transacoes-list', title:'Journal', text:'Historique de tout ce que vous avez enregistré, jour par jour. Glissez un élément pour modifier ou supprimer.', tab:'view-diario'},
      {sel:'#gf-new-btn', title:'Factures', text:'Factures récurrentes (internet, loyer, abonnements) — enregistrez-les une fois et elles s\'ajoutent seules au calcul chaque mois.', tab:'view-fixos'},
      {sel:'#rr-new-btn', title:'Revenus', text:'Sources de revenus récurrentes (salaire, freelance stable) en plus du revenu principal se trouvent ici.', tab:'view-entradas'},
      {sel:'#inv-new-btn', title:'Épargne', text:'Suivez vos investissements, objectifs d\'épargne et votre patrimoine dans le temps.', tab:'view-economias'},
      {sel:'#topbar-settings-btn', title:'Paramètres', text:'Ajustez revenus, cartes, catégories et thèmes ici quand vous en avez besoin.', tab:'view-resumo'},
    ],
    it:[
      {sel:'.hero', title:'La tua panoramica', text:'Saldo stimato, giorni lavorati, reddito e cosa manca da ricevere/pagare fino alla data scelta.', tab:'view-resumo'},
      {sel:'#gasto-fab', title:'Registra una spesa', text:'Tocca + ogni volta che fai un acquisto — scegli contanti, Pix, debito o credito.', tab:'view-resumo'},
      {sel:'#transacoes-list', title:'Diario', text:'Storico di tutto ciò che hai registrato, giorno per giorno. Scorri una voce per modificare o eliminare.', tab:'view-diario'},
      {sel:'#gf-new-btn', title:'Bollette', text:'Bollette ricorrenti (internet, affitto, abbonamenti) — registrale una volta e entrano da sole nel calcolo ogni mese.', tab:'view-fixos'},
      {sel:'#rr-new-btn', title:'Entrate', text:'Fonti di reddito ricorrenti (stipendio, freelance stabile) oltre al reddito principale si trovano qui.', tab:'view-entradas'},
      {sel:'#inv-new-btn', title:'Risparmi', text:'Traccia investimenti, obiettivi di risparmio e il tuo patrimonio nel tempo.', tab:'view-economias'},
      {sel:'#topbar-settings-btn', title:'Impostazioni', text:'Regola reddito, carte, categorie e temi qui ogni volta che ne hai bisogno.', tab:'view-resumo'},
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
      let left=Math.min(window.innerWidth-cw-14,Math.max(14,r.left+r.width/2-cw/2));
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
