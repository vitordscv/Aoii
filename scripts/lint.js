#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Guarda as fronteiras entre os módulos de src/.

   Os módulos ainda compartilham um escopo só (são fatias de um IIFE), então
   nada impede, tecnicamente, que a interface chame o motor no meio de uma
   função de desenho. O que impede é isto aqui.

   Como funciona: para cada arquivo, lê os nomes declarados no topo (função,
   const, let, var na coluna 0) e os nomes que ele usa. Todo nome usado que foi
   declarado em outro arquivo vira uma aresta. A aresta é permitida se a camada
   de destino for igual ou mais baixa que a de origem.

     data(0) · i18n(1) · core(2) · storage(3) · integrations(4) · ui(5)

   A base de código não nasceu com essas fronteiras, então as violações que já
   existiam estão congeladas em scripts/lint-baseline.json. Violação nova falha
   o lint; violação antiga que some pode (e deve) sair da baseline.

     node scripts/lint.js                 confere
     node scripts/lint.js --baseline      regrava a baseline com o estado atual
     node scripts/lint.js --grafo         imprime o grafo de dependências
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SRC = path.join(RAIZ, 'src');
const BASELINE = path.join(__dirname, 'lint-baseline.json');

const CAMADAS = { data: 0, i18n: 1, core: 2, storage: 3, integrations: 4, ui: 5 };

/* nomes que vêm do ambiente, não de outro módulo */
const GLOBAIS = new Set([
  'window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'console', 'JSON', 'Math', 'Date', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Map', 'Set', 'WeakMap', 'Promise', 'Error', 'RegExp', 'Intl', 'crypto', 'fetch',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'performance', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'btoa', 'atob', 'alert', 'confirm',
  'Infinity', 'NaN', 'undefined', 'globalThis', 'structuredClone', 'AbortController',
  'CustomEvent', 'Event', 'MutationObserver', 'IntersectionObserver', 'TextEncoder',
  'TextDecoder', 'Uint8Array', 'ArrayBuffer', 'Blob', 'URL', 'FileReader', 'Image',
  'matchMedia', 'getComputedStyle', 'history', 'screen', 'CSS', 'SVGElement', 'HTMLElement',
]);

const PALAVRAS = new Set([
  'if', 'else', 'for', 'while', 'do', 'return', 'function', 'const', 'let', 'var', 'new',
  'typeof', 'instanceof', 'in', 'of', 'this', 'true', 'false', 'null', 'try', 'catch',
  'finally', 'throw', 'switch', 'case', 'default', 'break', 'continue', 'delete', 'void',
  'async', 'await', 'yield', 'class', 'extends', 'super', 'static', 'get', 'set', 'from',
]);

function listarModulos() {
  const manifesto = JSON.parse(fs.readFileSync(path.join(SRC, 'build.manifest.json'), 'utf8'));
  return manifesto.scripts;
}

function camadaDe(rel) {
  const pasta = rel.split('/')[0];
  if (!(pasta in CAMADAS)) throw new Error('módulo fora das camadas conhecidas: ' + rel);
  return CAMADAS[pasta];
}

/* remove comentários e literais de string/template para não caçar nomes dentro deles */
function despir(codigo) {
  let fora = '';
  let i = 0;
  const n = codigo.length;
  while (i < n) {
    const c = codigo[i], d = codigo[i + 1];
    if (c === '/' && d === '*') { const f = codigo.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; fora += ' '; continue; }
    if (c === '/' && d === '/') { const f = codigo.indexOf('\n', i); i = f < 0 ? n : f; fora += ' '; continue; }
    if (c === '"' || c === "'") {
      i++;
      while (i < n && codigo[i] !== c) { if (codigo[i] === '\\') i++; i++; }
      i++; fora += '""'; continue;
    }
    if (c === '`') {
      /* templates podem conter ${…} com código de verdade — esse a gente mantém */
      i++;
      while (i < n && codigo[i] !== '`') {
        if (codigo[i] === '\\') { i += 2; continue; }
        if (codigo[i] === '$' && codigo[i + 1] === '{') {
          let prof = 1; i += 2; const ini = i;
          while (i < n && prof > 0) {
            if (codigo[i] === '{') prof++;
            else if (codigo[i] === '}') prof--;
            if (prof > 0) i++;
          }
          fora += ' ' + codigo.slice(ini, i) + ' ';
          i++; continue;
        }
        i++;
      }
      i++; fora += '``'; continue;
    }
    fora += c; i++;
  }
  return fora;
}

/* declarações no nível de cima do módulo: começam na coluna 0 */
function declaracoes(codigo) {
  const nomes = new Set();
  for (const linha of codigo.split('\n')) {
    let m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(linha);
    if (m) { nomes.add(m[1]); continue; }
    m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(linha);
    if (m) { nomes.add(m[1]); continue; }
    /* const {a,b}=… e const [a,b]=… */
    m = /^(?:const|let|var)\s*[{[]([^}\]]*)[}\]]\s*=/.exec(linha);
    if (m) m[1].split(',').forEach(p => {
      const nome = p.split(':').pop().split('=')[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nome)) nomes.add(nome);
    });
  }
  return nomes;
}

function usos(codigo) {
  /* Um nome só conta como uso se não vier depois de ponto (aí é propriedade) e
     não estiver em posição de chave de objeto — `{ iaAtiva: … }` declara um
     campo, não usa a função `iaAtiva`. Sem essa segunda regra, todo arquivo de
     configuração vira uma enxurrada de dependências que não existem. */
  const achados = new Set();
  const re = /(^|[^.\w$'"])([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(codigo))) {
    const nome = m[2];
    if (PALAVRAS.has(nome) || GLOBAIS.has(nome)) continue;
    /* espia o que vem depois sem consumir: consumir o ":" comeria o separador
       do próximo nome e `{id:uid()}` deixaria de registrar o uso de uid */
    const depois = /^\s*:/.test(codigo.slice(re.lastIndex));
    if (depois) {
      /* chave de objeto se o que veio antes abre ou separa um literal.
         `a ? b : c` e `case x:` também caem aqui — são raros, e o custo é só
         deixar de enxergar uma aresta. */
      const antes = m[1].trim();
      if (antes === '' || antes === '{' || antes === ',') continue;
    }
    achados.add(nome);
  }
  return achados;
}

function main() {
  const modulos = listarModulos();
  const info = modulos.map(rel => {
    const bruto = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const limpo = despir(bruto);
    return {
      rel,
      camada: camadaDe(rel),
      linhas: bruto.split('\n').length,
      declara: declaracoes(limpo),
      usa: usos(limpo),
    };
  });

  /* quem declara cada nome (o primeiro a declarar é o dono) */
  const dono = new Map();
  for (const m of info) for (const nome of m.declara) if (!dono.has(nome)) dono.set(nome, m.rel);

  const arestas = [];
  const violacoes = [];
  for (const m of info) {
    const alvos = new Set();
    for (const nome of m.usa) {
      const d = dono.get(nome);
      if (!d || d === m.rel) continue;
      alvos.add(d);
    }
    for (const alvo of alvos) {
      arestas.push([m.rel, alvo]);
      const camadaAlvo = camadaDe(alvo);
      if (camadaAlvo > m.camada) violacoes.push(m.rel + ' → ' + alvo);
    }
  }
  violacoes.sort();

  if (process.argv.includes('--grafo')) {
    const porOrigem = new Map();
    arestas.forEach(([a, b]) => { if (!porOrigem.has(a)) porOrigem.set(a, []); porOrigem.get(a).push(b); });
    [...porOrigem.keys()].sort().forEach(a => {
      console.log(a);
      porOrigem.get(a).sort().forEach(b => console.log('    → ' + b));
    });
    return;
  }

  if (process.argv.includes('--baseline')) {
    fs.writeFileSync(BASELINE, JSON.stringify({
      _leiaMe: 'Dependências que apontam para uma camada mais alta e já existiam quando ' +
               'as fronteiras foram criadas. Lista só encolhe: nunca acrescente à mão.',
      violacoes,
    }, null, 2) + '\n');
    console.log('baseline regravada com ' + violacoes.length + ' violação(ões)');
    return;
  }

  const base = fs.existsSync(BASELINE)
    ? new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).violacoes)
    : new Set();

  /* higiene simples */
  const higiene = [];
  for (const m of info) {
    const bruto = fs.readFileSync(path.join(SRC, m.rel), 'utf8');
    if (!bruto.endsWith('\n')) higiene.push(m.rel + ': não termina com quebra de linha');
    if (bruto.includes('\r')) higiene.push(m.rel + ': tem CR (o build espera LF)');
  }
  for (const rel of ['index.html', 'build.manifest.json']) {
    if (!fs.existsSync(path.join(SRC, rel))) higiene.push('falta src/' + rel);
  }

  const novas = violacoes.filter(v => !base.has(v));
  const resolvidas = [...base].filter(v => !violacoes.includes(v));

  console.log(modulos.length + ' módulos, ' + arestas.length + ' dependências entre arquivos');
  console.log('violações de camada: ' + violacoes.length +
    ' (na baseline: ' + base.size + ', novas: ' + novas.length + ')');
  const grandes = info.filter(m => m.linhas > 400).sort((a, b) => b.linhas - a.linhas);
  if (grandes.length) {
    console.log('módulos acima de 400 linhas (candidatos a nova divisão):');
    grandes.forEach(m => console.log('  ' + String(m.linhas).padStart(5) + '  ' + m.rel));
  }
  if (resolvidas.length) {
    console.log('violações da baseline que já não existem — tire da lista com --baseline:');
    resolvidas.slice(0, 20).forEach(v => console.log('  ' + v));
  }

  let falhou = false;
  if (novas.length) {
    falhou = true;
    console.error('\ndependência nova apontando para uma camada mais alta:');
    novas.forEach(v => console.error('  ' + v));
    console.error('Mova o código para a camada certa ou inverta a dependência.');
  }
  if (higiene.length) {
    falhou = true;
    console.error('\nhigiene:');
    higiene.forEach(h => console.error('  ' + h));
  }
  process.exit(falhou ? 1 : 0);
}

main();
