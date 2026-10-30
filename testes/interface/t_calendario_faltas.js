'use strict';
const {conectar,avaliar,esperar,tirarFoto}=require('./cdp');
const {limparAparelho,abrirApp,conferir,encerrar}=require('./ajuda');
const {PASTA_FOTOS}=require('./fotos');
(async()=>{
  const cdp=await conectar();await limparAparelho(cdp);await abrirApp(cdp,{largura:390,altura:844});
  await avaliar(cdp,`document.getElementById('topbar-settings-btn').click();document.getElementById('settings-tab-renda').click();return 1;`);
  await esperar(350);
  await avaliar(cdp,`document.querySelector('#cfg-tipo-renda [data-tipo="diaria"]').click();return 1;`);
  await esperar(250);
  async function abrir(){await avaliar(cdp,`document.getElementById('skip-calendar-open').click();return 1;`);}
  const fechado=await avaliar(cdp,`return document.getElementById('skip-calendar').hidden;`);
  conferir(fechado,'calendário de faltas começa recolhido');
  await abrir();
  async function mes(alvo){
    return avaliar(cdp,`
      for(let i=0;i<36;i++){
        if(document.querySelector('[data-skip-date="${alvo}"]')) return true;
        const atual=document.querySelector('[data-skip-date]').dataset.skipDate;
        document.querySelector('[data-skip-month="'+(atual<'${alvo}'?'1':'-1')+'"]').click();
      }return false;`);
  }
  async function clicar(dia){await avaliar(cdp,`document.querySelector('[data-skip-date="${dia}"]').click();return 1;`);}
  async function total(){return avaliar(cdp,`return document.querySelectorAll('#skip-days-list .skip-tag').length;`);}
  await mes('2026-12-22');await clicar('2026-12-22');await clicar('2026-12-31');
  const periodo=await avaliar(cdp,`return {n:document.querySelectorAll('.skip-cal-day.is-selected').length,
    aberto:document.getElementById('settings-panel').style.display==='block',
    nativo:document.querySelectorAll('#skip-calendar input[type=date]').length};`);
  conferir(periodo.n===10&&periodo.aberto&&periodo.nativo===0,'seleciona dez dias sem fechar nem usar calendário nativo',JSON.stringify(periodo));
  conferir(await total()===0,'seleção é rascunho até confirmar');
  await avaliar(cdp,`document.getElementById('skip-calendar').scrollIntoView({block:'center'});return 1;`);
  await tirarFoto(cdp,PASTA_FOTOS+'/faltas-periodo-390.png');
  await avaliar(cdp,`document.getElementById('skip-day-add').click();return 1;`);await esperar(300);
  conferir(await total()===10,'confirma dez dias');
  const salvoFechou=await avaliar(cdp,`return document.getElementById('calendar-dialog').hidden&&!document.getElementById('settings-panel').inert;`);
  conferir(salvoFechou,'confirmar fecha calendário e devolve Configurações');
  await abrir();
  await mes('2026-12-29');await clicar('2026-12-29');await mes('2027-01-04');await clicar('2027-01-04');
  const virada=await avaliar(cdp,`return document.querySelector('.skip-cal-summary').textContent;`);
  conferir(virada.includes('7')&&virada.includes('4'),'seleção atravessa mês e ano sem duplicar faltas',virada);
  await avaliar(cdp,`document.getElementById('skip-day-add').click();return 1;`);await esperar(300);
  conferir(await total()===14,'sobreposição preserva dias já marcados');
  await abrir();
  await mes('2027-01-11');await clicar('2027-01-11');await clicar('2027-01-17');
  await avaliar(cdp,`document.getElementById('skip-day-add').click();return 1;`);await esperar(300);
  conferir(await total()===21,'adiciona outra semana separada');
  await abrir();
  await avaliar(cdp,`document.querySelector('[data-skip-mode="dias"]').click();return 1;`);
  await clicar('2027-01-20');await clicar('2027-01-22');await clicar('2027-01-20');
  const separados=await avaliar(cdp,`return document.querySelectorAll('.skip-cal-day.is-selected').length;`);
  conferir(separados===1,'dias separados podem ser selecionados e desmarcados');
  await avaliar(cdp,`document.querySelector('[data-skip-clear]').click();return 1;`);
  conferir(await total()===21,'limpar rascunho preserva faltas salvas');
  for(const largura of [320,390,768,1440]){
    await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:largura,height:900,deviceScaleFactor:2,mobile:largura<700});
    const layout=await avaliar(cdp,`
      const cal=document.getElementById('skip-calendar');cal.scrollIntoView({block:'center'});
      const b=cal.getBoundingClientRect();
      const dias=[...cal.querySelectorAll('[data-skip-date]')].map(d=>d.getBoundingClientRect());
      return {width:b.width,overflow:cal.scrollWidth>cal.clientWidth+1,
        diasDentro:dias.every(d=>d.left>=b.left&&d.right<=b.right),n:dias.length};`);
    conferir(layout.width>200&&!layout.overflow&&layout.diasDentro&&layout.n===31,`calendário visível e cabe em ${largura}px`,JSON.stringify(layout));
    if([390,768].includes(largura)) await tirarFoto(cdp,PASTA_FOTOS+`/faltas-calendario-${largura}.png`);
  }
  await avaliar(cdp,`document.getElementById('calendar-close').click();document.getElementById('skip-saved-days').open=true;document.querySelector('#skip-days-list button').click();return 1;`);await esperar(300);
  conferir(await total()===20,'remove um dia individual de um período confirmado');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:2,mobile:true});
  await abrir();
  const temas=await avaliar(cdp,`
    const falhas=[];
    for(const tema of ['onda','noite','sakura','matcha','poupa','grafite','roxo']){
      const t=document.getElementById('theme-select');t.value=tema;t.dispatchEvent(new Event('change'));
      for(const idioma of ['pt','en','es','fr','it']){
        const l=document.getElementById('cfg-idioma');l.value=idioma;l.dispatchEvent(new Event('change'));
        await new Promise(r=>setTimeout(r,60));
        const cal=document.getElementById('skip-calendar');
        if(cal.scrollWidth>cal.clientWidth+1||!cal.querySelector('[data-skip-mode="dias"]').textContent.trim()) falhas.push({tema,idioma});
      }
    }return falhas;`);
  conferir(temas.length===0,'calendário cabe nos sete temas e cinco idiomas',JSON.stringify(temas));
  await cdp.enviar('Page.reload');await esperar(1800);
  await avaliar(cdp,`document.getElementById('topbar-settings-btn').click();document.getElementById('settings-tab-renda').click();return 1;`);
  await esperar(300);
  conferir(await total()===20,'faltas confirmadas permanecem após recarregar');
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
