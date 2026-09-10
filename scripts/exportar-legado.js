#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Baixa para arquivos locais as linhas que ainda estão em TEXTO PURO na nuvem.

   Por que isto existe
   -------------------
   A linha ativa foi migrada e está cifrada. Mas os snapshots mensais antigos
   não foram — e o id deles é derivado do código de sincronização:

       AAAA1111        → cifrado
       AAAA1111-snap-2026-9  → texto puro, e o id sai do código

   Quem descobrir o código monta o id do snapshot e lê o mês inteiro pela
   aoii_get, que aceita qualquer id. A criptografia da linha ativa não impede
   isso. Enquanto esses snapshots existirem, ela protege menos do que parece.

   O caminho seguro é: exportar aqui, conferir os arquivos, e só então apagar da
   nuvem (supabase/migrations/0007_apaga_legado.sql).

   Este script NÃO apaga nada e NÃO imprime conteúdo — só nomes e tamanhos.

     node scripts/exportar-legado.js [pasta-de-destino]
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const cfg = fs.readFileSync(path.join(RAIZ, 'src', 'storage', 'supabase-config.js'), 'utf8');
const URL_BASE = (/const SUPABASE_URL = '([^']*)'/.exec(cfg) || [])[1];
const CHAVE = (/const SUPABASE_ANON_KEY = '([^']*)'/.exec(cfg) || [])[1];

const DESTINO = path.resolve(process.argv[2] || path.join(RAIZ, '..', 'aoii-legado-' + new Date().toISOString().slice(0, 10)));

/* Os ids precisam ser conhecidos: a tabela não é listável (é esse o ponto da
   parte 2). Pegue-os no painel com:
     select id from financas where not (data ? 'aoii') order by updated_at desc;  */
const IDS = process.env.AOII_IDS
  ? process.env.AOII_IDS.split(',').map(s => s.trim()).filter(Boolean)
  : [];

async function ler(id) {
  const res = await fetch(URL_BASE + '/rest/v1/rpc/aoii_get', {
    method: 'POST',
    headers: { apikey: CHAVE, Authorization: 'Bearer ' + CHAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_id: id }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}

async function main() {
  if (!URL_BASE || !CHAVE) { console.error('não achei a configuração do Supabase'); process.exit(1); }
  if (!IDS.length) {
    console.error('\n  Informe os ids a exportar em AOII_IDS, separados por vírgula.');
    console.error('  Exemplo:');
    console.error('    AOII_IDS="AAAA1111-snap-2026-9,AAAA1111-snap-2026-8" node scripts/exportar-legado.js\n');
    process.exit(2);
  }

  fs.mkdirSync(DESTINO, { recursive: true });
  let ok = 0, faltaram = [];

  for (const id of IDS) {
    let linha;
    try { linha = await ler(id); }
    catch (e) { faltaram.push(id + ' (' + e.message + ')'); continue; }
    if (!linha || !linha.data) { faltaram.push(id + ' (não existe)'); continue; }

    const cifrada = linha.data && linha.data.aoii === 'sync';
    const arquivo = path.join(DESTINO, id.replace(/[^A-Za-z0-9._-]/g, '_') + '.json');
    fs.writeFileSync(arquivo, JSON.stringify(linha.data, null, 2));
    ok++;
    console.log('  ' + id.padEnd(24) +
      String(fs.statSync(arquivo).size).padStart(8) + ' bytes' +
      (cifrada ? '  (já estava cifrada)' : ''));
  }

  console.log('\n  ' + ok + ' arquivo(s) em ' + DESTINO);
  if (faltaram.length) {
    console.log('  não vieram: ' + faltaram.join(', '));
    process.exit(1);
  }
  console.log('\n  Confira os arquivos antes de apagar qualquer coisa da nuvem.');
}

main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
