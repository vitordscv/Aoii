#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Desempacota o index.html publicado e recorta o conteúdo em arquivos-fonte.

   Isto roda UMA VEZ, para derivar `src/` a partir da versão empacotada. Fica
   no repositório para que a derivação seja auditável: qualquer pessoa pode
   apontar o script para o index.html de um commit antigo e comparar.

   Depois desta extração a fonte de verdade passa a ser `src/`. Não rode o
   script de novo para "atualizar" a fonte — isso jogaria fora as edições
   feitas em src/.

     node scripts/extract-current-app.js --de <index.html> --para src

   O corte é por faixa de linhas: cada arquivo recebe um trecho contíguo do
   documento original, e a ordem dos arquivos no manifesto é a ordem original.
   Assim a concatenação feita pelo build reproduz o documento byte a byte —
   é isso que `scripts/verificar-build.js` confere.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/* ── argumentos ── */
function arg(nome, padrao) {
  const i = process.argv.indexOf(nome);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}
const ARQ_ENTRADA = path.resolve(RAIZ, arg('--de', 'index.html'));
const DIR_SAIDA = path.resolve(RAIZ, arg('--para', 'src'));

/* ═══ 1. desempacota ═══
   O app publicado é um HTML embrulhado por um bundler: o documento real vive
   como string JSON dentro de <script type="__bundler/template">. O invólucro
   (thumbnail SVG + carregador) não faz parte da aplicação e é descartado. */
function desempacotar(arquivo) {
  const bruto = fs.readFileSync(arquivo, 'utf8');
  const linhas = bruto.split(/\r?\n/);
  const i = linhas.findIndex(l => l.trim().startsWith('"<!DOCTYPE html>'));
  if (i < 0) throw new Error('não achei o template empacotado em ' + arquivo);
  const externos = bruto.match(/__bundler\/ext_resources">\s*(\[[^\]]*\])/);
  if (externos && externos[1].trim() !== '[]') {
    throw new Error('o bundle tem recursos externos; a extração precisaria tratá-los');
  }
  return JSON.parse(linhas[i]);
}

/* ═══ 2. o mapa de corte ═══
   [primeira linha (1-based), caminho de destino]. Cada faixa vai até a linha
   anterior à próxima entrada. Os nomes seguem a arquitetura de docs/ARCHITECTURE.md.
   Onde a ordem original obriga a quebrar um assunto em dois arquivos, isso está
   anotado — e listado como pendência em docs/MIGRATION.md. */

const CORTES_CSS_FONTES = [[24, 'styles/fonts.css']];

const CORTES_CSS = [
  [101, 'styles/tokens.css'],        // máscara do padrão + paleta base (tema Onda)
  [117, 'styles/themes.css'],        // os outros seis temas
  [199, 'styles/base.css'],          // reset, body, wrap, foco, reduced-motion
  [210, 'styles/components.css'],    // topbar → sombras dos cards
  [1059, 'styles/enhancements.css'], // bloco "MELHORIAS": animações, swipe, undo…
];

const CORTES_JS = [
  [2393, 'data/constants.js'],            // nomes de mês, chave do localStorage
                                          // (+ o memorando sobre criptografia/RLS: vai pra
                                          //  docs/SECURITY.md na próxima rodada)
  [2454, 'storage/supabase-config.js'],
  [2461, 'ui/background-art.js'],
  [2479, 'storage/sync.js'],
  [2528, 'data/state.js'],                // `let data` — o estado único do app
  [2530, 'core/helpers.js'],
  [2540, 'core/money.js'],
  [2601, 'core/dates.js'],
  [2692, 'core/invoices.js'],
  [2715, 'core/income.js'],
  [2740, 'core/timeline.js'],             // o motor da projeção
  [2884, 'core/cards.js'],
  [2931, 'core/transactions.js'],
  [2984, 'core/metrics.js'],
  [3037, 'core/defaults.js'],
  [3227, 'storage/local-storage.js'],
  [3275, 'ui/effects.js'],
  [3486, 'core/advisor.js'],
  [3569, 'i18n/dictionary.js'],
  [3682, 'integrations/gemini-key.js'],
  [3686, 'i18n/runtime.js'],              // localeAtual() e L()
  [3690, 'integrations/gemini.js'],
  [3808, 'core/insights.js'],
  [3850, 'core/budgets.js'],
  [3899, 'ui/dialogs.js'],
  [3958, 'integrations/brasil-api.js'],
  [4005, 'core/interest.js'],
  [4076, 'ui/investments.js'],
  [4324, 'ui/daily.js'],
  [4545, 'ui/incomes.js'],
  [4673, 'ui/render.js'],
  [4824, 'ui/hero.js'],
  [4896, 'ui/warnings.js'],
  [4989, 'ui/settings-lists.js'],
  [5097, 'ui/health.js'],
  [5229, 'ui/charts.js'],
  [5319, 'ui/trajectory.js'],
  [5426, 'ui/months.js'],
  [5689, 'ui/lists.js'],
  [5806, 'core/averages.js'],
  [5824, 'ui/reserve.js'],
  [5951, 'ui/fixed-expenses.js'],
  [6121, 'ui/goals.js'],
  [6220, 'core/networth.js'],
  [6272, 'ui/networth.js'],
  [6345, 'ui/settings-render.js'],
  [6405, 'ui/bindings.js'],
  [6769, 'ui/diary.js'],
  [6930, 'ui/onboarding.js'],
  [7084, 'ui/help.js'],
  [7174, 'ui/sheet-expense.js'],
  [7238, 'ui/chat.js'],
  [7500, 'ui/sheet-fixed.js'],
  [7596, 'ui/sheet-card.js'],
  [7709, 'ui/settings.js'],
  [7737, 'ui/layout.js'],
  [7766, 'ui/tabs.js'],
  [7792, 'ui/boot.js'],                   // checagem de versão nova + init()
];

/* marcadores que o build usa para recolocar cada bloco no lugar */
const MARCA_FONTES = '<!--build:fonts-->';
const MARCA_ESTILOS = '<!--build:styles-->';
const MARCA_SCRIPTS = '<!--build:scripts-->';

/* ═══ 3. recorte ═══ */
function fatiar(linhas, cortes, ultimaLinha) {
  return cortes.map(([inicio, destino], i) => {
    const fim = i + 1 < cortes.length ? cortes[i + 1][0] - 1 : ultimaLinha;
    if (fim < inicio) throw new Error('faixa vazia ou invertida em ' + destino);
    return { destino, conteudo: linhas.slice(inicio - 1, fim).join('\n') };
  });
}

function escrever(destino, conteudo) {
  const alvo = path.join(DIR_SAIDA, destino);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  /* sempre acrescenta uma quebra final: o build tira exatamente uma, então uma
     linha em branco no fim do trecho sobrevive à ida e à volta */
  fs.writeFileSync(alvo, conteudo + '\n');
  return { destino, bytes: Buffer.byteLength(conteudo) };
}

function main() {
  const doc = desempacotar(ARQ_ENTRADA);
  const L = doc.split('\n');

  /* confere que o documento é o que o mapa de corte espera */
  const espera = (n, texto) => {
    if (L[n - 1].trim() !== texto) {
      throw new Error('linha ' + n + ' deveria ser ' + JSON.stringify(texto) +
        ' e é ' + JSON.stringify(L[n - 1].trim().slice(0, 60)) +
        '\nO index.html não é o esperado — confira o commit antes de extrair.');
    }
  };
  espera(23, '<style>');   espera(99, '</style>');
  espera(100, '<style>');  espera(1435, '</style>');
  espera(1436, '</head>'); espera(1437, '<body>');
  espera(2390, '<script>'); espera(2391, '(function(){');
  espera(2392, '"use strict";');
  espera(7834, '})();');   espera(7835, '</script>');

  const escritos = [];
  fatiar(L, CORTES_CSS_FONTES, 98).forEach(f => escritos.push(escrever(f.destino, f.conteudo)));
  fatiar(L, CORTES_CSS, 1434).forEach(f => escritos.push(escrever(f.destino, f.conteudo)));
  fatiar(L, CORTES_JS, 7833).forEach(f => escritos.push(escrever(f.destino, f.conteudo)));

  /* o esqueleto: tudo que não é CSS nem JS, com marcadores no lugar dos blocos */
  const esqueleto = []
    .concat(L.slice(0, 22))                    // 1–22: <head>, ícones, metas
    .concat(['<style>', MARCA_FONTES, '</style>'])
    .concat(['<style>', MARCA_ESTILOS, '</style>'])
    .concat(L.slice(1435, 2389))               // 1436–2389: </head><body> + marcação
    .concat([MARCA_SCRIPTS])
    .concat(L.slice(7835))                     // 7836–fim: bg-art-data + fechamento
    .join('\n');
  escritos.push(escrever('index.html', esqueleto));

  /* o manifesto que o build lê */
  const manifesto = {
    _leiaMe: 'Gerado por scripts/extract-current-app.js. A ordem É significativa: ' +
             'os módulos são concatenados nesta sequência dentro de um único IIFE, ' +
             'exatamente como estavam no arquivo original.',
    fontes: CORTES_CSS_FONTES.map(c => c[1]),
    estilos: CORTES_CSS.map(c => c[1]),
    scripts: CORTES_JS.map(c => c[1]),
  };
  fs.writeFileSync(path.join(DIR_SAIDA, 'build.manifest.json'),
    JSON.stringify(manifesto, null, 2) + '\n');

  const total = escritos.reduce((s, e) => s + e.bytes, 0);
  console.log(escritos.length + ' arquivos, ' + total.toLocaleString('pt-BR') + ' bytes');
  console.log('maiores:');
  escritos.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 8)
    .forEach(e => console.log('  ' + String(e.bytes).padStart(7) + '  ' + e.destino));
}

main();
