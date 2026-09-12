/* Sem rede o app tem que abrir e continuar anotando gasto — é o caso de usar
   ele dentro do mercado, com o celular sem sinal. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

const rede = (cdp, offline) => cdp.enviar('Network.emulateNetworkConditions',
  { offline, latency: 0, downloadThroughput: offline ? 0 : -1, uploadThroughput: offline ? 0 : -1 });

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Network.enable');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });

  console.log('\n\x1b[1mCom rede: registrar o service worker\x1b[0m');
  await irPara(cdp, URL);
  await esperar(1200);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,400)); return 1;`);
  /* espera o SW assumir o controle */
  const sw = await avaliar(cdp, `
    if(!('serviceWorker' in navigator)) return {suportado:false};
    const reg=await navigator.serviceWorker.ready.catch(()=>null);
    for(let i=0;i<20 && !navigator.serviceWorker.controller;i++) await new Promise(r=>setTimeout(r,300));
    return {suportado:true, registrado:!!reg, controlando:!!navigator.serviceWorker.controller};
  `);
  conferir(sw.registrado, `service worker registrado`);
  conferir(sw.controlando, `e no controle da página`, 'sem controlador, o cache offline não é consultado');

  console.log('\n\x1b[1mSem rede\x1b[0m');
  await rede(cdp, true);
  await esperar(400);

  /* recarrega offline: o shell tem que vir do cache */
  let abriu = false;
  try {
    await irPara(cdp, URL);
    await esperar(2000);
    abriu = await avaliar(cdp, `return !!document.querySelector('.hero') && !!document.getElementById('gasto-fab');`);
  } catch (e) { abriu = false; }
  conferir(abriu, 'o app abre offline (shell veio do cache)');

  if (abriu) {
    /* `navigator.onLine` NAO segue `Network.emulateNetworkConditions`: o Chrome
       so o muda quando a maquina perde a rede de verdade. Medi-lo aqui reprova
       um app que esta certo. O que da pra conferir e o que importa — que a
       pagina abriu e continua funcionando sem rede — e e o que vem abaixo. */

    /* anotar um gasto offline */
    const antes = await avaliar(cdp, `return (JSON.parse(localStorage.getItem('financas-data')).transacoes||[]).length;`);
    await avaliar(cdp, `
      document.getElementById('gasto-fab').click();
      await new Promise(r=>setTimeout(r,500));
      document.getElementById('gasto-valor').value='23,50';
      document.getElementById('gasto-valor').dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('gasto-descricao').value='Pão offline';
      document.getElementById('gasto-sheet-submit').click();
      await new Promise(r=>setTimeout(r,800));
      return 1;`);
    const depois = await avaliar(cdp, `return (JSON.parse(localStorage.getItem('financas-data')).transacoes||[]).length;`);
    conferir(depois === antes + 1, `dá pra anotar gasto sem rede (${antes} → ${depois})`);

    const naTela = await avaliar(cdp, `
      document.querySelector('.bn-item[data-target="view-diario"]').click();
      await new Promise(r=>setTimeout(r,600));
      return document.getElementById('transacoes-list').textContent.includes('Pão offline');`);
    conferir(naTela, 'e ele aparece na lista');

    /* as ferramentas que dependem de rede devem degradar, não quebrar */
    const fx = await avaliar(cdp, `
      document.getElementById('topbar-fx-btn').click();
      await new Promise(r=>setTimeout(r,600));
      const aberto=document.getElementById('fx-sheet').style.display==='block';
      document.getElementById('fx-atualizar').click();
      await new Promise(r=>setTimeout(r,1200));
      const nota=document.getElementById('fx-nota').textContent.trim();
      document.getElementById('fx-sheet-cancel').click();
      return {aberto, nota};`);
    conferir(fx.aberto, 'o conversor de moedas ainda abre offline');
    conferir(fx.nota.length > 0, `e diz o que houve: "${fx.nota.slice(0, 60)}"`,
      'ficou em silêncio — quem tentar atualizar não sabe por que não veio');

    const calc = await avaliar(cdp, `
      document.getElementById('topbar-calc-btn').click();
      await new Promise(r=>setTimeout(r,500));
      document.querySelector('[data-tecla="7"]').click();
      document.querySelector('[data-tecla="+"]').click();
      document.querySelector('[data-tecla="8"]').click();
      document.querySelector('[data-tecla="igual"]').click();
      await new Promise(r=>setTimeout(r,300));
      const r=document.getElementById('calcz-resultado').textContent.trim();
      document.getElementById('calc-sheet-cancel').click();
      return r;`);
    conferir(calc === '15', `a calculadora funciona offline (7+8 = ${calc})`);
  }

  console.log('\n\x1b[1mRede de volta\x1b[0m');
  await rede(cdp, false);
  await esperar(500);
  const voltou = await avaliar(cdp, `
    const r = await fetch('/manifest.webmanifest',{cache:'no-store'}).then(r=>r.ok).catch(()=>false);
    return r;`);
  conferir(voltou === true, 'com a rede de volta, o app alcança o servidor outra vez');

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mFunciona sem rede.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
