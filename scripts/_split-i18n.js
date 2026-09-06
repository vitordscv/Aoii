#!/usr/bin/env node
/* Passo único: quebra src/i18n/dictionary.js em um arquivo por idioma.
   Descartável — depois de rodar, apague. Fica registrado em docs/MIGRATION.md. */
'use strict';
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'src', 'i18n');

const L = fs.readFileSync(path.join(DIR, 'dictionary.js'), 'utf8').split('\n');

const FAIXAS = { pt: [4, 20], en: [21, 37], es: [38, 54], fr: [55, 71], it: [72, 88] };
const NOMES = {
  pt: 'Português do Brasil — idioma de origem. Toda chave nova nasce aqui.',
  en: 'English', es: 'Español', fr: 'Français', it: 'Italiano',
};

if (L[2] !== 'const I18N={') throw new Error('linha 3 não é o começo do objeto: ' + L[2]);
if (L[88] !== '};') throw new Error('linha 89 não é o fim do objeto: ' + L[88]);

const chaves = t => new Set((t.match(/'([a-zA-Z0-9_.]+)':/g) || []).map(s => s.slice(1, -2)));
const antes = {};

for (const [id, [a, b]] of Object.entries(FAIXAS)) {
  const bloco = L.slice(a - 1, b).join('\n');
  antes[id] = chaves(bloco);

  /* `  pt:{…},`  →  `const I18N_PT={…};` */
  const abre = new RegExp('^  ' + id + ':\\{');
  if (!abre.test(bloco)) throw new Error(id + ': o bloco não começa com "  ' + id + ':{"');
  let corpo = bloco.replace(abre, '');
  corpo = corpo.replace(/\},?$/, '');
  if (corpo === bloco) throw new Error(id + ': não achei o fecho do bloco');

  const saida =
    '/* ' + NOMES[id] + '\n' +
    '   Uma chave por linha lógica, na mesma ordem em todos os idiomas.\n' +
    '   Chave faltando cai no português — veja i18n/runtime.js. */\n' +
    'const I18N_' + id.toUpperCase() + '={' + corpo + '};\n';
  fs.writeFileSync(path.join(DIR, id + '.js'), saida);
}

/* dictionary.js fica só com a montagem e o applyIdioma */
const resto = L.slice(89).join('\n');
const novo =
  L[0] + '\n' + L[1] + '\n' +
  '/* As traduções em si moram em i18n/<idioma>.js. Aqui só se junta tudo:\n' +
  '   a ordem no build.manifest.json garante que os dicionários já existam. */\n' +
  'const I18N={pt:I18N_PT,en:I18N_EN,es:I18N_ES,fr:I18N_FR,it:I18N_IT};\n' +
  resto;
fs.writeFileSync(path.join(DIR, 'dictionary.js'), novo);

/* manifesto: os idiomas entram logo antes de dictionary.js */
const mPath = path.join(RAIZ, 'src', 'build.manifest.json');
const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
const i = m.scripts.indexOf('i18n/dictionary.js');
if (i < 0) throw new Error('dictionary.js não está no manifesto');
m.scripts.splice(i, 0, ...['pt', 'en', 'es', 'fr', 'it'].map(x => 'i18n/' + x + '.js'));
fs.writeFileSync(mPath, JSON.stringify(m, null, 2) + '\n');

/* confere que nenhuma chave se perdeu no corte */
for (const id of Object.keys(FAIXAS)) {
  const depois = chaves(fs.readFileSync(path.join(DIR, id + '.js'), 'utf8'));
  const some = [...antes[id]].filter(k => !depois.has(k));
  const sobra = [...depois].filter(k => !antes[id].has(k));
  if (some.length || sobra.length) {
    throw new Error(id + ': sumiram ' + some.length + ', apareceram ' + sobra.length);
  }
  console.log(id + ': ' + depois.size + ' chaves');
}
