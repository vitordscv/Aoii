/* O CSV do mês tem que fechar com o documento impresso, centavo por centavo.
   Intercepta o Blob em vez de baixar o arquivo — o navegador sob CDP não
   entrega download, e o que interessa é o conteúdo. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const fs = require('fs');

const CEN = require('./cenario').CENARIO;

let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
  await irPara(cdp, 'http://localhost:4173/');
  await avaliar(cdp, CEN);
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(1700);
  await avaliar(cdp, `document.querySelector('.bn-item[data-target="view-resumo"]').click(); return 1;`);
  await esperar(600);

  const csv = await avaliar(cdp, `
    /* segura o texto antes de virar download */
    let capturado=null;
    const BlobReal=window.Blob;
    window.Blob=function(partes,opts){ if(opts&&/csv/.test(opts.type)) capturado=partes.join(''); return new BlobReal(partes,opts); };
    document.getElementById('export-csv-mes-btn').click();
    await new Promise(r=>setTimeout(r,300));
    window.Blob=BlobReal;
    return capturado;
  `);
  if (!csv) { console.error('não capturei o CSV'); process.exit(1); }
  fs.writeFileSync(PASTA_FOTOS + '/movimentos-do-mes.csv', csv);

  const linhas = csv.replace(/^﻿/, '').trim().split('\r\n')
    .map(l => l.match(/"((?:[^"]|"")*)"/g).map(c => c.slice(1, -1).replace(/""/g, '"')));
  const cab = linhas.shift();
  console.log('\n  colunas: ' + cab.join(' | '));
  console.log('  linhas: ' + linhas.length + '\n');

  const num = s => parseFloat(s.replace(',', '.'));
  const somar = f => linhas.filter(f).reduce((s, l) => s + num(l[6]), 0);
  const ehGasto = l => l[1] === 'Gasto';
  const ehEntrada = l => l[1] === 'Entrada';
  const feito = l => l[2] === 'Realizado';

  const r = {
    entradaFeita: somar(l => ehEntrada(l) && feito(l)),
    entradaPrev: somar(l => ehEntrada(l) && !feito(l)),
    gastoFeito: somar(l => ehGasto(l) && feito(l)),
    gastoPrev: somar(l => ehGasto(l) && !feito(l)),
  };
  console.log(`  entradas  realizado ${r.entradaFeita.toFixed(2)}  previsto ${r.entradaPrev.toFixed(2)}`);
  console.log(`  gastos    realizado ${r.gastoFeito.toFixed(2)}  previsto ${r.gastoPrev.toFixed(2)}\n`);

  /* os mesmos números, agora lidos do documento IMPRESSO — é com ele que a
     planilha precisa fechar, não com uma segunda chamada ao motor */
  const totais = await avaliar(cdp, `
    const antes=[...document.querySelectorAll('iframe')];
    document.getElementById('export-relatorio-btn').click();
    let ifr=null;
    for(let i=0;i<40 && !ifr;i++){
      await new Promise(r=>setTimeout(r,25));
      ifr=[...document.querySelectorAll('iframe')].find(f=>!antes.includes(f))||null;
      if(ifr && ifr.contentWindow) ifr.contentWindow.print=function(){};
    }
    await new Promise(r=>setTimeout(r,400));
    const d=ifr.contentDocument;
    const ler=tr=>[...tr.querySelectorAll('td.num')].map(td=>
      parseFloat(td.textContent.replace(/[^0-9,.-]/g,'').replace(/\\./g,'').replace(',','.')));
    const tot=[...d.querySelectorAll('tr.tot')];
    const linhas=d.querySelectorAll('tr.tot ~ tr, table tr').length;
    return {receitas:ler(tot[0]),despesas:ler(tot[1])};
  `);
  const doDocumento = {
    entradaFeita: totais.receitas[0], entradaPrev: totais.receitas[1],
    gastoFeito: totais.despesas[0], gastoPrev: totais.despesas[1],
  };
  for (const k of Object.keys(r)) {
    conferir(Math.abs(r[k] - doDocumento[k]) < 0.005,
      `${k}: planilha ${r[k].toFixed(2)} = documento ${doDocumento[k].toFixed(2)}`);
  }

  const semData = linhas.filter(l => !/^\d{4}-\d{2}-\d{2}$/.test(l[0]));
  conferir(semData.length === 0, 'toda linha tem data ISO',
    semData.slice(0, 3).map(l => l.join(' | ')).join('\n       '));
  const comEmoji = linhas.filter(l => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(l.join('')));
  conferir(comEmoji.length === 0, 'nenhum emoji dentro de célula',
    comEmoji.slice(0, 3).map(l => l.join(' | ')).join('\n       '));

  console.log('\n  primeiras linhas:');
  linhas.slice(0, 6).forEach(l => console.log('   ' + l.join(' | ')));

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mA planilha fecha com o documento.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
