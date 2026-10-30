'use strict';
const {conectar,avaliar,esperar,tirarFoto}=require('./cdp');
const {limparAparelho,abrirApp,conferir,encerrar}=require('./ajuda');
const {PASTA_FOTOS}=require('./fotos');
(async()=>{
  const cdp=await conectar();
  await cdp.enviar('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await limparAparelho(cdp);await abrirApp(cdp);
  const abertura=await avaliar(cdp,`
    document.getElementById('hero-date-input').nextElementSibling.click();
    const d=document.getElementById('calendar-dialog'),ano=document.querySelector('[data-date-year]');
    const atual=new Date().getFullYear();
    return {tag:ano.tagName,atual:[...ano.options].some(o=>o.value===String(atual)),
      futuro:[...ano.options].some(o=>o.value===String(atual+10)),passado:[...ano.options].some(o=>o.value===String(atual-1)),
      digitacao:!!d.querySelector('input:not([type=date])'),anima:d.getAnimations().length,
      duracao:d.getAnimations()[0]?.effect.getTiming().duration};`);
  conferir(abertura.tag==='SELECT'&&abertura.atual&&abertura.futuro&&!abertura.passado&&!abertura.digitacao,
    'projeção oferece ano atual e próximos, sem passado nem digitação',JSON.stringify(abertura));
  conferir(abertura.anima===1&&abertura.duracao<=200,'abertura com transição curta e única',JSON.stringify(abertura));
  const antes=await avaliar(cdp,`return document.getElementById('hero-date-input').value;`);
  const ano=await avaliar(cdp,`
    const ano=document.querySelector('[data-date-year]');ano.value='2032';ano.dispatchEvent(new Event('change',{bubbles:true}));
    const mes=document.querySelector('[data-date-month]');mes.value='1';mes.dispatchEvent(new Event('change',{bubbles:true}));
    return {ano:document.querySelector('[data-date-year]').value,dias:document.querySelectorAll('[data-date-day]').length,
      movimento:document.querySelector('.date-calendar .skip-cal-grid').getAnimations().length,
      original:document.getElementById('hero-date-input').value};`);
  conferir(ano.ano==='2032'&&ano.dias===29&&ano.original===antes,'trocar ano preserva o rascunho e respeita fevereiro bissexto',JSON.stringify(ano));
  conferir(ano.movimento===1,'troca de mês tem transição sem acumular animações');
  const selecao=await avaliar(cdp,`
    document.querySelector('[data-date-day="2032-02-29"]').click();
    const btn=document.querySelector('[data-date-day="2032-02-29"]');
    return {selecionado:btn.getAttribute('aria-pressed'),anima:btn.getAnimations().length};`);
  conferir(selecao.selecionado==='true'&&selecao.anima===1,'dia selecionado recebe retorno visual imediato',JSON.stringify(selecao));
  await esperar(220);await tirarFoto(cdp,PASTA_FOTOS+'/ano-rolavel-390.png');
  await avaliar(cdp,`document.querySelector('[data-date-confirm]').click();return 1;`);await esperar(200);
  conferir(await avaliar(cdp,`return document.getElementById('hero-date-input').value;`)==='2032-02-29','confirma a data escolhida sem depender do fim da animação');
  const abas=await avaliar(cdp,`
    for(let i=0;i<12;i++) document.querySelector('[data-target="'+(i%2?'view-entradas':'view-diario')+'"]').click();
    const pane=document.getElementById('view-entradas');
    return {visivel:getComputedStyle(pane).display!=='none',anima:pane.getAnimations().length};`);
  conferir(abas.visivel&&abas.anima===1,'trocas rápidas de tela terminam na aba certa e não empilham animações',JSON.stringify(abas));
  await cdp.enviar('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await esperar(220);
  const reduzido=await avaliar(cdp,`
    document.querySelector('[data-target="view-resumo"]').click();
    document.getElementById('hero-date-input').nextElementSibling.click();
    document.querySelector('[data-date-next]').click();
    const dia=document.querySelector('[data-date-day]');dia.click();
    return {tela:document.getElementById('view-resumo').getAnimations().length,
      dialog:document.getElementById('calendar-dialog').getAnimations().length,
      mes:document.querySelector('.date-calendar .skip-cal-grid').getAnimations().length,
      dia:document.querySelector('[data-date-day]').getAnimations().length};`);
  conferir(Object.values(reduzido).every(n=>n===0),'movimento reduzido desativa as novas animações sem recarregar',JSON.stringify(reduzido));
  await avaliar(cdp,`
    document.getElementById('calendar-close').click();
    const theme=document.getElementById('theme-select');theme.value='matcha';theme.dispatchEvent(new Event('change'));
    document.querySelector('[data-target="view-economias"]').click();return 1;`);
  for(const largura of [390,768,1440]){
    await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:largura,height:900,deviceScaleFactor:2,mobile:largura<700});await esperar(150);
    const nav=await avaliar(cdp,`
      const barra=document.getElementById('bottom-nav'),btn=barra.querySelector('.active');
      const b=barra.getBoundingClientRect(),a=btn.getBoundingClientRect();
      return {direita:b.right-a.right,topo:a.top-b.top,fundo:b.bottom-a.bottom,raio:parseFloat(getComputedStyle(btn).borderRadius)};`);
    conferir(nav.direita>=8&&nav.topo>=8&&nav.fundo>=8&&nav.raio===14,
      `seleção da ponta tem recuo e cantos coerentes em ${largura}px`,JSON.stringify(nav));
    if(largura===1440) await tirarFoto(cdp,PASTA_FOTOS+'/nav-matcha-cantos-1440.png');
  }
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
