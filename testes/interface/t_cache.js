/* O service worker responde do cache e revalida por trás. Três coisas
   precisam ser verdade ao mesmo tempo:
     1. a segunda abertura não baixa a página de novo;
     2. uma publicação nova chega mesmo assim;
     3. e chega UMA vez — sem laço de recarga. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const CEN = require('./cenario').CENARIO;

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

async function abrirEMedir(cdp) {
  await irPara(cdp, URL);
  /* a navegacao de baixo existe em qualquer estado do app; o hero so aparece
     depois do onboarding, e esperar por ele dava 12s de timeout quando o
     localStorage estava vazio */
  for (let i = 0; i < 60; i++) {
    const pronto = await avaliar(cdp, `return !!document.querySelector('.bn-item');`);
    if (pronto) break;
    await esperar(100);
  }
  await esperar(250);
  return avaliar(cdp, `
    const nav=performance.getEntriesByType('navigation')[0]||{};
    const fcp=(performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint')||{}).startTime||0;
    return {bytesDaPagina:Math.round(nav.transferSize||0), fcp:Math.round(fcp),
      pronto:Math.round(performance.now()),
      sw:!!(navigator.serviceWorker&&navigator.serviceWorker.controller)};`);
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Network.enable');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  /* conta quantas vezes a página foi buscada de verdade na rede */
  let idasARede = 0;
  cdp.ao('Network.requestWillBeSent', p => {
    if (p.type === 'Document' && p.request.url.split('?')[0] === URL) idasARede++;
  });

  await irPara(cdp, URL);
  /* com o localStorage vazio o app abre no onboarding, e ai `podeRecarregar()`
     recusa trocar a pagina debaixo de quem esta no meio dele — com razao. Um
     app ja configurado e o caso que este teste quer medir. */
  await avaliar(cdp, CEN);
  await avaliar(cdp, `
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
    const ns=await caches.keys(); await Promise.all(ns.map(n=>caches.delete(n)));
    return 1;`).catch(() => {});
  await cdp.enviar('Network.clearBrowserCache');

  console.log('\n  \x1b[1mprimeira abertura (nada salvo)\x1b[0m');
  const um = await abrirEMedir(cdp);
  console.log(`     ${(um.bytesDaPagina / 1024).toFixed(0)} KB · paint ${um.fcp}ms · pronto ${um.pronto}ms`);
  await esperar(1500); // deixa o sw assumir

  console.log('\n  \x1b[1msegunda abertura (com o sw no comando)\x1b[0m');
  const dois = await abrirEMedir(cdp);
  console.log(`     ${(dois.bytesDaPagina / 1024).toFixed(0)} KB · paint ${dois.fcp}ms · pronto ${dois.pronto}ms · sw: ${dois.sw ? 'sim' : 'não'}`);
  conferir(dois.sw, 'o service worker assumiu');
  conferir(dois.bytesDaPagina < 50 * 1024,
    `a página não é baixada de novo (${(dois.bytesDaPagina / 1024).toFixed(0)} KB, era ${(um.bytesDaPagina / 1024).toFixed(0)} KB)`,
    'continua gastando dados a cada abertura');
  conferir(dois.pronto < um.pronto, `e abre mais rápido (${dois.pronto}ms contra ${um.pronto}ms)`);

  console.log('\n  \x1b[1mchega uma publicação nova\x1b[0m');
  /* muda o arquivo publicado como uma publicação de verdade mudaria */
  const fs = require('fs');
  /* o servidor de desenvolvimento roda o build a cada pedido, a partir de
     src/ — mexer em dist/ nao muda o que ele entrega */
  const alvo = require('./projeto').SRC_HTML;
  const original = fs.readFileSync(alvo, 'utf8');
  let recargas = 0;
  cdp.ao('Network.requestWillBeSent', p => {
    if (p.type === 'Document' && p.request.url.split('?')[0] === URL) recargas++;
  });
  recargas = 0;
  fs.writeFileSync(alvo, original.replace('</body>', '<!-- publicacao nova de teste -->\n</body>'));
  try {
    await irPara(cdp, URL);                 // abre: cache responde, rede revalida
    await esperar(3500);                    // tempo do aviso chegar e recarregar
    const depois = await avaliar(cdp, `
      return {temMarca:document.documentElement.outerHTML.includes('publicacao nova de teste'),
        pronto:Math.round(performance.now())};`);
    conferir(depois.temMarca, 'a publicação nova chegou sozinha, sem ninguém recarregar na mão',
      'a pessoa ficaria presa numa versão antiga enquanto o cache respondesse');

    /* e agora o que importa: não pode ficar recarregando pra sempre */
    const antes = recargas;
    await esperar(4000);
    conferir(recargas - antes <= 1,
      `parou de recarregar depois de trocar (${recargas - antes} ida(s) à rede em 4s)`,
      'laço de recarga: o aviso dispara, o cache velho responde, e recomeça');
  } finally {
    fs.writeFileSync(alvo, original);
  }

  console.log('\n  \x1b[1moffline depois de tudo isso\x1b[0m');
  await cdp.enviar('Network.emulateNetworkConditions',
    { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const off = await abrirEMedir(cdp).catch(e => ({ erro: e.message }));
  conferir(!off.erro && off.pronto > 0, off.erro ? `não abriu: ${off.erro}` : `abre sem rede (${off.pronto}ms)`);
  await cdp.enviar('Network.emulateNetworkConditions',
    { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mO cache responde, revalida e não se repete.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
