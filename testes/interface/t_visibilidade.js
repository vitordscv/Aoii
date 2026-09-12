/* O aparelho passa a buscar da nuvem quando volta pra tela.

   Medir a leitura de verdade daria trabalho sem valor: sem código de
   sincronização configurado, puxarDaNuvem() sai na primeira guarda e nenhum
   fetch acontece — e configurar sincronização de verdade significaria escrever
   no Supabase de produção. Então mede-se o que é honesto medir: quantos
   ouvintes de visibilitychange a página viva registra, e a folga contra
   rajada. O arquivo publicado confirma quem chama o quê. */
'use strict';
const { conectar, irPara, esperar } = require('./cdp');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:4173/';
const DIST = process.env.AOII_DIST || require('./projeto').DIST_HTML;
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log('  \x1b[32mok\x1b[0m ' + m)
  : (falhas++, console.log('  \x1b[31m!!\x1b[0m ' + m + (d ? '\n       ' + d : ''))); };

(async () => {
  const cdp = await conectar();
  await irPara(cdp, URL);
  await esperar(1600);

  const doc = await cdp.enviar('Runtime.evaluate', { expression: 'document' });
  const { listeners } = await cdp.enviar('DOMDebugger.getEventListeners',
    { objectId: doc.result.objectId, depth: 1 });
  const vis = listeners.filter(l => l.type === 'visibilitychange');

  console.log('\n  == na página viva ==');
  console.log('     ouvintes de visibilitychange: ' + vis.length +
              ' (linhas ' + vis.map(l => l.lineNumber).join(', ') + ')');
  /* um é o de setupAutoUpdate, que checa versão nova; o outro é o novo */
  conferir(vis.length === 2, 'há dois ouvintes: o da atualização e o da sincronização',
    'esperava 2 — antes desta mudança havia só o de setupAutoUpdate');

  console.log('\n  == no arquivo publicado ==');
  const src = fs.readFileSync(DIST, 'utf8');
  const bloco = /addEventListener\('visibilitychange',\(\)=>\{[\s\S]{0,400}?cicloDeSincronizacao\(\);?\s*\}\)/.exec(src);
  conferir(!!bloco, 'o ouvinte novo chama cicloDeSincronizacao()',
    'não achei a ligação no dist — o celular continuaria esperando os 20 s');
  conferir(/_ultimaBusca<3000/.test(src), 'e passa pela folga de 3 s');
  conferir(/setInterval\(cicloDeSincronizacao,20000\)/.test(src),
    'o relógio de 20 s continua lá como rede de segurança');

  /* a regra da folga, em isolado */
  console.log('\n  == a folga de 3 s ==');
  let chamadas = 0, ultima = 0;
  const T0 = 1750000000000;          // um Date.now() de verdade, enorme
  const agora = { t: T0 };
  const aoVoltar = () => { if (agora.t - ultima < 3000) return; ultima = agora.t; chamadas++; };
  agora.t = T0;        aoVoltar();   // primeira: passa
  agora.t = T0 + 200;  aoVoltar();   // rajada: barrada
  agora.t = T0 + 900;  aoVoltar();   // rajada: barrada
  agora.t = T0 + 2999; aoVoltar();   // ainda dentro: barrada
  agora.t = T0 + 3001; aoVoltar();   // passou a folga: passa
  conferir(chamadas === 2, `cinco voltas em 3 s viram ${chamadas} buscas (esperado 2)`);

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mBusca ligada ao voltar pra tela.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
