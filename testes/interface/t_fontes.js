/* As fontes saíram do HTML: precisam continuar chegando, e ficar no cache. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };
(async () => {
  const cdp = await conectar();
  await cdp.enviar('Network.enable');
  await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await irPara(cdp, 'http://localhost:4173/');
  await avaliar(cdp, `
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
    const ns=await caches.keys(); await Promise.all(ns.map(n=>caches.delete(n)));
    return 1;`).catch(()=>{});
  await cdp.enviar('Network.clearBrowserCache');
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(2500);

  const r = await avaliar(cdp, `
    await document.fonts.ready;
    const carregadas=[...document.fonts].filter(f=>f.status==='loaded');
    const req=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/fonts/'));
    const falhou=req.filter(e=>e.transferSize===0&&e.decodedBodySize===0);
    /* o texto usa mesmo as fontes do app, e não a do sistema? */
    const hero=document.querySelector('.hero-number')||document.querySelector('h1,.section-title');
    return {familias:[...new Set(carregadas.map(f=>f.family))], nCarregadas:carregadas.length,
      pedidas:req.length, falharam:falhou.map(e=>e.name),
      fonteDoTitulo:hero?getComputedStyle(hero).fontFamily.split(',')[0]:null,
      bytes:Math.round(req.reduce((s,e)=>s+(e.transferSize||0),0)/1024)};`);
  console.log(`  ${r.pedidas} arquivos de fonte pedidos · ${r.bytes} KB · famílias: ${r.familias.join(', ')}`);
  conferir(r.pedidas > 0, 'as fontes são buscadas como arquivo');
  conferir(r.falharam.length === 0, 'e todas chegaram', r.falharam.join('\n       '));
  conferir(r.nCarregadas > 0, `${r.nCarregadas} face(s) em uso de verdade`);
  conferir(/Sora|Nunito|IBM/.test(r.fonteDoTitulo || ''), `o texto usa a fonte do app (${r.fonteDoTitulo})`,
    'caiu na fonte do sistema — o arquivo não chegou ou o nome mudou');

  await esperar(1200);
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(2000);
  const segunda = await avaliar(cdp, `
    const req=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/fonts/'));
    return {daRede:req.filter(e=>e.transferSize>0).length, total:req.length,
      sw:!!navigator.serviceWorker.controller};`);
  conferir(segunda.sw && segunda.daRede === 0,
    `na segunda visita nenhuma fonte volta à rede (${segunda.daRede} de ${segunda.total})`,
    'o service worker deveria servi-las de /assets/');

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mAs fontes chegam e ficam guardadas.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar(); process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
