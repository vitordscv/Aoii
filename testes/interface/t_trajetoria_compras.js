'use strict';
const {conectar,avaliar,esperar}=require('./cdp');
const {limparAparelho,abrirApp,irParaTela,conferir,encerrar}=require('./ajuda');

(async()=>{
  const cdp=await conectar();
  await limparAparelho(cdp);await abrirApp(cdp,{largura:1440,altura:900});
  await irParaTela(cdp,'fixos','tab-fixos-trajetoria');
  const desktop=await avaliar(cdp,`
    const svg=document.querySelector('#chart-card svg'),dot=svg.querySelector('circle[data-tt-details]');
    const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
    dot.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+Number(dot.getAttribute('cx'))/vb.width*r.width,clientY:r.top+Number(dot.getAttribute('cy'))/vb.height*r.height}));
    const detalhe=JSON.parse(dot.getAttribute('data-tt-details'));
    const tip=document.querySelector('#chart-card .chart-tooltip');
    return {achou:!!dot,compras:detalhe.compras.map(c=>c.nome),total:detalhe.total,
      visivel:tip.classList.contains('visible'),texto:tip.textContent,acessivel:dot.getAttribute('role')==='button'&&dot.tabIndex===0};`);
  conferir(desktop.achou&&desktop.compras.includes('Cadeira ergonômica Herman Miller Aeron')&&desktop.total===9800,
    'o ponto mantém as compras planejadas e o impacto daquele mês',JSON.stringify(desktop));
  conferir(desktop.visivel&&desktop.texto.includes('Cadeira ergonômica')&&desktop.texto.includes('Impacto no saldo')&&desktop.acessivel,
    'hover no computador mostra o detalhe e o ponto é acessível',JSON.stringify(desktop));
  await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await esperar(150);
  const mobile=await avaliar(cdp,`
    const svg=document.querySelector('#chart-card svg'),dot=svg.querySelector('circle[data-tt-details]');
    const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
    dot.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:r.left+Number(dot.getAttribute('cx'))/vb.width*r.width,clientY:r.top+Number(dot.getAttribute('cy'))/vb.height*r.height}));
    const tip=document.querySelector('#chart-card .chart-tooltip');
    return {visivel:tip.classList.contains('visible'),texto:tip.textContent,largura:tip.getBoundingClientRect().width,limite:innerWidth*.72};`);
  conferir(mobile.visivel&&mobile.texto.includes('Cadeira ergonômica')&&mobile.largura<=mobile.limite+1,
    'toque no celular mantém o detalhe dentro da tela',JSON.stringify(mobile));
  const teclado=await avaliar(cdp,`
    const dot=document.querySelector('#chart-card circle[data-tt-details]');dot.focus();
    dot.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter'}));
    return document.querySelector('#chart-card .chart-tooltip').classList.contains('visible');`);
  conferir(teclado,'Enter também abre o detalhe do ponto');
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
