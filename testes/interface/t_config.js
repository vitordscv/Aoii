/* Abre as Configurações, percorre as abas e confere que cada uma mostra o que
   o nome dela promete — e que as setas do teclado continuam andando. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, tirarFoto, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log('  \x1b[32mok\x1b[0m ' + m)
  : (falhas++, console.log('  \x1b[31m!!\x1b[0m ' + m + (d ? '\n       ' + d : ''))); };

/* o que cada aba PRECISA conter pra fazer jus ao nome */
const ESPERADO = {
  renda:        ['cfg-tipo-renda', 'cfg-dias-trabalho'],
  cartoes:      ['cartoes-list', 'cartao-new-btn'],
  categorias:   ['categorias-list', 'categoria-add-btn', 'viagens-list', 'viagem-add-btn'],
  preferencias: ['cfg-idioma', 'cfg-moeda', 'cfg-fundo-ilustrado', 'cfg-gasto-diario'],
  dados:        ['download-json-btn', 'sync-code-input', 'export-btn'],
  ia:           ['ia-ativa-check', 'ia-chave-input'],
  zona:         ['reset-btn'],
};

(async () => {
  const cdp = await conectar();
  await irPara(cdp, URL);
  await avaliar(cdp, `localStorage.clear(); return 1;`);
  await irPara(cdp, URL);
  await esperar(1400);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click();`);
  await esperar(900);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click();`);
  await esperar(700);
  await avaliar(cdp, `document.getElementById('topbar-settings-btn').click();`);
  await esperar(700);

  const abas = await avaliar(cdp, `
    return [...document.querySelectorAll('.settings-tabs [role=tab]')]
      .map(b=>({pane:b.dataset.pane, rotulo:b.textContent.trim(), controla:b.getAttribute('aria-controls')}));
  `);
  console.log('\n  ordem das abas: ' + abas.map(a => a.rotulo).join(' › ') + '\n');
  conferir(abas.length === 8, `${abas.length} abas`);

  for (const aba of abas) {
    const r = await avaliar(cdp, `
      document.getElementById('settings-tab-${aba.pane}').click();
      await new Promise(r=>setTimeout(r,250));
      const pane=document.getElementById('settings-pane-${aba.pane}');
      const sub=document.querySelector('[data-abas-sub="settings"]');
      return {
        visivel: pane && !pane.hidden,
        selecionada: document.getElementById('settings-tab-${aba.pane}').getAttribute('aria-selected')==='true',
        outrosVisiveis: [...document.querySelectorAll('.settings-pane')].filter(p=>!p.hidden).length,
        sub: sub ? sub.textContent.trim() : '',
        temIds: ${JSON.stringify(ESPERADO[aba.pane] || [])}.filter(id=>{
          const el=document.getElementById(id);
          return el && pane.contains(el);
        }),
      };
    `);
    const faltam = (ESPERADO[aba.pane] || []).filter(id => !r.temIds.includes(id));
    conferir(r.visivel && r.selecionada && r.outrosVisiveis === 1 && faltam.length === 0,
      `${aba.rotulo.padEnd(22)} → ${r.sub}`,
      faltam.length ? 'não encontrei dentro do painel: ' + faltam.join(', ')
                    : `visível=${r.visivel} selecionada=${r.selecionada} painéis abertos=${r.outrosVisiveis}`);
  }

  /* o cartão não pode ter sobrado em Categorias */
  const sobra = await avaliar(cdp, `
    const cat=document.getElementById('settings-pane-categorias');
    return cat.querySelector('#cartoes-list, #cartao-new-btn') ? 'sim' : 'não';
  `);
  conferir(sobra === 'não', 'nenhum resto de cartão em Categorias');

  /* teclado: setas andam entre as abas, como manda uma tablist */
  const teclado = await avaliar(cdp, `
    const primeira=document.getElementById('settings-tab-renda');
    primeira.click(); primeira.focus();
    await new Promise(r=>setTimeout(r,150));
    document.querySelector('.settings-tabs').dispatchEvent(
      new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    await new Promise(r=>setTimeout(r,250));
    return document.activeElement.id;
  `);
  conferir(teclado === 'settings-tab-cartoes', `seta direita vai de Renda para Cartões (foi para "${teclado}")`);

  await avaliar(cdp, `document.getElementById('settings-tab-cartoes').click();`);
  await esperar(400);
  await tirarFoto(cdp, PASTA_FOTOS + '/config-cartoes.png');
  await avaliar(cdp, `document.getElementById('settings-tab-categorias').click();`);
  await esperar(400);
  await tirarFoto(cdp, PASTA_FOTOS + '/config-categorias.png');

  console.log('\n  \x1b[1ma categoria nova escolhe o emoji\x1b[0m');
  {
    const r = await avaliar(cdp, `
      document.getElementById('settings-tab-categorias').click();
      await new Promise(r=>setTimeout(r,500));
      const abre=document.getElementById('categoria-emoji-btn');
      abre.click();
      await new Promise(r=>setTimeout(r,300));
      const grade=document.getElementById('categoria-emoji-grade');
      const opcoes=[...grade.querySelectorAll('.cat-emoji-opcao')];
      const escolhido=opcoes[0].textContent;
      opcoes[0].click();
      await new Promise(r=>setTimeout(r,300));
      document.getElementById('categoria-nova-nome').value='Pets';
      document.getElementById('categoria-add-btn').click();
      await new Promise(r=>setTimeout(r,900));
      const d=JSON.parse(localStorage.getItem('financas-data'));
      const lista=document.getElementById('categorias-list');
      return {escolhido,
        guardado:(d.categoriaEmojis||{})['Pets'],
        temCategoria:(d.categorias||[]).includes('Pets'),
        gradeFechou:grade.hidden,
        botaoVoltou:abre.textContent,
        naTela:(lista?lista.textContent:'')};`);
    conferir(r.temCategoria, 'a categoria foi criada');
    conferir(r.guardado === r.escolhido,
      `o emoji escolhido ficou guardado (${r.guardado})`,
      'sem isso toda categoria nova fica com a caixa de papelao');
    conferir(r.naTela.includes('Pets') && r.naTela.includes(r.escolhido),
      'e a categoria aparece na lista com o emoji dela');
    conferir(r.gradeFechou, 'a grade fecha depois de escolher');
    conferir(r.botaoVoltou === '\u{1F4E6}',
      'o botao volta ao neutro, pra proxima categoria nao herdar o icone');
  }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mConfigurações coerentes.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
