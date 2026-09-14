#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Quais funções do motor a suíte chega a EXECUTAR.

     npm run cobertura

   Existe por causa de um erro. Procurando o nome de cada função nos arquivos
   de teste, concluí que `moverSaldoParaMeta()` — que tira dinheiro da conta e
   põe numa meta — não tinha cobertura nenhuma, e disse isso. Tinha: ela é
   exercitada três vezes, por dentro dos comandos que a chamam, com verificação
   de saldo e de conservação do patrimônio. O nome dela simplesmente nunca
   aparece num teste, porque ninguém a chama direto.

   A conta por texto erra nos dois sentidos: dá por descoberto o que só é
   chamado de dentro de outra função, e dá por coberto o que aparece só num
   comentário. Aqui o ambiente é instrumentado de verdade — cada função do
   contexto vira um embrulho que conta chamadas — e a suíte roda por cima.

   O que sobrar na lista não é necessariamente falta: boa parte é dublê do
   próprio ambiente de teste (`esc`, `vibrate`, `catIcon`) e encanamento que
   depende de navegador. O que importa é o que faz conta com dinheiro.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ambiente = require('./ambiente');
const chamadas = new Map();

/* Dublês do ambiente, não do app: contá-los como "sem cobertura" é ruído. */
const DUBLES = new Set(['esc', 'vibrate', 'catIcon', 'mediana', 'tipoInvest',
  'nomeCartao', 'L', 'formatBRL', 'todayISO', 'isFinite']);

/* Embrulha cada função do contexto num contador. Serve para os dois tipos de
   sandbox que a suíte usa. */
function instrumentar(ctx) {
  for (const nome of Object.keys(ctx)) {
    const valor = ctx[nome];
    if (typeof valor !== 'function' || nome === 'Date') continue;
    if (valor.__contado) continue;
    if (/^[A-Z]/.test(nome) && nome !== 'CATS' && nome !== 'TIPOS_INVEST') continue;
    if (!chamadas.has(nome)) chamadas.set(nome, 0);
    const embrulho = function (...a) {
      chamadas.set(nome, chamadas.get(nome) + 1);
      return valor.apply(this, a);
    };
    embrulho.__contado = true;
    ctx[nome] = embrulho;
  }
  return ctx;
}

const criarOriginal = ambiente.criarAmbiente;
ambiente.criarAmbiente = function (...args) {
  return instrumentar(criarOriginal.apply(this, args));
};

/* ── o furo que esta ferramenta tinha ─────────────────────────────────────

   Ela só enxergava contexto nascido de `criarAmbiente()`. Os testes de nuvem —
   `conflito-real`, `sync-queue`, `ciclo-sync` — montam o PRÓPRIO sandbox com
   `vm.createContext`, porque precisam de `fetch`, `crypto` e `localStorage`
   falsos. Tudo que eles exercitam ficava invisível.

   O efeito foi uma lista de "13 funções sem teste nenhum" em que 7 estavam
   cobertas, inclusive `empurrarParaNuvem()` — que é o coração da resolução de
   conflito e passa por três cenários em `conflito-real.test.js`. A ferramenta
   nasceu para corrigir uma contagem por texto que errava nos dois sentidos, e
   errava nos dois sentidos do mesmo jeito.

   Agora `runInContext` é interceptado: depois que o motor é avaliado dentro de
   um sandbox qualquer, as funções daquele sandbox também entram na conta. */
const vmReal = require('vm');
const rodarOriginal = vmReal.runInContext.bind(vmReal);
vmReal.runInContext = function (codigo, ctx, ...resto) {
  const saida = rodarOriginal(codigo, ctx, ...resto);
  try { if (ctx && typeof ctx === 'object') instrumentar(ctx); } catch (e) {}
  return saida;
};

/* a suíte fala muito; aqui só a contagem interessa */
const escreveu = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;
const t = { igual() {}, valor() {}, verdadeiro() {}, naoNumero() {} };

/* a lista vem do próprio executor: repeti-la aqui seria garantir que um dia
   ela fique para trás, e a medida saia menor do que a realidade */
const arquivos = fs.readFileSync(path.join(__dirname, 'executar.js'), 'utf8')
  .match(/const arquivos=\[([\s\S]*?)\];/)[1]
  .match(/'([^']+)'/g).map(x => x.slice(1, -1));

/* onde cada função mora, pra separar cálculo de encanamento */
function mapaDeArquivos() {
  const onde = {};
  (function anda(dir) {
    for (const n of fs.readdirSync(dir)) {
      const p = path.join(dir, n);
      if (fs.statSync(p).isDirectory()) { anda(p); continue; }
      if (!n.endsWith('.js')) continue;
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/^(?:async )?function ([a-zA-Z_][A-Za-z0-9_]*)\(/gm)) {
        onde[m[1]] = path.relative(path.join(RAIZ, 'src'), p).split(path.sep).join('/');
      }
    }
  })(path.join(RAIZ, 'src'));
  return onde;
}

(async () => {
  for (const f of arquivos) {
    try { await require(path.join(__dirname, f))(t); } catch (e) { /* uma falha aqui é problema de npm test, não daqui */ }
  }
  process.stdout.write = escreveu;

  const onde = mapaDeArquivos();
  const nunca = [...chamadas.entries()]
    .filter(([nome, n]) => n === 0 && !DUBLES.has(nome))
    .map(([nome]) => nome).sort();
  const total = [...chamadas.keys()].filter(n => !DUBLES.has(n)).length;
  const usadas = total - nunca.length;
  const pct = Math.round((usadas / total) * 100);

  console.log(`\n  \x1b[1m${usadas} de ${total} funções do motor são executadas pela suíte (${pct}%)\x1b[0m`);
  if (!nunca.length) { console.log('\n  \x1b[32mTudo que o motor expõe passa por algum teste.\x1b[0m\n'); return; }

  const porArquivo = {};
  for (const n of nunca) {
    const k = onde[n] || '(fora de src/)';
    (porArquivo[k] || (porArquivo[k] = [])).push(n);
  }
  console.log(`\n  ${nunca.length} sem passar por teste nenhum:\n`);
  for (const arq of Object.keys(porArquivo).sort()) {
    const calculo = arq.startsWith('core/');
    console.log(`    ${calculo ? '\x1b[33m' : ''}${arq}\x1b[0m`);
    console.log(`      ${porArquivo[arq].join(', ')}`);
  }
  console.log('\n  \x1b[33mem amarelo\x1b[0m: core/, onde moram as contas — é o que vale cobrir.\n');
})();
