/* ── Driver do Chrome DevTools Protocol, sem dependência nenhuma ──────────

   O Node traz `WebSocket` global e a descoberta de alvos é HTTP comum, então
   dirigir um Chrome de verdade não precisa de Puppeteer nem de nada instalado.
   Menos de cem linhas, e a suíte de interface inteira se apoia nelas.

   `avaliar()` envolve o que você manda num `(async()=>{ ... })()`, então dá
   pra usar `await` direto e devolver um objeto — ele volta serializado.     */
'use strict';

/* ── A suíte NÃO escreve na nuvem de produção ────────────────────────────

   Isto nasceu de um estrago real, conferido no banco em 13/09/2026:
   `t_primeirabusca.js` gera um código de sincronização novo a cada execução e
   liga a nuvem — e cada `npm run ui` criava uma linha de verdade no Supabase
   do projeto. Foram **58 linhas** com o prefixo do teste em dois dias, todas
   com revisão 1, nunca mais tocadas.

   O pior não foi o lixo: às 23:00 houve 12 criações numa hora, e o teto de
   proteção é 30. Mais uma rodada em sequência e um usuário real teria ficado
   sem conseguir criar sincronização — o teste quase disparou a defesa que
   existe contra abuso.

   A trava fica aqui, no `conectar()`, e não em cada arquivo: assim nenhum teste
   novo pode reintroduzir o problema por esquecimento. LEITURA continua passando
   — ela é inofensiva e é o que `t_primeirabusca` mede. Só a ESCRITA é barrada.

   Para medir contra a nuvem de verdade, de propósito, use AOII_NUVEM_REAL=1. */
const ESCRITAS_NA_NUVEM = '*/rest/v1/rpc/aoii_put*';

/* Bloquear a escrita seria o reflexo — e trava o fluxo: sem o `aoii_put`
   respondido, o app nunca chega à leitura que o teste cronometra. Então em vez
   de barrar, a gente RESPONDE por ela, com o mesmo JSON que o banco devolveria.
   O app segue o caminho inteiro, e nada sai daqui.

   Leitura (`aoii_get`) continua indo de verdade: ela não cria nada, e é
   justamente o que `t_primeirabusca` mede. */
const RESPOSTA_FALSA_DE_ESCRITA = JSON.stringify({ ok: true, revision: 1 });

async function travarEscritaNaNuvem(cdp) {
  if (process.env.AOII_NUVEM_REAL === '1') {
    console.log('  \x1b[33m! escrita na nuvem LIBERADA (AOII_NUVEM_REAL=1)\x1b[0m');
    return;
  }
  cdp.escritasNaNuvemBarradas = 0;
  cdp.ao('Fetch.requestPaused', async params => {
    try {
      cdp.escritasNaNuvemBarradas++;
      await cdp.enviar('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        /* a resposta forjada e cross-origin: sem os cabecalhos de CORS o
           navegador a descarta e o app entende "sem conexao". O preflight
           OPTIONS cai no mesmo padrao e e respondido por aqui tambem. */
        responseHeaders: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Headers', value: '*' },
          { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { name: 'Access-Control-Max-Age', value: '0' },
        ],
        body: Buffer.from(RESPOSTA_FALSA_DE_ESCRITA).toString('base64'),
      });
    } catch (e) { /* a requisição já morreu; não há o que responder */ }
  });
  await cdp.enviar('Fetch.enable', {
    patterns: [{ urlPattern: ESCRITAS_NA_NUVEM, requestStage: 'Request' }],
  });
}

async function conectar(porta = 9222, tentativas = 40) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      const pagina = alvos.find(a => a.type === 'page' && a.webSocketDebuggerUrl);
      if (pagina) {
        const cdp = await abrir(pagina.webSocketDebuggerUrl);
        await travarEscritaNaNuvem(cdp);
        return cdp;
      }
    } catch (e) { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('não consegui falar com o Chrome na porta ' + porta);
}

function abrir(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pendentes = new Map();
    const ouvintes = new Map();

    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && pendentes.has(m.id)) {
        const { ok, falha } = pendentes.get(m.id);
        pendentes.delete(m.id);
        m.error ? falha(new Error(m.error.message)) : ok(m.result);
      } else if (m.method && ouvintes.has(m.method)) {
        ouvintes.get(m.method).forEach(fn => fn(m.params));
      }
    });
    ws.addEventListener('error', e => reject(new Error('websocket: ' + e.message)));
    ws.addEventListener('open', () => resolve({
      enviar(metodo, params) {
        return new Promise((ok, falha) => {
          const meu = ++id;
          pendentes.set(meu, { ok, falha });
          ws.send(JSON.stringify({ id: meu, method: metodo, params: params || {} }));
        });
      },
      ao(metodo, fn) {
        if (!ouvintes.has(metodo)) ouvintes.set(metodo, []);
        ouvintes.get(metodo).push(fn);
      },
      fechar() { ws.close(); },
    }));
  });
}

/* Avalia uma expressão na página e devolve o valor já desempacotado.
   awaitPromise deixa escrever `await` direto no trecho avaliado. */
async function avaliar(cdp, expressao) {
  const r = await cdp.enviar('Runtime.evaluate', {
    expression: `(async()=>{ ${expressao} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error('na página: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

async function irPara(cdp, url) {
  await cdp.enviar('Page.enable');
  await cdp.enviar('Debugger.enable').catch(() => {});
  await cdp.enviar('DOM.enable').catch(() => {});
  const carregou = new Promise(r => cdp.ao('Page.loadEventFired', r));
  await cdp.enviar('Page.navigate', { url });
  await carregou;
}

async function tirarFoto(cdp, caminho) {
  const fs = require('fs');
  const r = await cdp.enviar('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(caminho, Buffer.from(r.data, 'base64'));
  return caminho;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

/* conecta num alvo especifico, pra dirigir dois "aparelhos" ao mesmo tempo */
function conectarUrl(url) { return abrir(url); }

module.exports = { conectar, conectarUrl, avaliar, irPara, tirarFoto, esperar,
  travarEscritaNaNuvem, ESCRITAS_NA_NUVEM };
