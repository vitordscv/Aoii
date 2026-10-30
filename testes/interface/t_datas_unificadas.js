'use strict';
const {conectar,avaliar,esperar,tirarFoto}=require('./cdp');
const {limparAparelho,abrirApp,irParaTela,conferir,encerrar}=require('./ajuda');
const {PASTA_FOTOS}=require('./fotos');
(async()=>{
  const cdp=await conectar();await limparAparelho(cdp);await abrirApp(cdp);
  async function abrir(campo){
    const r=await avaliar(cdp,`
      const input=document.querySelector('${campo}'),btn=input?.nextElementSibling;
      if(!btn?.classList.contains('date-trigger')) return false;
      btn.scrollIntoView({block:'center'});btn.focus({preventScroll:true});btn.click();
      return input.hidden&&!document.getElementById('calendar-dialog').hidden;`);
    conferir(r,'campo abre calendário integrado: '+campo);
  }
  async function escolher(){
    return avaliar(cdp,`
      let ano=document.querySelector('[data-date-year]');ano.value='2027';ano.dispatchEvent(new Event('change',{bubbles:true}));
      const mes=document.querySelector('[data-date-month]');mes.value='11';mes.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('[data-date-day="2027-12-28"]').click();
      return !document.getElementById('calendar-dialog').hidden;`);
  }
  async function confirmar(campo){
    await avaliar(cdp,`document.querySelector('[data-date-confirm]').click();return 1;`);await esperar(220);
    const r=await avaliar(cdp,`return {valor:document.querySelector('${campo}')?.value,fechado:document.getElementById('calendar-dialog').hidden};`);
    conferir(r.valor==='2027-12-28'&&r.fechado,'confirma data ISO sem deslocar dia: '+campo,JSON.stringify(r));
  }
  await abrir('#hero-date-input');
  const antes=await avaliar(cdp,`return document.getElementById('hero-date-input').value;`);
  conferir(await escolher(),'tocar no dia mantém calendário aberto');
  await avaliar(cdp,`document.querySelector('[data-date-cancel]').click();return 1;`);
  conferir(await avaliar(cdp,`return document.getElementById('hero-date-input').value;`)===antes,'cancelar preserva projeção');
  await abrir('#hero-date-input');await escolher();
  for(const [largura,altura] of [[320,600],[390,500],[768,900],[1440,900]]){
    await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:largura,height:altura,deviceScaleFactor:2,mobile:largura<700});await esperar(100);
    const r=await avaliar(cdp,`
      const d=document.getElementById('calendar-dialog');d.scrollTop=400;
      const b=d.getBoundingClientRect(),close=document.getElementById('calendar-close'),c=close.getBoundingClientRect();
      return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,vw:innerWidth,vh:innerHeight,
        hit:document.elementFromPoint(c.left+c.width/2,c.top+c.height/2)===close,
        fonte:parseFloat(getComputedStyle(document.querySelector('[data-date-year]')).fontSize)};`);
    conferir(r.left>=0&&r.right<=r.vw&&r.top>=0&&r.bottom<=r.vh&&r.hit&&r.fonte>=16,
      `calendário e fechar acessíveis em ${largura}×${altura}`,JSON.stringify(r));
  }
  await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await avaliar(cdp,`document.getElementById('calendar-dialog').scrollTop=0;return 1;`);
  await tirarFoto(cdp,PASTA_FOTOS+'/design-data-390.png');
  await confirmar('#hero-date-input');
  for(const [tela,aba,campo] of [
    ['entradas','tab-entradas-extras','#extras-data'],
    ['entradas','tab-entradas-compras','#purchases-data'],
    ['economias','tab-economias-metas','#metas-data'],
    ['entradas','tab-entradas-extras','#extras-list input[type=date]'],
    ['entradas','tab-entradas-dividas','#dividas-list input[type=date]']]){
    await irParaTela(cdp,tela,aba);await abrir(campo);await escolher();await confirmar(campo);
  }
  await irParaTela(cdp,'resumo');
  await avaliar(cdp,`document.getElementById('gasto-fab').click();return 1;`);await esperar(350);
  await abrir('#gasto-data');await escolher();
  await cdp.enviar('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  await cdp.enviar('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
  const escape=await avaliar(cdp,`return {cal:document.getElementById('calendar-dialog').hidden,sheet:document.getElementById('gasto-sheet').style.display,foco:document.activeElement.classList.contains('date-trigger')};`);
  conferir(escape.cal&&escape.sheet==='block'&&escape.foco,'Escape fecha só o calendário e devolve foco ao campo',JSON.stringify(escape));
  await abrir('#gasto-data');await escolher();await confirmar('#gasto-data');
  await avaliar(cdp,`document.getElementById('gasto-sheet-cancel').click();return 1;`);await esperar(350);
  await irParaTela(cdp,'economias','tab-economias-investimentos');
  await avaliar(cdp,`document.querySelector('#inv-list [data-inv-id]').click();return 1;`);await esperar(350);
  await abrir('#inv-div-data');await escolher();await confirmar('#inv-div-data');
  const cobertura=await avaliar(cdp,`
    return [...document.querySelectorAll('input[type=date]')].every(i=>i.hidden&&i.nextElementSibling?.classList.contains('date-trigger'));`);
  conferir(cobertura,'todos os campos de data, inclusive dinâmicos, usam o novo seletor');
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
