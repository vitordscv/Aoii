/* A máscara do padrão de fundo saiu do CSS. O fundo tem que continuar lá —
   e em todos os temas que o usam. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const fs = require('fs');
const CEN = require('./cenario').CENARIO;
let falhas = 0;
const conferir = (c,m,d)=>{ c?console.log(`  \x1b[32mok\x1b[0m ${m}`):(falhas++,console.log(`  \x1b[31m!!\x1b[0m ${m}${d?'\n       '+d:''}`)); };
(async () => {
  const cdp = await conectar();
  await cdp.enviar('Network.enable');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await irPara(cdp,'http://localhost:4173/');
  await avaliar(cdp, CEN);
  await irPara(cdp,'http://localhost:4173/');
  await esperar(2200);

  const r = await avaliar(cdp, `
    const el=document.querySelector('.bg-pattern');
    if(!el) return {semElemento:true};
    const cs=getComputedStyle(el);
    const req=performance.getEntriesByType('resource').filter(e=>e.name.includes('/assets/arte/'));
    return {
      mascara:cs.maskImage!=='none'?cs.maskImage.slice(0,70):(cs.webkitMaskImage||'none').slice(0,70),
      tamanho:cs.maskSize||cs.webkitMaskSize, repete:cs.maskRepeat||cs.webkitMaskRepeat,
      cor:cs.backgroundColor, z:cs.zIndex,
      baixou:req.length, bytes:Math.round(req.reduce((s,e)=>s+(e.transferSize||0),0)/1024),
      falhou:req.filter(e=>e.transferSize===0&&e.decodedBodySize===0).length};`);
  if (r.semElemento) { console.error('  não achei .bg-pattern'); process.exit(1); }
  console.log(`  máscara: ${r.mascara}\n  ${r.tamanho} · ${r.repete} · z ${r.z} · ${r.baixou} arquivo(s), ${r.bytes} KB`);
  conferir(/assets\/arte\/padrao-ondas\.svg/.test(r.mascara), 'a máscara aponta pro arquivo');
  conferir(r.baixou > 0 && r.falhou === 0, 'e o arquivo chegou');
  conferir(r.tamanho.startsWith('260px'), `o padrão mantém a escala (${r.tamanho})`);
  conferir(r.repete === 'repeat', `e continua repetindo (${r.repete})`);

  /* fotografa o fundo em dois temas que o usam */
  for (const tema of ['onda','sakura']) {
    await avaliar(cdp, `
      const d=JSON.parse(localStorage.getItem('financas-data')); d.tema='${tema}';
      localStorage.setItem('financas-data',JSON.stringify(d)); return 1;`);
    await irPara(cdp,'http://localhost:4173/');
    await esperar(1800);
    const foto = await cdp.enviar('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(`${PASTA_FOTOS}/fundo-${tema}.png`, Buffer.from(foto.data,'base64'));
    /* o padrão pinta mesmo? amostra pixels do canto, fora de qualquer card */
    const pinta = await avaliar(cdp, `
      const el=document.querySelector('.bg-pattern');
      const b=el.getBoundingClientRect();
      return {largura:Math.round(b.width),altura:Math.round(b.height),visivel:getComputedStyle(el).display!=='none'};`);
    conferir(pinta.visivel && pinta.largura>300, `tema ${tema}: o fundo cobre a tela (${pinta.largura}×${pinta.altura})`);
  }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas===0?'\x1b[32mO fundo continua no lugar.\x1b[0m':`\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar(); process.exit(falhas===0?0:1);
})().catch(e=>{console.error('falhou:',e.message);process.exit(1);});
