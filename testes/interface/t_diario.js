/* O Diário abre no mês corrente e filtra entrada/saída.
   Dois casos que importam: com lançamento no mês de hoje, e SEM — nesse, abrir
   num mês vazio seria pior do que abrir em "todos". */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const CEN = require('./cenario').CENARIO;

let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

/* o Diario pagina de 10 em 10: sem abrir tudo, a contagem mede a paginacao
   e nao o filtro */
const TODOS = `
  for(let i=0;i<40;i++){
    const b=document.querySelector('[data-action="diario-mais"]');
    if(!b) break;
    b.click(); await new Promise(r=>setTimeout(r,120));
  }
`;

const abrirDiario = cdp => avaliar(cdp, `
  document.querySelector('.bn-item[data-target="view-diario"]').click();
  await new Promise(r=>setTimeout(r,700));
  return 1;`);

const estado = cdp => avaliar(cdp, TODOS + `
  const mes=document.getElementById('diario-mes-filtro');
  const tipo=document.getElementById('diario-tipo-filtro');
  const itens=[...document.querySelectorAll('#transacoes-list .swipe-item')];
  return {
    mes:mes.value, mesRotulo:(mes.selectedOptions[0]||{}).textContent||'',
    tipo:tipo?tipo.value:null,
    opcoesTipo:tipo?[...tipo.options].map(o=>o.textContent):[],
    n:itens.length,
    entradas:itens.filter(i=>/entrada/i.test(i.querySelector('.item-cartao-tag').textContent)).length,
    vazio:/nadaEncontrado|Nada encontrado|nenhum/i.test(document.getElementById('transacoes-list').textContent),
    datas:itens.slice(0,4).map(i=>(i.querySelector('.item-cartao-tag').textContent.match(/\\d{2}\\/\\d{2}\\/\\d{4}/)||[''])[0]),
  };`);

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await irPara(cdp, 'http://localhost:4173/');
  await avaliar(cdp, CEN);
  /* o cenario nao tem receita nenhuma; sem isso o filtro nao teria o que separar */
  await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    d.transacoes.push({id:'rec-1',tipo:'receita',nome:'Venda de um movel',valor:450,
      data:'2026-09-04',categoria:'Outros',metodo:'pix'});
    d.transacoes.push({id:'rec-2',tipo:'receita',nome:'Reembolso do plano',valor:120,
      data:'2026-09-09',categoria:'Outros',metodo:'pix'});
    localStorage.setItem('financas-data',JSON.stringify(d));
    return 1;`);
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(1700);
  await abrirDiario(cdp);

  console.log('\n  \x1b[1mabre no mês em que estou\x1b[0m');
  let e = await estado(cdp);
  console.log(`     mês: "${e.mesRotulo}" (${e.mes}) · ${e.n} lançamentos · tipo: ${e.tipo}`);
  conferir(e.mes === '2026-09', `abre em setembro de 2026, não em "todos" (${e.mes})`);
  conferir(!e.vazio && e.n > 0, `e a lista tem ${e.n} lançamentos`);
  conferir(e.datas.every(d => !d || d.endsWith('/09/2026')), 'todos do mês corrente',
    `datas: ${e.datas.join(', ')}`);

  console.log('\n  \x1b[1mo seletor de entrada/saída\x1b[0m');
  conferir(e.opcoesTipo.length === 3, `tem três opções: ${e.opcoesTipo.join(' / ')}`);
  const doMes = e.n, entradasDoMes = e.entradas;

  const soEntradas = await avaliar(cdp, `
    const s=document.getElementById('diario-tipo-filtro');
    s.value='entrada'; s.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));` + TODOS + `
    const itens=[...document.querySelectorAll('#transacoes-list .swipe-item')];
    return {n:itens.length,
      todasEntrada:itens.every(i=>/entrada/i.test(i.querySelector('.item-cartao-tag').textContent)),
      sinalMais:itens.every(i=>i.querySelector('.item-valor').textContent.trim().startsWith('+'))};`);
  conferir(soEntradas.n === entradasDoMes && soEntradas.n > 0,
    `"só entradas" mostra ${soEntradas.n} de ${doMes}`);
  conferir(soEntradas.todasEntrada, 'e nenhuma saída se infiltra');
  conferir(soEntradas.sinalMais, 'todas com o sinal de +');

  const soSaidas = await avaliar(cdp, `
    const s=document.getElementById('diario-tipo-filtro');
    s.value='saida'; s.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));` + TODOS + `
    const itens=[...document.querySelectorAll('#transacoes-list .swipe-item')];
    return {n:itens.length,
      nenhumaEntrada:itens.every(i=>!/entrada/i.test(i.querySelector('.item-cartao-tag').textContent))};`);
  conferir(soSaidas.n === doMes - entradasDoMes, `"só saídas" mostra ${soSaidas.n} de ${doMes}`);
  conferir(soSaidas.nenhumaEntrada, 'e nenhuma entrada se infiltra');

  console.log('\n  \x1b[1mo mês que escolho continua meu\x1b[0m');
  const manteve = await avaliar(cdp, `
    const st=document.getElementById('diario-tipo-filtro');
    st.value='todos'; st.dispatchEvent(new Event('change',{bubbles:true}));
    const sm=document.getElementById('diario-mes-filtro');
    sm.value='todos'; sm.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    /* um redesenho por qualquer outro motivo nao pode puxar de volta pro mes:
       sai do Diario, volta, e confere */
    document.querySelector('.bn-item[data-target="view-resumo"]').click();
    await new Promise(r=>setTimeout(r,500));
    document.querySelector('.bn-item[data-target="view-diario"]').click();
    await new Promise(r=>setTimeout(r,600));` + TODOS + `
    return {mes:document.getElementById('diario-mes-filtro').value,
      n:document.querySelectorAll('#transacoes-list .swipe-item').length};`);
  conferir(manteve.mes === 'todos', `escolhi "todos" e continuou em todos depois de um render (${manteve.mes})`,
    'o filtro não pode se reimpor a cada desenho da tela');
  conferir(manteve.n >= doMes, `mostrando ${manteve.n} lançamentos de todos os meses`);

  console.log('\n  \x1b[1mmês corrente sem nenhum lançamento\x1b[0m');
  await avaliar(cdp, `
    /* joga tudo pro ano passado: hoje é setembro/2026, nada em 2026-09 */
    const d=JSON.parse(localStorage.getItem('financas-data'));
    d.transacoes.forEach(t=>{ t.data=t.data.replace('2026','2024'); });
    d.faturas.forEach(f=>{ if(f.ano===2026) f.ano=2024; (f.gastos||[]).forEach(g=>{ if(g.dataCompra) g.dataCompra=g.dataCompra.replace('2026','2024'); }); });
    localStorage.setItem('financas-data',JSON.stringify(d));
    return 1;`);
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(1700);
  await abrirDiario(cdp);
  e = await estado(cdp);
  console.log(`     mês: "${e.mesRotulo}" (${e.mes}) · ${e.n} lançamentos`);
  conferir(e.mes === 'todos', 'sem lançamento no mês de hoje, abre em "todos"',
    'abriria numa lista vazia com o histórico inteiro escondido atrás do filtro');
  conferir(e.n > 0 && !e.vazio, `e mostra ${e.n} lançamentos em vez de uma tela vazia`);

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mO Diário abre onde deve e filtra o que se pede.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
