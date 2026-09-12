/* A rede de segurança: exportar e voltar. Se algo se perde no caminho de ida
   e volta, some em silêncio — a pessoa só descobre quando precisa. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

/* um app cheio, com tudo que o modelo de dados sabe guardar */
const CHEIO = require('./cenario').CENARIO;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 900, deviceScaleFactor: 1, mobile: true });
  await irPara(cdp, URL);
  await avaliar(cdp, CHEIO);
  await irPara(cdp, URL);
  await esperar(1500);

  console.log('\n\x1b[1mIda e volta pelo código de compartilhamento\x1b[0m');
  /* gera o código pela interface */
  const codigo = await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,500));
    document.getElementById('settings-tab-dados').click();
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('export-btn').click();
    await new Promise(r=>setTimeout(r,400));
    return document.getElementById('export-output').value;
  `);
  conferir(codigo && codigo.length > 100, `o código saiu (${codigo ? codigo.length : 0} caracteres)`);

  const antes = await avaliar(cdp, `return JSON.parse(localStorage.getItem('financas-data'));`);

  /* zera tudo e importa de volta */
  await avaliar(cdp, `localStorage.clear(); return 1;`);
  await irPara(cdp, URL);
  await esperar(1500);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,600)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);

  const importou = await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,500));
    document.getElementById('settings-tab-dados').click();
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('import-input').value=${JSON.stringify(codigo)};
    document.getElementById('import-btn').click();
    await new Promise(r=>setTimeout(r,600));
    /* a confirmação aparece: aceita */
    const ok=document.getElementById('confirm-ok');
    const visivel=document.getElementById('confirm-dialog').style.display==='block';
    if(visivel) ok.click();
    await new Promise(r=>setTimeout(r,900));
    return {pediuConfirmacao:visivel};
  `);
  conferir(importou.pediuConfirmacao, 'pede confirmação antes de substituir os dados');

  const depois = await avaliar(cdp, `return JSON.parse(localStorage.getItem('financas-data'));`);

  /* compara campo a campo o que importa */
  const listas = ['transacoes', 'gastosMensais', 'cartoes', 'faturas', 'entradasExtras',
    'dividas', 'comprasPlanejadas', 'metas', 'investimentos', 'viagens', 'rendasRecorrentes', 'categorias'];
  console.log('\n  listas:');
  listas.forEach(k => {
    const a = (antes[k] || []).length, b = (depois[k] || []).length;
    conferir(a === b, `${k.padEnd(18)} ${a} → ${b}`);
  });

  console.log('\n  números:');
  ['saldoAtual', 'dinheiroVivo', 'reservaGuardado', 'reservaMeses'].forEach(k => {
    conferir(antes[k] === depois[k], `${k.padEnd(18)} ${antes[k]} → ${depois[k]}`);
  });
  conferir(JSON.stringify(antes.orcamentos) === JSON.stringify(depois.orcamentos),
    `orçamentos preservados`, `${JSON.stringify(antes.orcamentos)} → ${JSON.stringify(depois.orcamentos)}`);
  conferir(antes.dataAlvo === depois.dataAlvo, `data-alvo ${antes.dataAlvo} → ${depois.dataAlvo}`);

  console.log('\n  detalhes que costumam se perder:');
  const tagAntes = (antes.transacoes || []).filter(t => t.tags && t.tags.length).length;
  const tagDepois = (depois.transacoes || []).filter(t => t.tags && t.tags.length).length;
  conferir(tagAntes === tagDepois, `lançamentos com tags: ${tagAntes} → ${tagDepois}`);
  const notaAntes = (antes.transacoes || []).filter(t => t.nota).length;
  const notaDepois = (depois.transacoes || []).filter(t => t.nota).length;
  conferir(notaAntes === notaDepois, `lançamentos com nota: ${notaAntes} → ${notaDepois}`);
  const parcAntes = (antes.faturas || []).flatMap(f => f.gastos || []).length;
  const parcDepois = (depois.faturas || []).flatMap(f => f.gastos || []).length;
  conferir(parcAntes === parcDepois, `itens dentro das faturas: ${parcAntes} → ${parcDepois}`);
  conferir((antes.dividas[0] || {}).credor === (depois.dividas[0] || {}).credor,
    `credor da dívida: "${(antes.dividas[0] || {}).credor}" → "${(depois.dividas[0] || {}).credor}"`);
  const divAntes = (antes.investimentos || []).flatMap(i => i.dividendos || []).length;
  const divDepois = (depois.investimentos || []).flatMap(i => i.dividendos || []).length;
  conferir(divAntes === divDepois, `dividendos: ${divAntes} → ${divDepois}`);

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mNada se perde na ida e volta.\x1b[0m' : `\x1b[31m${falhas} perda(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
