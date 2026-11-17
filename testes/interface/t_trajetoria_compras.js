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

  /* Perto da borda do gráfico o balão encolhia e o valor da compra vazava
     para fora dele (visto no site, com um nome comprido em dezembro). Aqui
     cada ponto com compra é aberto, em todos os tamanhos, e nada do balão
     pode passar da caixa dele nem do cartão do gráfico. */
  for(const [largura,altura,celular] of [[1440,900,false],[820,900,false],[390,844,true]]){
    await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:largura,height:altura,deviceScaleFactor:2,mobile:celular});await esperar(200);
    const bordas=await avaliar(cdp,`
      const card=document.querySelector('#chart-card'),svg=card.querySelector('svg');
      const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,c=card.getBoundingClientRect();
      const tip=card.querySelector('.chart-tooltip'),ruins=[];
      for(const dot of svg.querySelectorAll('circle[data-tt-details]')){
        dot.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+Number(dot.getAttribute('cx'))/vb.width*r.width,clientY:r.top+Number(dot.getAttribute('cy'))/vb.height*r.height}));
        const t=tip.getBoundingClientRect();
        if(t.left<c.left-1||t.right>c.right+1) ruins.push('balão fora do cartão em '+dot.getAttribute('data-tt'));
        for(const el of tip.querySelectorAll('span,b')){
          const e=el.getBoundingClientRect();
          if(e.width&&(e.left<t.left-1||e.right>t.right+1)) ruins.push('"'+el.textContent+'" fora do balão em '+dot.getAttribute('data-tt'));
        }
      }
      return ruins;`);
    conferir(bordas.length===0,'em '+largura+'px, texto e valor ficam dentro do balão e o balão dentro do gráfico',JSON.stringify(bordas));
  }
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
