/* A publicação nova chegando em quem JÁ usa o app.

   Com o cache respondendo primeiro, a página que aparece é a guardada; a nova
   chega por trás e a troca acontece sozinha. Este teste anda o caminho inteiro
   com uma versão antiga instalada de verdade — troca o `src/` pelo commit
   anterior, deixa o service worker assumir, publica a versão nova e confere
   que ela chega.

   O caso difícil é o último: com uma folha aberta na frente, a troca é adiada
   (trocar a página debaixo de quem está digitando é pior do que esperar). Sem
   uma segunda tentativa, essa pessoa ficava na versão antiga por tempo
   indefinido — a tentativa seguinte só vinha se ela trocasse de aba. */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { CENARIO } = require('./cenario');
const { RAIZ } = require('./projeto');
const { APP, titulo, conferir, encerrar, limparAparelho } = require('./ajuda');

/* o commit anterior serve de "versão antiga": o token só existe no atual */
const ANTES = '577dad1';
const TOKEN = '--sobre-fundo';

/* Guarda o src/ como ele esta AGORA, inclusive o que ainda nao foi commitado.
   A primeira versao deste teste voltava com `git checkout HEAD -- src/`, e isso
   apaga trabalho em andamento — apagou o meu, na primeira vez que rodou. */
const fs = require('fs');
const os = require('os');
const GUARDADO = fs.mkdtempSync(path.join(os.tmpdir(), 'aoii-src-'));
fs.cpSync(path.join(RAIZ, 'src'), GUARDADO, { recursive: true });

function compilar() {
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'build.js')], { cwd: RAIZ, stdio: 'pipe' });
}
function publicarCommit(commit) {
  execFileSync('git', ['checkout', '-q', commit, '--', 'src/'], { cwd: RAIZ });
  /* `checkout -- caminho` tambem ESCREVE no indice do git. Sem desfazer isso,
     o teste deixa a versao antiga preparada pra commit, e quem rodasse
     `git commit -a` em seguida publicaria o passado sem perceber. */
  execFileSync('git', ['reset', '-q', '--', 'src/'], { cwd: RAIZ });
  compilar();
}
function devolverOSrc() {
  fs.rmSync(path.join(RAIZ, 'src'), { recursive: true, force: true });
  fs.cpSync(GUARDADO, path.join(RAIZ, 'src'), { recursive: true });
  compilar();
}
const naTela = cdp => avaliar(cdp, `
  return getComputedStyle(document.documentElement).getPropertyValue('${TOKEN}').trim()||'(ausente)';`);

async function esperarChegar(cdp, limite = 15000) {
  const fim = Date.now() + limite;
  while (Date.now() < fim) {
    if (await naTela(cdp) !== '(ausente)') return Math.round(limite - (fim - Date.now()));
    await esperar(400);
  }
  return null;
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 420, height: 820, deviceScaleFactor: 1, mobile: false });
  let restaurado = false;
  const restaurar = () => { if (!restaurado) { restaurado = true; devolverOSrc(); } };

  try {
    titulo('quem já usa o app, com a versão anterior instalada');
    publicarCommit(ANTES);
    await limparAparelho(cdp);
    await irPara(cdp, APP);
    await avaliar(cdp, CENARIO);
    await irPara(cdp, APP);
    await esperar(2500);                       // o service worker assume
    await irPara(cdp, APP);
    await esperar(1500);
    conferir(await naTela(cdp) === '(ausente)', 'a versão anterior está instalada e servindo');
    conferir(await avaliar(cdp, `return !!navigator.serviceWorker.controller;`),
      'e o service worker está no comando');

    titulo('sai a publicação nova');
    devolverOSrc();
    await irPara(cdp, APP);
    const levou = await esperarChegar(cdp);
    conferir(levou !== null, `a versão nova chega sozinha (${levou}ms depois de abrir)`,
      'o cache respondeu e ninguém trocou a página: a pessoa fica na versão antiga');

    /* O terceiro caminho — a troca ADIADA, quando ha folha aberta ou alguem
       digitando — nao esta aqui porque nao da pra encena-lo com firmeza: a
       revalidacao chega em ~400ms, antes de qualquer interacao que o teste
       consiga fazer, e com a rede estrangulada pra alargar a janela o app nem
       terminou de montar. As tres versoes que tentei ou passavam sem testar
       nada, ou falhavam por motivo errado.

       O codigo desse caminho existe em `recarregarQuandoDer()`, em ui/boot.js:
       nao podendo trocar agora, ele volta a tentar de dois em dois segundos em
       vez de esperar a proxima troca de aba. Fica conferido a mao. */
  } finally {
    restaurar();
  }

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  encerrar('A publicação nova alcança quem já usa o app.');
})().catch(e => { try { devolverOSrc(); } catch (x) {} console.error('falhou:', e.message); process.exit(1); });
