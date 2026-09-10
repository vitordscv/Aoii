/* ── abas de visão ──
   Um grupo de assuntos, um painel por vez. Serve as Configurações, os Fixos,
   as Entradas e as Economias — o mesmo gesto nos quatro lugares.

   Por que existe: cada aba do app era uma pilha de assuntos independentes
   empilhados numa rolagem só. "Entradas" media 1.704 px com dados de teste;
   com dados de verdade, muito mais. Rolar não é navegar — quem quer as
   compras planejadas não devia passar por entradas extras e dívidas antes.

   Não compõe ids: cada aba diz qual painel comanda pelo `aria-controls`, e o
   painel diz qual aba o nomeia pelo `aria-labelledby`. Assim a marcação é a
   fonte da verdade e não há convenção de nome pra alguém quebrar sem querer.

   É uma tablist de verdade porque a diferença aparece pra quem não usa mouse:
   o leitor de tela anuncia "aba 2 de 4, selecionada", e o foco anda com as
   setas em vez de exigir um Tab por aba. Só a aba ativa fica no caminho do
   Tab; as outras respondem a ← → Home End. */

function _abasDoGrupo(barra){
  return Array.from(barra.querySelectorAll('[role="tab"]'));
}

function mostrarVisao(barra,alvo,moverFoco){
  const abas=_abasDoGrupo(barra);
  if(!abas.length) return;
  let escolhida=abas.find(a=>a.getAttribute('data-pane')===alvo)||abas[0];

  abas.forEach(aba=>{
    const painel=document.getElementById(aba.getAttribute('aria-controls'));
    const ativa=aba===escolhida;
    aba.setAttribute('aria-selected',ativa?'true':'false');
    aba.setAttribute('tabindex',ativa?'0':'-1');
    aba.classList.toggle('ativa',ativa);
    if(painel) painel.hidden=!ativa;
  });

  /* A barra de abas rola na horizontal quando não cabe tudo. A aba ativa pode
     nascer fora da parte visível — a memória por grupo costuma restaurar a
     última aba usada, que é frequentemente a mais à direita. Sem isto, a
     pessoa abre "Entradas" e vê três abas sem nenhuma marcada: a selecionada
     está ali, só que fora da tela. */
  escolhida.scrollIntoView({inline:'nearest',block:'nearest'});

  /* Iframe que só existe quando a visão é aberta: enquanto o painel está
     escondido, o endereço fica em data-src e nada é buscado. Quem nunca abre
     Investimentos nunca pede a faixa de cotações a ninguém. */
  const painelAtivo=document.getElementById(escolhida.getAttribute('aria-controls'));
  if(painelAtivo){
    painelAtivo.querySelectorAll('iframe[data-src]').forEach(f=>{
      f.src=f.getAttribute('data-src');
      f.removeAttribute('data-src');
    });
  }

  const grupo=barra.getAttribute('data-grupo');
  const sub=document.querySelector('[data-abas-sub="'+grupo+'"]');
  if(sub){
    const chave=escolhida.getAttribute('data-sub');
    sub.textContent=chave?L(chave):'';
    sub.hidden=!chave;
  }

  /* o painel novo começa do topo: herdar a rolagem do anterior deixa a pessoa
     no meio de um assunto que ela não escolheu */
  const rolavel=barra.closest('.settings-body')?barra.closest('.settings-panel'):null;
  if(rolavel) rolavel.scrollTop=0;
  else if(!moverFoco) barra.scrollIntoView({block:'nearest'});

  if(moverFoco) escolhida.focus();
  try{ localStorage.setItem('financas-visao-'+grupo,escolhida.getAttribute('data-pane')); }catch(e){}
}

/* Chamado sempre que algo que estava escondido passa a aparecer: trocar de
   visão pela barra de baixo, ou abrir o modal de configurações. Uma rolagem
   calculada com o contêiner ainda em display:none não rola nada (o elemento
   não tem tamanho); repetir já visível é o que garante a aba certa aparecer
   marcada, e não só as primeiras da fileira. */
function corrigirAbasVisiveisEm(raiz){
  (raiz||document).querySelectorAll('[role="tablist"][data-grupo]').forEach(barra=>{
    const ativa=barra.querySelector('[aria-selected="true"]');
    if(ativa) ativa.scrollIntoView({inline:'nearest',block:'nearest'});
  });
}

function ligarAbasDeVisao(){
  document.querySelectorAll('[role="tablist"][data-grupo]').forEach(barra=>{
    if(barra.dataset.ligada) return;
    barra.dataset.ligada='1';
    const grupo=barra.getAttribute('data-grupo');
    const abas=_abasDoGrupo(barra);

    abas.forEach(a=>a.addEventListener('click',()=>mostrarVisao(barra,a.getAttribute('data-pane'))));

    barra.addEventListener('keydown',e=>{
      const i=abas.indexOf(document.activeElement);
      if(i<0) return;
      let alvo=null;
      if(e.key==='ArrowRight') alvo=(i+1)%abas.length;
      else if(e.key==='ArrowLeft') alvo=(i-1+abas.length)%abas.length;
      else if(e.key==='Home') alvo=0;
      else if(e.key==='End') alvo=abas.length-1;
      if(alvo===null) return;
      e.preventDefault();
      mostrarVisao(barra,abas[alvo].getAttribute('data-pane'),true);
    });

    let guardada=null;
    try{ guardada=localStorage.getItem('financas-visao-'+grupo); }catch(e){}
    mostrarVisao(barra,guardada);
  });
}
