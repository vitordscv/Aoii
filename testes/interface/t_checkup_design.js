'use strict';
const fs=require('fs'),path=require('path');
const {conectar,avaliar,esperar,tirarFoto}=require('./cdp');
const {limparAparelho,abrirApp,irParaTela,conferir,encerrar}=require('./ajuda');
const {PASTA_FOTOS}=require('./fotos');
(async()=>{
  const cdp=await conectar();
  await cdp.enviar('Page.addScriptToEvaluateOnNewDocument',{source:`window.designErrors=[];window.addEventListener('error',e=>window.designErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.designErrors.push(String(e.reason)));`});
  await limparAparelho(cdp);await abrirApp(cdp);
  const report=[];
  async function medir(nome,largura){
    const r=await avaliar(cdp,`
      const visivel=e=>{const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&!e.closest('[hidden]');};
      const pequenos=[...document.querySelectorAll('button,input,select,textarea')].filter(visivel)
        .filter(e=>e.getBoundingClientRect().height<32).map(e=>({id:e.id,classe:e.className,h:Math.round(e.getBoundingClientRect().height)}));
      const cortados=[...document.querySelectorAll('input,select,textarea,.date-trigger,.section-title,.hero-number-valor')].filter(visivel)
        .filter(e=>{const b=e.getBoundingClientRect();return b.left<0||b.right>innerWidth+1;}).map(e=>e.id||e.className);
      const topbar=document.querySelector('.topbar').getBoundingClientRect();
      const title=document.querySelector('.topbar-title').getBoundingClientRect();
      return {pequenos,cortados,topbar:Math.round(topbar.width),tituloCentro:(title.left+title.right)/2,pagina:document.documentElement.scrollWidth,vw:document.documentElement.clientWidth};`);
    report.push({nome,largura,...r});
    conferir(r.cortados.length===0,`${nome} sem campos fora da tela em ${largura}px`,JSON.stringify(r.cortados));
    if(nome==='resumo') conferir(Math.abs(r.tituloCentro-r.vw/2)<3,'nome Aoii centralizado',JSON.stringify(r));
    if(largura===768) conferir(r.topbar>=r.vw-42,'topbar aproveita a largura do tablet',String(r.topbar));
  }
  for(const largura of [320,390,768,1440]){
    await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:largura,height:900,deviceScaleFactor:2,mobile:largura<700});
    for(const tela of ['resumo','entradas','fixos','diario','economias']){
      await irParaTela(cdp,tela);await medir(tela,largura);
      if([390,1440].includes(largura)) await tirarFoto(cdp,PASTA_FOTOS+`/checkup-${tela}-${largura}.png`);
      const abas=await avaliar(cdp,`return [...document.querySelectorAll('#view-${tela} .view-tabs [role=tab]')].map(e=>e.id);`);
      for(const id of abas){await avaliar(cdp,`document.getElementById('${id}').click();return 1;`);await esperar(100);await medir(id,largura);}
    }
  }
  await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await avaliar(cdp,`document.getElementById('topbar-settings-btn').click();return 1;`);await esperar(300);
  for(const pane of ['renda','cartoes','categorias','preferencias','dados','ia','banco','zona']){
    await avaliar(cdp,`document.getElementById('settings-tab-${pane}').click();return 1;`);await esperar(100);
    await medir('settings-'+pane,390);
    await tirarFoto(cdp,PASTA_FOTOS+`/checkup-settings-${pane}-390.png`);
  }
  await avaliar(cdp,`document.getElementById('settings-close-btn').click();return 1;`);await esperar(300);
  for(const [btn,sheet] of [['topbar-calc-btn','calc-sheet'],['topbar-fx-btn','fx-sheet']]){
    const r=await avaliar(cdp,`
      document.getElementById('${btn}').click();await new Promise(r=>setTimeout(r,300));
      const s=document.getElementById('${sheet}'),b=s.getBoundingClientRect();
      return {visivel:b.width>0&&b.height>0,left:b.left,right:b.right,bottom:b.bottom,vw:innerWidth,vh:innerHeight};`);
    conferir(r.visivel&&r.left>=0&&r.right<=r.vw&&r.bottom<=r.vh+1,`${sheet} cabe no celular`,JSON.stringify(r));
    await tirarFoto(cdp,PASTA_FOTOS+`/checkup-${sheet}-390.png`);
    await cdp.enviar('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await cdp.enviar('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await esperar(300);
  }
  const erros=await avaliar(cdp,`return window.designErrors;`);
  conferir(!erros.length,'revisão das telas sem erros de JavaScript',JSON.stringify(erros));
  await limparAparelho(cdp);await abrirApp(cdp,{cenario:false});
  for(const tela of ['resumo','entradas','fixos','diario','economias']){await irParaTela(cdp,tela);await medir('vazio-'+tela,390);}
  fs.writeFileSync(path.join(PASTA_FOTOS,'checkup.json'),JSON.stringify(report,null,2));
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
