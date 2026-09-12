/* ── Driver do Chrome DevTools Protocol, sem dependência nenhuma ──────────

   O Node traz `WebSocket` global e a descoberta de alvos é HTTP comum, então
   dirigir um Chrome de verdade não precisa de Puppeteer nem de nada instalado.
   Menos de cem linhas, e a suíte de interface inteira se apoia nelas.

   `avaliar()` envolve o que você manda num `(async()=>{ ... })()`, então dá
   pra usar `await` direto e devolver um objeto — ele volta serializado.     */
'use strict';

async function conectar(porta = 9222, tentativas = 40) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json();
      const pagina = alvos.find(a => a.type === 'page' && a.webSocketDebuggerUrl);
      if (pagina) return abrir(pagina.webSocketDebuggerUrl);
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

module.exports = { conectar, conectarUrl, avaliar, irPara, tirarFoto, esperar };
