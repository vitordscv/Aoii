/* Os caminhos que alguém percorre de verdade, do toque até o dado salvo.
   Cada um confere o efeito no localStorage, não só que a tela mudou. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

const BASE = require('./cenario').SIMPLES;

const dados = cdp => avaliar(cdp, `return JSON.parse(localStorage.getItem('financas-data'));`);

async function preparar(cdp) {
  await irPara(cdp, URL);
  await avaliar(cdp, BASE);
  await irPara(cdp, URL);
  await esperar(1400);
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });

  /* ── 1. lançar um gasto pelo + ── */
  console.log('\n\x1b[1mLançar um gasto no Diário\x1b[0m');
  await preparar(cdp);
  const antes = await dados(cdp);
  await avaliar(cdp, `
    document.getElementById('gasto-fab').click();
    await new Promise(r=>setTimeout(r,500));
    document.getElementById('gasto-valor').value='47,90';
    document.getElementById('gasto-valor').dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#gasto-cat-grid .cat-pill:nth-child(2)')?.click();
    document.getElementById('gasto-descricao').value='Almoço';
    document.getElementById('gasto-sheet-submit').click();
    await new Promise(r=>setTimeout(r,700));
    return 1;`);
  await esperar(600);
  let d = await dados(cdp);
  conferir(d.transacoes.length === 1, `virou 1 lançamento (era ${antes.transacoes.length})`);
  conferir(d.transacoes[0] && Math.abs(d.transacoes[0].valor - 47.9) < 0.01,
    `com o valor certo: ${d.transacoes[0] && d.transacoes[0].valor}`);
  conferir(Math.abs(d.saldoAtual - (antes.saldoAtual - 47.9)) < 0.01,
    `e o saldo caiu junto: ${antes.saldoAtual} → ${d.saldoAtual}`);
  const fechou = await avaliar(cdp, `return document.getElementById('gasto-sheet').style.display!=='block';`);
  conferir(fechou, 'a folha fechou depois de lançar');

  /* ── 2. gasto no crédito vai pra fatura, não pro saldo ── */
  console.log('\n\x1b[1mGasto no crédito entra na fatura\x1b[0m');
  await preparar(cdp);
  const antes2 = await dados(cdp);
  await avaliar(cdp, `
    document.getElementById('gasto-fab').click();
    await new Promise(r=>setTimeout(r,500));
    document.querySelector('.pay-method-btn[data-metodo="credito"]').click();
    await new Promise(r=>setTimeout(r,250));
    document.getElementById('gasto-valor').value='300';
    document.getElementById('gasto-valor').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('gasto-parcelas').value='3';
    document.getElementById('gasto-descricao').value='Fone';
    document.getElementById('gasto-sheet-submit').click();
    await new Promise(r=>setTimeout(r,700));
    return 1;`);
  await esperar(600);
  d = await dados(cdp);
  const parcelas = d.faturas.flatMap(f => f.gastos).filter(g => g.nome.startsWith('Fone'));
  conferir(parcelas.length === 3, `virou 3 parcelas (vieram ${parcelas.length})`);
  const soma = parcelas.reduce((s, g) => s + g.valor, 0);
  conferir(Math.abs(soma - 300) < 0.01, `a soma fecha com a compra: ${soma.toFixed(2)}`);
  conferir(d.saldoAtual === antes2.saldoAtual,
    `o saldo em conta NÃO muda no crédito (${antes2.saldoAtual} → ${d.saldoAtual})`);
  conferir(d.transacoes.length === 0, 'e não duplica como lançamento do Diário');

  /* ── 3. gasto fixo ── */
  console.log('\n\x1b[1mCadastrar um gasto fixo\x1b[0m');
  await preparar(cdp);
  await avaliar(cdp, `
    document.querySelector('.bn-item[data-target="view-fixos"]').click();
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('tab-fixos-contas').click();
    await new Promise(r=>setTimeout(r,300));
    document.getElementById('gf-new-btn').click();
    await new Promise(r=>setTimeout(r,500));
    document.getElementById('gf-valor').value='129,90';
    document.getElementById('gf-valor').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('gf-nome').value='Internet';
    document.getElementById('gf-dia').value='12';
    document.getElementById('gf-sheet-submit').click();
    await new Promise(r=>setTimeout(r,700));
    return 1;`);
  await esperar(600);
  d = await dados(cdp);
  conferir(d.gastosMensais.length === 1, `virou 1 conta fixa (vieram ${d.gastosMensais.length})`);
  conferir(d.gastosMensais[0] && d.gastosMensais[0].diaDoMes === 12,
    `no dia certo: ${d.gastosMensais[0] && d.gastosMensais[0].diaDoMes}`);
  const naTela = await avaliar(cdp, `return document.getElementById('gf-groups-list').textContent.includes('Internet');`);
  conferir(naTela, 'e aparece na lista sem precisar recarregar');

  /* ── 4. meta de economia ── */
  console.log('\n\x1b[1mCriar uma meta\x1b[0m');
  await preparar(cdp);
  await avaliar(cdp, `
    document.querySelector('.bn-item[data-target="view-economias"]').click();
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('tab-economias-metas').click();
    await new Promise(r=>setTimeout(r,400));
    document.getElementById('metas-nome').value='Viagem';
    document.getElementById('metas-valor').value='8000';
    document.getElementById('metas-add').click();
    await new Promise(r=>setTimeout(r,700));
    return 1;`);
  await esperar(600);
  d = await dados(cdp);
  conferir(d.metas.length === 1, `virou 1 meta (vieram ${d.metas.length})`);
  conferir(d.metas[0] && d.metas[0].valorAlvo === 8000, `com o alvo certo: ${d.metas[0] && d.metas[0].valorAlvo}`);
  const campoLimpo = await avaliar(cdp, `return document.getElementById('metas-nome').value==='';`);
  conferir(campoLimpo, 'e o campo limpa pra próxima');

  /* ── 5. desfazer a remoção de um lançamento ── */
  console.log('\n\x1b[1mRemover e desfazer\x1b[0m');
  await preparar(cdp);
  await avaliar(cdp, `
    document.getElementById('gasto-fab').click();
    await new Promise(r=>setTimeout(r,500));
    document.getElementById('gasto-valor').value='60';
    document.getElementById('gasto-valor').dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('gasto-sheet-submit').click();
    await new Promise(r=>setTimeout(r,800));
    document.querySelector('.bn-item[data-target="view-diario"]').click();
    await new Promise(r=>setTimeout(r,600));
    document.querySelector('[data-action="del-transacao"]').click();
    await new Promise(r=>setTimeout(r,600));
    return 1;`);
  let dep = await dados(cdp);
  const saldoDepoisDeRemover = await avaliar(cdp, `
    const t=document.getElementById('undo-toast');
    return {toast: t && t.style.display!=='none'};`);
  conferir(saldoDepoisDeRemover.toast, 'aparece o "Desfazer"');
  await avaliar(cdp, `document.getElementById('undo-toast-btn').click(); await new Promise(r=>setTimeout(r,700)); return 1;`);
  await esperar(600);
  d = await dados(cdp);
  conferir(d.transacoes.length === 1, `desfazer traz o lançamento de volta (ficaram ${d.transacoes.length})`);
  conferir(Math.abs(d.saldoAtual - 1940) < 0.01, `e o saldo volta junto: ${d.saldoAtual} (esperado 1940)`);

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mOs caminhos principais fecham.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
