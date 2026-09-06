#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Monta dist/index.html a partir de src/.

   O build é uma concatenação ordenada, de propósito: os módulos de src/ são
   fragmentos de um único IIFE e continuam compartilhando o mesmo escopo, do
   mesmo jeito que compartilhavam quando estavam num arquivo só. Isso mantém
   a refatoração estrutural sem risco — nenhuma regra financeira muda porque
   um arquivo foi partido em dois.

   A ordem em src/build.manifest.json é a ordem original do código. Mexer nela
   é mudança de comportamento: leia docs/ARCHITECTURE.md antes.

     node scripts/build.js            monta dist/
     node scripts/build.js --check    monta em memória e falha se dist/ estiver
                                      diferente (é o que a CI roda)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const PUBLIC = path.join(RAIZ, 'public');
const DIST = path.join(RAIZ, 'dist');

const AVISO = '<!-- ARQUIVO GERADO. EDITE OS ARQUIVOS EM src/ E EXECUTE npm run build. -->';

/* Cada arquivo em src/ termina em \n (convenção POSIX). Esse \n é do arquivo,
   não do conteúdo, então sai antes da concatenação. */
function ler(rel) {
  const s = fs.readFileSync(path.join(SRC, rel), 'utf8').split('\r\n').join('\n');
  return s.endsWith('\n') ? s.slice(0, -1) : s;
}

function montar() {
  const manifesto = JSON.parse(fs.readFileSync(path.join(SRC, 'build.manifest.json'), 'utf8'));
  const esqueleto = ler('index.html');

  const fontes = manifesto.fontes.map(ler).join('\n');
  const estilos = manifesto.estilos.map(ler).join('\n');
  const scripts = manifesto.scripts.map(ler).join('\n');

  const corpoScript = ['<script>', '(function(){', '"use strict";', scripts, '})();', '</script>'].join('\n');

  let saida = esqueleto;
  for (const [marca, valor] of [
    ['<!--build:fonts-->', fontes],
    ['<!--build:styles-->', estilos],
    ['<!--build:scripts-->', corpoScript],
  ]) {
    const n = saida.split(marca).length - 1;
    if (n !== 1) throw new Error('marcador ' + marca + ' aparece ' + n + ' vez(es) em src/index.html');
    saida = saida.split(marca).join(valor);
  }

  /* o aviso entra depois do <!DOCTYPE html>, para não deslocar a primeira linha */
  const q = saida.indexOf('\n');
  saida = saida.slice(0, q + 1) + AVISO + '\n' + saida.slice(q + 1);

  return saida;
}

/* copia public/ para dist/, preservando a árvore */
function copiarPublic(destino) {
  if (!fs.existsSync(PUBLIC)) return [];
  const copiados = [];
  (function anda(dir, rel) {
    for (const nome of fs.readdirSync(dir).sort()) {
      const cheio = path.join(dir, nome);
      const relNovo = rel ? rel + '/' + nome : nome;
      if (fs.statSync(cheio).isDirectory()) { anda(cheio, relNovo); continue; }
      const alvo = path.join(destino, relNovo);
      fs.mkdirSync(path.dirname(alvo), { recursive: true });
      fs.copyFileSync(cheio, alvo);
      copiados.push(relNovo);
    }
  })(PUBLIC, '');
  return copiados;
}

function main() {
  const html = montar();
  const alvo = path.join(DIST, 'index.html');
  const checando = process.argv.includes('--check');

  if (checando) {
    const atual = fs.existsSync(alvo) ? fs.readFileSync(alvo, 'utf8') : null;
    if (atual !== html) {
      console.error('dist/index.html está diferente do que src/ produz. Rode: npm run build');
      process.exit(1);
    }
    console.log('dist/ está em dia com src/ (' + Buffer.byteLength(html).toLocaleString('pt-BR') + ' bytes)');
    return;
  }

  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(alvo, html);
  const copiados = copiarPublic(DIST);
  console.log('dist/index.html  ' + Buffer.byteLength(html).toLocaleString('pt-BR') + ' bytes');
  console.log('public/ → dist/  ' + copiados.length + ' arquivos');
}

main();
