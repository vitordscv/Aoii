#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   O mesmo roteiro de testes/ciclo-sync.test.js, mas contra as funções REAIS de
   homologação no Supabase (aoii_get_homolog / aoii_put_homolog).

   Existe porque o ensaio offline usa uma nuvem de mentira, e mentira nenhuma
   prova nada sozinha. Aqui o Postgres de verdade decide o conflito, compara o
   hash do token e aplica os limites.

     node testes/ciclo-homologacao.js

   Precisa de supabase/migrations/0003_homologacao.sql aplicado. Não encosta na
   tabela `financas`: só em `financas_homolog`, e com ids próprios que ele mesmo
   limpa no fim.

   Fora da suíte de propósito — `npm test` roda sem rede.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { montarMotor, lerAppInterno, CAMINHO_PADRAO } = require('./extrair-motor');

const RAIZ = path.join(__dirname, '..');
const cfg = fs.readFileSync(path.join(RAIZ, 'src', 'storage', 'supabase-config.js'), 'utf8');
const URL_BASE = (/const SUPABASE_URL = '([^']*)'/.exec(cfg) || [])[1];
const CHAVE = (/const SUPABASE_ANON_KEY = '([^']*)'/.exec(cfg) || [])[1];

const CODIGO = 'HOMOLOGA' + Math.random().toString(36).slice(2, 6).toUpperCase();
const SENHA = 'senha do ensaio de homologacao';

let passou = 0, falhou = 0;
const ok = m => { passou++; console.log('  \x1b[32m✓\x1b[0m ' + m); };
const nok = (m, d) => { falhou++; console.log('  \x1b[31m✗\x1b[0m ' + m + (d ? '\n      \x1b[31m' + d + '\x1b[0m' : '')); };
const igual = (real, esp, m) => (real === esp ? ok(m) : nok(m, 'esperado ' + JSON.stringify(esp) + ', veio ' + JSON.stringify(real)));
const verdade = (c, m, d) => (c ? ok(m) : nok(m, d));

/* localStorage de mentira; a rede é de verdade */
function armazenamentoFalso() {
  const mapa = new Map();
  return { getItem: k => (mapa.has(k) ? mapa.get(k) : null), setItem: (k, v) => mapa.set(k, String(v)), removeItem: k => mapa.delete(k) };
}

/* Um "aparelho": contexto próprio, com fetch real. O desvio para as funções de
   homologação é feito aqui, reescrevendo a URL — o código do app fica intacto. */
function criarAparelho(motor) {
  const ctx = {
    Math, JSON, Number, String, Array, Object, Set, Map, Date, isNaN, isFinite,
    parseInt, parseFloat, console, crypto, TextEncoder, TextDecoder, btoa, atob,
    Uint8Array, Promise, Error, AbortController, setTimeout, clearTimeout,
    localStorage: armazenamentoFalso(),
    data: {},
    /* O desvio, e ele é de propósito explícito.

       montarMotor injeta um SUPABASE_URL inválido pra que nenhum teste alcance
       a produção por acidente. Aqui a gente troca esse endereço pelo real E
       redireciona as duas funções pras gêmeas de homologação — nas duas trocas,
       de uma vez. O motor continua sem conseguir sair sozinho: quem abre a
       porta é este arquivo, e só pra `_homolog`. */
    async fetch(url, opcoes) {
      const alvo = String(url)
        .replace('https://projeto-de-teste.invalido', URL_BASE)
        .replace('/rpc/aoii_get', '/rpc/aoii_get_homolog')
        .replace('/rpc/aoii_put', '/rpc/aoii_put_homolog');
      if (alvo.includes('invalido')) throw new Error('o endereço não foi desviado: ' + alvo);
      if (!alvo.includes('_homolog')) throw new Error('recusando chamar função que não é de homologação: ' + alvo);
      return globalThis.fetch(alvo, Object.assign({}, opcoes, {
        headers: Object.assign({}, opcoes && opcoes.headers, { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE }),
      }));
    },
    L: k => k, formatBRL: n => String(n), esc: s => String(s), vibrate: () => {},
    uid: () => 'id-' + Math.random().toString(36).slice(2, 10),
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(motor, ctx, { filename: 'motor-homologacao.js' });
  return ctx;
}

/* fala com a tabela de homologação por REST, para semear e limpar */
async function rest(caminho, opcoes) {
  const res = await globalThis.fetch(URL_BASE + '/rest/v1/' + caminho, Object.assign({
    headers: {
      apikey: CHAVE, Authorization: 'Bearer ' + CHAVE,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
  }, opcoes || {}));
  return res;
}

const dadosDe = (saldo, nome) => ({
  schemaVersion: 1, saldoAtual: saldo, dinheiroVivo: 0,
  cartoes: [{ id: 'c1', nome: nome || 'Nubank', limite: 2000 }],
  transacoes: [], faturas: [], entradasExtras: [], comprasPlanejadas: [], metas: [],
});

async function main() {
  if (!URL_BASE || !CHAVE) { console.error('não achei a configuração do Supabase'); process.exit(1); }

  /* a tabela de homologação existe? */
  const teste = await rest('financas_homolog?select=id&limit=1');
  if (teste.status === 404) {
    console.error('\n  A tabela financas_homolog não existe.');
    console.error('  Aplique supabase/migrations/0003_homologacao.sql antes de rodar isto.\n');
    process.exit(2);
  }

  console.log('\n\x1b[1mCiclo contra a homologação real\x1b[0m  (' + CODIGO + ')');
  const motor = montarMotor(CAMINHO_PADRAO);
  const A = criarAparelho(motor);
  const B = criarAparelho(motor);

  try {
    /* ── 1. registro antigo, em texto puro, sem token ── */
    await rest('financas_homolog', {
      method: 'POST',
      body: JSON.stringify({ id: CODIGO, data: dadosDe(1000), revision: 0 }),
    });
    const semeado = await (await rest('financas_homolog?id=eq.' + CODIGO + '&select=write_token_hash,revision')).json();
    igual(semeado[0].write_token_hash, null, 'registro antigo entra sem token de escrita');

    /* ── 2. abrir reconhece migração ── */
    const abrir = await A.abrirSincronizacao(CODIGO, SENHA);
    igual(abrir.resultado, 'migrar', 'o Postgres devolve texto puro e o app reconhece como migração');
    igual(abrir.dados.saldoAtual, 1000, 'com os dados de lá');

    /* ── 3. migração ── */
    const mig = await A.migrarParaCifrado(abrir.dados);
    igual(mig.resultado, 'enviado', 'a migração grava, relê e decifra de volta');
    igual(mig.revisao, 1, 'revisão 1');

    /* ── 4. o que está guardado ── */
    const linha = await (await rest('financas_homolog?id=eq.' + CODIGO + '&select=data,revision,write_token_hash')).json();
    const bruto = JSON.stringify(linha[0].data);
    igual(linha[0].data.aoii, 'sync', 'o servidor guarda um envelope');
    igual(bruto.includes('Nubank'), false, 'sem o nome do cartão');
    igual(bruto.includes('saldoAtual'), false, 'sem os nomes dos campos');
    verdade(linha[0].write_token_hash !== null, 'e a linha ganhou o hash do token');
    igual(Object.keys(linha[0].data).sort().join(','),
      'aoii,cipher,device_id,format_version,kdf,revision,updated_at',
      'e nada além do envelope');

    /* ── 5. segundo aparelho ── */
    const abrirB = await B.abrirSincronizacao(CODIGO, SENHA);
    igual(abrirB.resultado, 'aberta', 'o segundo aparelho decifra com a mesma senha');
    const gravB = await B.enviarParaNuvem(dadosDe(1100));
    igual(gravB.resultado, 'enviado', 'e grava — o token derivado bate com o que está no banco');
    igual(gravB.revisao, 2, 'revisão 2');

    /* ── 6. senha errada ── */
    const C = criarAparelho(motor);
    igual((await C.abrirSincronizacao(CODIGO, 'senha errada')).resultado, 'senha-errada',
      'senha errada não abre');

    /* token errado direto na função, sem passar pelo app */
    const tokenErrado = await (await rest('rpc/aoii_put_homolog', {
      method: 'POST',
      body: JSON.stringify({ p_id: CODIGO, p_data: { x: 1 }, p_expected_revision: 2, p_write_token: 'z'.repeat(64) }),
    })).json();
    igual(tokenErrado.erro, 'token', 'o Postgres recusa token errado');
    const depoisDoTokenErrado = await (await rest('financas_homolog?id=eq.' + CODIGO + '&select=revision')).json();
    igual(depoisDoTokenErrado[0].revision, 2, 'e não gravou nada');

    /* ── 7. conflito ── */
    igual(A.sync.revisao, 1, 'A ainda está na revisão 1');
    const conflito = await A.enviarParaNuvem(dadosDe(1200));
    igual(conflito.resultado, 'conflito', 'o Postgres devolve conflito');
    igual(conflito.revisao, 2, 'com a revisão de lá');
    const aposConflito = await (await rest('financas_homolog?id=eq.' + CODIGO + '&select=revision')).json();
    igual(aposConflito[0].revision, 2, 'e nada foi sobrescrito');

    /* ── 8. resolver lendo antes ── */
    const releu = await A.receberDaNuvem();
    igual(releu.resultado, 'novidade', 'A relê');
    igual(releu.dados.saldoAtual, 1100, 'e recebe o que B gravou');
    igual((await A.enviarParaNuvem(dadosDe(1200))).resultado, 'enviado', 'agora a gravação passa');

    /* ── 9. rede ── */
    const D = criarAparelho(motor);
    await D.abrirSincronizacao(CODIGO, SENHA);
    const fetchBom = D.fetch;
    D.fetch = async () => { throw new Error('falha de rede'); };
    igual((await D.enviarParaNuvem(dadosDe(9999))).resultado, 'sem-conexao', 'queda de rede é desfecho nomeado');
    const durante = await (await rest('financas_homolog?id=eq.' + CODIGO + '&select=revision')).json();
    igual(durante[0].revision, 3, 'e nada foi gravado durante a queda');

    /* ── 10. retomada ── */
    D.fetch = fetchBom;
    await D.receberDaNuvem();
    igual((await D.enviarParaNuvem(dadosDe(1400))).resultado, 'enviado', 'com a rede de volta, retoma');

    /* ── 11. limites do servidor ── */
    const gigante = { grande: 'x'.repeat(6 * 1024 * 1024) };
    const porTamanho = await (await rest('rpc/aoii_put_homolog', {
      method: 'POST',
      body: JSON.stringify({ p_id: CODIGO + 'BIG', p_data: gigante, p_expected_revision: 0, p_write_token: 't'.repeat(64) }),
    })).json();
    igual(porTamanho.erro, 'tamanho', 'o servidor recusa payload acima de 5 MB');

    const idCurto = await (await rest('rpc/aoii_put_homolog', {
      method: 'POST',
      body: JSON.stringify({ p_id: 'curto', p_data: { x: 1 }, p_expected_revision: 0, p_write_token: 't'.repeat(64) }),
    })).json();
    igual(idCurto.erro, 'id', 'e id curto demais');

    /* ── 12. aoii_get só lê pelo id exato ── */
    const inexistente = await (await rest('rpc/aoii_get_homolog', {
      method: 'POST', body: JSON.stringify({ p_id: 'NAOEXISTE0000' }),
    })).json();
    igual(inexistente, null, 'aoii_get de um id que não existe devolve nulo');

    /* ── 13. criação abusiva ──
       Só roda se 0005 estiver aplicado. O teto de homologação é baixo (10) de
       propósito, pra dar pra bater nele em segundos. */
    const temLimites = (await rest('rpc/aoii_put_homolog', {
      method: 'POST',
      body: JSON.stringify({ p_id: 'ABUSO000000', p_data: { x: 1 }, p_expected_revision: 0, p_write_token: 'a'.repeat(64) }),
    }));
    const primeira = await temLimites.json();
    if (primeira && primeira.erro === 'limite-criacao') {
      ok('o teto de criação já estava batido — é o próprio limite funcionando');
    } else {
      let recusouEm = null;
      for (let i = 1; i <= 20 && recusouEm === null; i++) {
        const r = await (await rest('rpc/aoii_put_homolog', {
          method: 'POST',
          body: JSON.stringify({ p_id: 'ABUSO' + String(i).padStart(6, '0'), p_data: { x: i }, p_expected_revision: 0, p_write_token: 'a'.repeat(64) }),
        })).json();
        if (r && r.erro === 'limite-criacao') recusouEm = i;
      }
      if (recusouEm === null) {
        nok('criação em massa é barrada por um teto',
          '20 linhas criadas em sequência sem recusa — 0005_homologacao_limites.sql não está aplicado');
      } else {
        ok('criação em massa é barrada: recusou na ' + recusouEm + 'ª linha nova seguida');
        const aindaAtualiza = await (await rest('rpc/aoii_put_homolog', {
          method: 'POST',
          body: JSON.stringify({ p_id: CODIGO, p_data: { toque: 1 }, p_expected_revision: 4, p_write_token: 'z'.repeat(64) }),
        })).json();
        verdade(aindaAtualiza.erro !== 'limite-criacao',
          'e o teto não atrapalha quem já tem linha: atualizar continua permitido',
          'atualizar não pode cair no limite de CRIAÇÃO');
      }
    }

  } finally {
    /* Limpa tudo que este ensaio criou. Depende da política de DELETE que
       0005_homologacao_limites.sql cria — sem ela, o DELETE devolve 204 e não
       apaga nada, e as sobras vão empurrando o teto de criação. */
    const antes = (await (await rest('financas_homolog?select=id')).json()).length;
    await rest('financas_homolog?id=like.HOMOLOGA*', { method: 'DELETE' });
    await rest('financas_homolog?id=like.ABUSO*', { method: 'DELETE' });
    await rest('financas_homolog?id=like.PROBE*', { method: 'DELETE' });
    const depois = (await (await rest('financas_homolog?select=id')).json()).length;
    if (depois === 0) console.log('\n  faxina: ' + antes + ' linha(s) de ensaio removidas');
    else console.log('\n  \x1b[33mfaxina incompleta: sobraram ' + depois + ' linha(s).' +
      ' Falta a política de DELETE de 0005_homologacao_limites.sql.\x1b[0m');
  }

  console.log('\n' + '─'.repeat(58));
  if (falhou === 0) { console.log('\x1b[32m\x1b[1m' + passou + ' verificações passaram contra o banco real.\x1b[0m'); process.exit(0); }
  console.log('\x1b[31m\x1b[1m' + falhou + ' falha(s)\x1b[0m de ' + (passou + falhou) + '.'); process.exit(1);
}

main().catch(e => { console.error('\n\x1b[31m' + (e && e.stack || e) + '\x1b[0m'); process.exit(1); });
