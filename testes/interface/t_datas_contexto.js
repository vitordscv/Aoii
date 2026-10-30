'use strict';
const {conectar,avaliar,esperar}=require('./cdp');
const {limparAparelho,abrirApp,irParaTela,conferir,encerrar}=require('./ajuda');
(async()=>{
  const cdp=await conectar();await limparAparelho(cdp);await abrirApp(cdp);
  async function abrir(campo){await avaliar(cdp,`document.querySelector('${campo}').nextElementSibling.click();return 1;`);}
  async function fechar(){await avaliar(cdp,`document.getElementById('calendar-close').click();return 1;`);}
  for(const [tela,aba,campo] of [
    ['resumo',null,'#hero-date-input'],['entradas','tab-entradas-compras','#purchases-data'],
    ['entradas','tab-entradas-compras','#purchases-list input[type=date]'],['economias','tab-economias-metas','#metas-data']]){
    await irParaTela(cdp,tela,aba);await abrir(campo);
    const r=await avaliar(cdp,`
      const hoje=new Date(),ano=hoje.getFullYear();
      const anos=[...document.querySelector('[data-date-year]').options].map(o=>Number(o.value));
      document.querySelector('[data-date-today]').click();
      const iso=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-'+String(hoje.getDate()).padStart(2,'0');
      const dias=[...document.querySelectorAll('[data-date-day]')];
      const bloqueados=dias.filter(d=>d.dataset.dateDay<iso).every(d=>d.disabled);
      const meses=[...document.querySelector('[data-date-month]').options];
      return {anos:anos.every(a=>a>=ano),atual:anos.includes(ano),prev:document.querySelector('[data-date-prev]').disabled,
        bloqueados,meses:meses.filter(m=>Number(m.value)<hoje.getMonth()).every(m=>m.disabled)};`);
    conferir(r.anos&&r.atual&&r.prev&&r.bloqueados&&r.meses,'planejamento bloqueia anos, meses e dias passados: '+campo,JSON.stringify(r));
    await fechar();
  }
  await irParaTela(cdp,'resumo');await abrir('#hero-date-input');
  const atalhos=await avaliar(cdp,`
    const t=new Date(),fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    document.querySelector('[data-date-end="mes"]').click();
    const mes=document.querySelector('.skip-cal-day.is-selected')?.dataset.dateDay;
    document.querySelector('[data-date-end="ano"]').click();
    const ano=document.querySelector('.skip-cal-day.is-selected')?.dataset.dateDay;
    return {mes,ano,mesEsperado:fmt(new Date(t.getFullYear(),t.getMonth()+1,0)),anoEsperado:t.getFullYear()+'-12-31'};`);
  conferir(atalhos.mes===atalhos.mesEsperado&&atalhos.ano===atalhos.anoEsperado,'atalhos usam o fim do mês e do ano atuais',JSON.stringify(atalhos));
  await fechar();
  await avaliar(cdp,`document.getElementById('hero-date-input').value='2020-01-01';return 1;`);
  await abrir('#hero-date-input');
  const antiga=await avaliar(cdp,`
    return {ano:Number(document.querySelector('[data-date-year]').value),atual:new Date().getFullYear(),
      confirmar:document.querySelector('[data-date-confirm]').disabled,
      aviso:document.querySelector('.skip-cal-summary').textContent};`);
  conferir(antiga.ano===antiga.atual&&antiga.confirmar&&antiga.aviso.length>10,'data salva vencida abre no presente e pede reagendamento',JSON.stringify(antiga));
  await fechar();
  conferir(await avaliar(cdp,`return document.getElementById('hero-date-input').value;`)==='2020-01-01','cancelar não reescreve a data antiga');
  for(const [aba,campo] of [['tab-entradas-extras','#extras-data'],['tab-entradas-dividas','#dividas-list input[type=date]']]){
    await irParaTela(cdp,'entradas',aba);await abrir(campo);
    const passado=await avaliar(cdp,`return [...document.querySelector('[data-date-year]').options].some(o=>Number(o.value)<new Date().getFullYear());`);
    conferir(passado,'vencimentos antigos continuam disponíveis: '+campo);await fechar();
  }
  await irParaTela(cdp,'resumo');await avaliar(cdp,`document.getElementById('gasto-fab').click();return 1;`);await esperar(300);
  await abrir('#gasto-data');
  conferir(await avaliar(cdp,`return [...document.querySelector('[data-date-year]').options].some(o=>Number(o.value)<new Date().getFullYear());`),'gasto realizado mantém acesso ao histórico');
  await fechar();await avaliar(cdp,`document.getElementById('gasto-sheet-cancel').click();return 1;`);await esperar(300);
  await irParaTela(cdp,'entradas','tab-entradas-compras');
  await avaliar(cdp,`document.querySelector('#purchases-list [data-action="toggle-feito"]').click();return 1;`);await esperar(300);
  const parcelada=await avaliar(cdp,`
    const btn=document.querySelector('#purchases-list [data-action="toggle-feito"]');
    return {concluida:btn.checked,bloqueada:btn.disabled,aviso:document.querySelector('#purchases-list .item-nota')?.textContent};`);
  conferir(parcelada.concluida&&parcelada.bloqueada&&parcelada.aviso?.length>20,'compra já parcelada explica por que não pode ser reaberta pela caixinha',JSON.stringify(parcelada));
  await avaliar(cdp,`
    const dados=JSON.parse(localStorage.getItem('financas-data'));dados.dataAlvo='2020-01-01';
    localStorage.setItem('financas-data',JSON.stringify(dados));return 1;`);
  await cdp.enviar('Page.reload');await esperar(1800);await irParaTela(cdp,'resumo');
  const vencida=await avaliar(cdp,`return {aviso:!!document.querySelector('.hero-date-notice'),valor:document.getElementById('hero-date-input').value};`);
  conferir(vencida.aviso&&vencida.valor==='2020-01-01','projeção vencida recebe aviso sem reescrever o registro',JSON.stringify(vencida));
  cdp.fechar();encerrar();
})().catch(e=>{console.error(e);process.exit(1);});
