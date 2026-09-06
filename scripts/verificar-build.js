#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Prova de que a modularização não mexeu em nada.

   Compara o dist/ gerado a partir de src/ com o documento que estava dentro
   do index.html empacotado de referência. Se bater byte a byte, a aplicação
   publicada é literalmente a mesma — não há o que revisar visualmente.

     node scripts/verificar-build.js --referencia referencia/index-6556d20.html

   Quando src/ passar a receber mudanças de verdade (e vai), este confronto
   deixa de valer e o script deve ser aposentado. Ele existe para a rodada da
   extração, que é justamente aquela em que "nada mudou" precisa ser provado.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
function arg(nome, padrao) {
  const i = process.argv.indexOf(nome);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}
const REF = path.resolve(RAIZ, arg('--referencia', 'referencia/index-6556d20.html'));

if (!fs.existsSync(REF)) {
  console.log('sem arquivo de referência (' + path.relative(RAIZ, REF) + ') — nada a comparar');
  process.exit(0);
}

function desempacotar(arquivo) {
  const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
  const i = linhas.findIndex(l => l.trim().startsWith('"<!DOCTYPE html>'));
  if (i < 0) throw new Error('não achei o template empacotado em ' + arquivo);
  return JSON.parse(linhas[i]);
}

const esperado = desempacotar(REF);
const gerado = fs.readFileSync(path.join(RAIZ, 'dist', 'index.html'), 'utf8')
  /* o aviso de arquivo gerado é a única linha que o build acrescenta */
  .replace(/^(<!DOCTYPE html>\n)<!-- ARQUIVO GERADO[^\n]*\n/, '$1');

if (gerado === esperado) {
  console.log('dist/index.html é byte a byte igual ao app dentro de ' + path.basename(REF) +
    ' (' + Buffer.byteLength(gerado).toLocaleString('pt-BR') + ' bytes)');
  process.exit(0);
}

/* achou diferença: mostra onde, sem despejar o arquivo */
const a = esperado.split('\n'), b = gerado.split('\n');
console.error('dist/index.html DIFERE da referência');
console.error('  linhas: esperado ' + a.length + ', gerado ' + b.length);
let n = 0;
for (let i = 0; i < Math.max(a.length, b.length) && n < 5; i++) {
  if (a[i] !== b[i]) {
    n++;
    console.error('  linha ' + (i + 1));
    console.error('    esperado: ' + JSON.stringify(String(a[i]).slice(0, 100)));
    console.error('    gerado:   ' + JSON.stringify(String(b[i]).slice(0, 100)));
  }
}
process.exit(1);
