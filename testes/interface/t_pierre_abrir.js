/* ── "Buscar ao abrir o app": ela faz o que promete? ───────────────────────

   A opção diz "consulta o banco sozinho quando você entra". A primeira versão
   buscava e desenhava o resultado em `#pierre-plano`, que vive DENTRO da folha
   de Configurações — e o app abre no Resumo. Gastava a chamada e não entregava
   nada; se a pessoa fosse abrir Configurações de qualquer jeito, era só tocar
   em "Buscar", que é justamente o que a opção existe para poupar.

   Aqui se mede o que ela precisa fazer para valer a pena:

   1. achar sozinha, sem folha nenhuma aberta;
   2. **avisar no Resumo**, que é onde a pessoa está;
   3. não gravar nada antes de alguém ver;
   4. respeitar uma folga entre buscas — extrato não muda de minuto em minuto;
   5. e não ficar ligada e inútil quando a chave não sobrevive ao fechar o app. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp, APP } = require('./ajuda');

/* Instalado com `Page.addScriptToEvaluateOnNewDocument`, que roda ANTES de
   qualquer script da página. Com `Runtime.evaluate` o dublê chegava depois do
   disparo da busca (1,5 s) e a chamada ia para a rede de verdade — foi assim
   que uma versão anterior deste teste mediu "0 chamadas" onde havia uma. */
const DUBLE = `
  window.__pierreChamadas=0;
  const fetchReal=window.fetch;
  window.fetch=async function(entrada,init){
    const url=String(entrada&&entrada.url||entrada||'');
    if(!url.includes('/api/pierre')) return fetchReal.apply(this,arguments);
    window.__pierreChamadas++;
    const rota=new URL(url,location.origin).searchParams.get('rota');
    const corpo = rota==='get-accounts' ? {success:true,count:1,data:[
        {id:'a1',connectorName:'Nubank',name:'Conta',customName:null,type:'BANK',
         subtype:'CHECKING_ACCOUNT',balance:'2500.75',currencyCode:'BRL',itemIsActive:true}]}
      : {success:true,count:1,data:[
        {id:'px1',description:'Padaria',amount:-42.9,type:'DEBIT',date:'2026-09-10',
         category:'Alimentação',status:'POSTED',account_id:'a1',
         account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'}]};
    return new Response(JSON.stringify(corpo),{status:200,headers:{'Content-Type':'application/json'}});
  };`;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Page.enable');
  await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: DUBLE });
  /* o contador vive na página e sobrevive porque o dublê nasce com ela */
  const chamadas = async () => (await avaliar(cdp, 'return window.__pierreChamadas||0;')) || 0;
  const zerar = () => avaliar(cdp, 'window.__pierreChamadas=0; return 1;');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 900, deviceScaleFactor: 2, mobile: false });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 430, altura: 900 });

  titulo('ligando a integração, a chave e a busca ao abrir');
  await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,600));
    document.getElementById('settings-tab-banco').click();
    await new Promise(r=>setTimeout(r,400));
    const liga=document.getElementById('pierre-ativo-check');
    liga.checked=true; liga.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,500));
    const campo=document.getElementById('pierre-chave-input');
    campo.value='sk-teste00000000000000000000000000';
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    const abrir=document.getElementById('pierre-abrir-check');
    abrir.checked=true; abrir.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,600));
    return 1;`);

  const estado = await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {opcao:d.pierreBuscarAoAbrir,
      naSessao:!!sessionStorage.getItem('financas-pierre-chave'),
      noDisco:!!localStorage.getItem('financas-pierre-chave')};`);
  conferir(estado.opcao === true, 'a opção fica guardada');
  conferir(estado.naSessao && !estado.noDisco,
    'e a chave fica na sessão, que é o padrão de segurança');

  titulo('recarregar a página: a sessão sobrevive');
  await irPara(cdp, APP);
  await esperar(4500);
  const recarregou = await avaliar(cdp, `
    return {temChave:!!sessionStorage.getItem('financas-pierre-chave')};`);
  conferir(recarregou.temChave, 'a chave continua na sessão depois de recarregar');

  titulo('mas abrir o app DE NOVO começa sem a chave');
  const semChave = await avaliar(cdp, `
    /* é o que acontece ao fechar a aba, ou relançar o PWA: sessionStorage
       morre com a aba, localStorage não */
    sessionStorage.removeItem('financas-pierre-chave');
    return {naSessao:!!sessionStorage.getItem('financas-pierre-chave'),
      noDisco:!!localStorage.getItem('financas-pierre-chave')};`);
  conferir(!semChave.naSessao && !semChave.noDisco,
    'sem "lembrar a chave", ela não sobrevive ao fechar o app');

  await irPara(cdp, APP);
  await esperar(1000);
  await zerar();                /* senao a recarga anterior polui a contagem */
  await esperar(4000);
  const semChaveChamou = await chamadas();
  conferir(semChaveChamou === 0,
    `com a opção LIGADA e sem a chave, nada é buscado (${semChaveChamou} chamadas)`,
    'a opção fica ligada na tela e não faz nada — ninguém é avisado');

  titulo('com a chave no disco, ela busca E avisa no Resumo');
  await avaliar(cdp, `
    localStorage.setItem('financas-pierre-lembrar','1');
    localStorage.setItem('financas-pierre-chave','sk-teste00000000000000000000000000');
    return 1;`);
  /* a recarga anterior ja consumiu a folga; para medir a busca em si, zera o
     relogio dela — a folga tem bloco proprio logo abaixo */
  await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    d.pierreBuscadoEm=null;
    localStorage.setItem('financas-data',JSON.stringify(d));
    return 1;`);
  await irPara(cdp, APP);
  await esperar(5000);
  const comChaveChamou = await chamadas();
  const comChave = await avaliar(cdp, `
    const faixa=document.querySelector('#pierre-aviso .banco-banner');
    const folha=document.getElementById('settings-sheet');
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {temFaixa:!!faixa,
      faixaPintada:!!faixa&&faixa.offsetParent!==null,
      texto:faixa?faixa.textContent.trim():'',
      temBotao:!!(faixa&&faixa.querySelector('.banco-banner-btn')),
      folhaAberta:!!folha&&folha.style.display==='flex',
      lancados:(d.transacoes||[]).filter(t=>t.idExterno).length,
      buscadoEm:d.pierreBuscadoEm};`);
  conferir(comChaveChamou > 0,
    `a busca acontece sozinha (${comChaveChamou} chamada(s))`);
  conferir(comChave.faixaPintada,
    `e o achado aparece NO RESUMO ("${comChave.texto.slice(0, 52)}")`,
    'era desenhado dentro de Configurações, onde ninguém estava olhando');
  conferir(comChave.temBotao, 'com um toque para ver o plano inteiro');
  conferir(!comChave.folhaAberta,
    'sem abrir Configurações na cara de quem só queria abrir o app');
  conferir(comChave.lancados === 0,
    'e NADA foi gravado: quem confirma continua sendo quem lê',
    'buscar sozinho é uma coisa; gravar sozinho seria outra');

  titulo('a folga impede buscar a cada abertura');
  await irPara(cdp, APP);
  await esperar(1000);
  await zerar();
  await esperar(4000);
  const deNovo = await chamadas();
  conferir(deNovo === 0,
    `abrir de novo logo em seguida não consulta o banco (${deNovo} chamadas)`,
    'com o cartão ligado são quatro chamadas por abertura, e extrato não muda de minuto em minuto');

  titulo('ligar a busca sem guardar a chave não passa calado');
  const avisou = await avaliar(cdp, `
    localStorage.removeItem('financas-pierre-lembrar');
    localStorage.removeItem('financas-pierre-chave');
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,600));
    document.getElementById('settings-tab-banco').click();
    await new Promise(r=>setTimeout(r,400));
    const abrir=document.getElementById('pierre-abrir-check');
    abrir.checked=false; abrir.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,500));
    abrir.checked=true; abrir.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,900));
    const cd=document.getElementById('confirm-dialog');
    const perguntou=!!(cd&&cd.style.display==='block');
    const texto=cd?cd.textContent:'';
    if(perguntou) document.getElementById('confirm-ok').click();
    await new Promise(r=>setTimeout(r,700));
    return {perguntou,texto,
      lembrou:localStorage.getItem('financas-pierre-lembrar')==='1'};`);
  conferir(avisou.perguntou,
    'ligar "buscar ao abrir" sem a chave guardada pergunta antes',
    'ficaria verde na tela sem nunca rodar — ligada e inútil é pior que desligada');
  conferir(/chave/i.test(avisou.texto), 'e a pergunta explica o porquê');
  conferir(avisou.lembrou, 'dizendo sim, a chave passa a ser guardada');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
