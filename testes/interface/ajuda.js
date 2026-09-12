/* ── O que todo teste de interface repete ─────────────────────────────────

   `conferir()` guarda a contagem de falhas no próprio módulo, e `encerrar()`
   sai com o código certo. Sem isso cada arquivo mantinha o seu contador, e
   dois deles já esqueceram de somar uma falha ao total.

   `limparAparelho()` é o começo de quase todo teste: o service worker guarda
   a página, e sem apagá-lo o teste roda contra a versão anterior do app e mede
   o código errado — aconteceu, e demorou a aparecer.                        */
'use strict';
const { avaliar, irPara, esperar } = require('./cdp');

const APP = 'http://localhost:4173/';

let falhas = 0;
let conferidas = 0;

function titulo(t) { console.log(`\n  \x1b[1m${t}\x1b[0m`); }

function conferir(condicao, mensagem, detalhe) {
  conferidas++;
  if (condicao) { console.log(`  \x1b[32mok\x1b[0m ${mensagem}`); return true; }
  falhas++;
  console.log(`  \x1b[31m!!\x1b[0m ${mensagem}${detalhe ? '\n       ' + detalhe : ''}`);
  return false;
}

function encerrar(frase) {
  console.log('  ' + '─'.repeat(54));
  console.log(falhas === 0
    ? `  \x1b[32m${frase || conferidas + ' conferência(s), tudo certo.'}\x1b[0m`
    : `  \x1b[31m${falhas} de ${conferidas} falharam.\x1b[0m`);
  process.exit(falhas === 0 ? 0 : 1);
}

/* Apaga tudo que sobrevive entre execuções: dados, sessão, caches e o service
   worker. Sem isso um teste herda o estado do anterior — ou, pior, a página
   guardada de uma versão antiga do app. */
async function limparAparelho(cdp) {
  /* `Storage.clearDataForOrigin` apaga de FORA da pagina: localStorage, caches,
     service workers e o resto, sem depender de a pagina ter carregado a ponto
     de rodar o JS da limpeza. Limpar por dentro passava na maquina descansada e
     deixava estado para tras quando o teste era o decimo oitavo da fila. */
  try {
    await cdp.enviar('Storage.clearDataForOrigin', {
      origin: new URL(APP).origin,
      storageTypes: 'local_storage,cache_storage,service_workers,indexeddb,websql,shader_cache',
    });
  } catch (e) { /* versao de Chrome sem o comando: a limpeza por dentro cobre */ }
  await irPara(cdp, APP);
  await avaliar(cdp, `
    try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
    if(navigator.serviceWorker){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
    if(window.caches){
      const ns=await caches.keys();
      await Promise.all(ns.map(n=>caches.delete(n)));
    }
    return 1;`).catch(() => {});
}

/* Abre o app pronto pra uso: com o cenário dentro e sem onboarding na frente.
   Passe `{cenario:false}` pra ver a primeira experiência de quem chega agora. */
async function abrirApp(cdp, opcoes) {
  const { cenario = true, largura = 390, altura = 844 } = opcoes || {};
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: largura, height: altura, deviceScaleFactor: 2, mobile: largura < 700 });
  if (cenario) {
    await irPara(cdp, APP);
    await avaliar(cdp, require('./cenario').CENARIO);
  }
  await irPara(cdp, APP);
  await esperar(1700);
  await avaliar(cdp, `
    document.getElementById('ob-skip-btn')?.click();
    await new Promise(r=>setTimeout(r,500));
    document.querySelector('.tour-skip')?.click();
    await new Promise(r=>setTimeout(r,400));
    return 1;`);
}

/* Vai pra uma das cinco telas, e opcionalmente pra uma aba dentro dela. */
async function irParaTela(cdp, tela, aba) {
  await avaliar(cdp, `
    document.querySelector('.bn-item[data-target="view-${tela}"]')?.click();
    await new Promise(r=>setTimeout(r,450));
    ${aba ? `document.getElementById('${aba}')?.click(); await new Promise(r=>setTimeout(r,600));` : ''}
    return 1;`);
}

module.exports = { APP, titulo, conferir, encerrar, limparAparelho, abrirApp, irParaTela };
