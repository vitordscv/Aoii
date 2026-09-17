/* ── O que a tela diz quando o banco não é o Nubank ────────────────────────

   Três avisos nasceram juntos, e os três existem porque o app errava CALADO —
   que é o pior jeito de errar num app de dinheiro. O motor já tem teste para
   cada um; o que se mede aqui é a outra metade: se eles chegam à tela.

   1. conta com rótulo que o Aoii não conhece — ficava de fora do saldo e o
      plano saía idêntico ao de quem não tem essa conta;
   2. nenhuma conta de banco reconhecida — a sincronização rodava, dizia que
      deu certo, e o saldo ficava exatamente onde estava;
   3. conexão caída no Pierre — o `balance` continua vindo, parece atual, e
      está congelado na data em que a conexão morreu. Quem acabou de mover
      dinheiro vê o saldo parado e conclui que o app quebrou.

   O dublê troca de resposta no meio do teste (`window.__fase`): a primeira
   leva tem conta estranha e conexão caída, a segunda tem só a estranha — que
   é o caso em que o saldo não se mexe. */
'use strict';
const { conectar, avaliar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp } = require('./ajuda');

/* Nasce com a página: o app pode consultar antes de um `Runtime.evaluate`
   chegar — foi assim que uma versão de `t_pierre_abrir` mediu zero chamadas
   onde havia uma. */
const DUBLE = `
  window.__fase=1;
  const fetchReal=window.fetch;
  window.fetch=async function(entrada,init){
    const url=String(entrada&&entrada.url||entrada||'');
    if(!url.includes('/api/pierre')) return fetchReal.apply(this,arguments);
    const rota=new URL(url,location.origin).searchParams.get('rota');
    if(rota==='get-bills'||rota==='get-installments'){
      return new Response(JSON.stringify({success:true,count:0,data:[]}),
        {status:200,headers:{'Content-Type':'application/json'}});
    }
    if(rota==='get-transactions'){
      return new Response(JSON.stringify({success:true,count:0,data:[]}),
        {status:200,headers:{'Content-Type':'application/json'}});
    }
    /* rótulo que não está em lista nenhuma: nem banco, nem cartão */
    const estranha={id:'z1',connectorName:'C6',name:'Algo',customName:null,
      type:'COISA_NOVA',subtype:null,balance:'5000.00',currencyCode:'BRL'};
    /* conta de banco de verdade, com a conexão caída e lida há 40 dias.
       A idade é relativa ao relógio de quem roda: data fixa envelheceria o
       teste junto com o calendário. */
    const caida={id:'b1',connectorName:'C6',name:'Conta',customName:null,
      type:'BANK',subtype:'CHECKING_ACCOUNT',balance:'742.10',currencyCode:'BRL',
      itemIsActive:false,
      lastUpdatedAt:new Date(Date.now()-40*86400000).toISOString()};
    const contas=window.__fase===1?[estranha,caida]:[estranha];
    return new Response(JSON.stringify({success:true,count:contas.length,data:contas}),
      {status:200,headers:{'Content-Type':'application/json'}});
  };`;

/* Configurações → Banco, liga a integração, cola a chave e verifica. */
const PREPARAR = `
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
  await new Promise(r=>setTimeout(r,300));
  document.getElementById('pierre-verificar-btn').click();
  await new Promise(r=>setTimeout(r,1200));
  return 1;`;

const SINCRONIZAR = `
  document.getElementById('pierre-sync-btn').click();
  await new Promise(r=>setTimeout(r,1800));
  const caixa=document.getElementById('pierre-plano');
  return {texto:caixa?caixa.textContent:'', escondida:caixa?caixa.hidden:true};`;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Page.enable');
  await cdp.enviar('Page.addScriptToEvaluateOnNewDocument', { source: DUBLE });
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 900, deviceScaleFactor: 2, mobile: false });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 430, altura: 900 });
  await avaliar(cdp, PREPARAR);

  titulo('a conta que o app não sabe classificar aparece na tela');
  const fase1 = await avaliar(cdp, SINCRONIZAR);
  conferir(!fase1.escondida && fase1.texto.length > 0,
    'o plano foi desenhado');
  conferir(/COISA_NOVA/.test(fase1.texto),
    'o rótulo desconhecido aparece com todas as letras',
    'sem o rótulo na tela não há como saber o que acrescentar à lista');

  titulo('e a conexão caída no Pierre também');
  conferir(/inativa|inactive|inattiva/i.test(fase1.texto),
    'a tela diz que a conexão está inativa',
    'o balance continua vindo e parecendo atual: sem aviso, o saldo parado vira "o app quebrou"');
  conferir(/40|atr[áa]s|ago|hace|fa\b|il y a/i.test(fase1.texto),
    'e diz de quando é o número que veio');

  titulo('nenhuma conta de banco reconhecida: a tela avisa que o saldo não muda');
  await avaliar(cdp, 'window.__fase=2; return 1;');
  const antes = await avaliar(cdp, `
    return JSON.parse(localStorage.getItem('financas-data')).saldoAtual;`);
  const fase2 = await avaliar(cdp, SINCRONIZAR);
  conferir(/nenhuma conta|no bank account|ninguna cuenta|aucun compte|nessun conto/i.test(fase2.texto),
    'com só a conta estranha, o plano avisa que o saldo vai ficar onde está',
    'aplicarSincronizacaoPierre() só grava o saldo com contasDeBanco>0 — isso acontecia calado');

  titulo('e o aviso não mente: confirmando, o saldo fica mesmo onde estava');
  const depois = await avaliar(cdp, `
    const btn=[...document.querySelectorAll('#pierre-plano button')]
      .find(b=>b.classList.contains('add-gasto-confirm'));
    if(btn&&!btn.disabled) btn.click();
    await new Promise(r=>setTimeout(r,1200));
    return JSON.parse(localStorage.getItem('financas-data')).saldoAtual;`);
  conferir(depois === antes,
    `o saldo continua ${antes} depois de confirmar`,
    'a conta estranha valia R$ 5.000: se ela tivesse entrado no saldo por palpite, apareceria aqui');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
