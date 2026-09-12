/* ── Ponte para a API do Pierre Finance ────────────────────────────────────

   O Aoii roda inteiro no navegador. A API do Pierre não manda
   `Access-Control-Allow-Origin` nenhum — conferido contra o servidor: o
   preflight responde 204 sem o cabeçalho, e o `fetch` morre em "Failed to
   fetch" com ou sem Authorization. CORS é decisão de quem serve, então não há
   o que escrever no cliente que resolva. Esta função existe só para isso: o
   app chama a própria origem, e daqui a chamada sai de um servidor, onde CORS
   não se aplica.

   **A chave é de quem está usando, e não fica aqui.** Ela chega no cabeçalho
   de cada chamada, é repassada, e some quando a resposta volta — nada de
   variável de ambiente com a chave de uma pessoa só. Um app usado por três
   pessoas com uma chave do projeto mostraria o extrato de uma para as outras.

   O que isto NÃO resolve: a chave passa por aqui em trânsito. Quem controla
   este deploy poderia registrá-la se quisesse. Por isso nada é registrado, e
   por isso está escrito — quem usa merece saber por onde a credencial passa. */
'use strict';

const BASE = 'https://www.pierre.finance/tools/api/';

/* Lista fechada. Sem isto a função vira um proxy aberto: qualquer um poderia
   mandar `rota=../../algo` ou uma URL inteira e usar este domínio de ponte. */
const ROTAS = new Set([
  'get-accounts',
  'get-balance',
  'get-balance-by-account',
  'get-transactions',
  'get-bills',
  'get-bill-summary',
  'get-installments',
  'get-api-key-info',
]);

/* Só estes viajam adiante. Copiar a query inteira deixaria passar qualquer
   coisa que o cliente inventasse. */
const PARAMETROS = new Set([
  'startDate', 'endDate', 'categories', 'minAmount', 'maxAmount',
  'accountType', 'accountSubtype', 'includeStatus', 'format', 'accountId',
]);

const TEMPO_LIMITE = 15000;

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  /* resposta de dado financeiro não se guarda em cache nenhum */
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

module.exports = async function (req, res) {
  if (req.method !== 'GET') {
    return responder(res, 405, { erro: 'metodo', mensagem: 'Só GET.' });
  }

  const url = new URL(req.url, 'http://interno');
  const rota = url.searchParams.get('rota') || '';
  if (!ROTAS.has(rota)) {
    return responder(res, 400, {
      erro: 'rota',
      mensagem: 'Rota não reconhecida: ' + rota,
    });
  }

  const chave = req.headers.authorization || '';
  if (!/^Bearer\s+sk-\S+$/.test(chave)) {
    return responder(res, 401, {
      erro: 'sem-chave',
      mensagem: 'Falta a chave do Pierre, no formato "Bearer sk-…".',
    });
  }

  const alvo = new URL(BASE + rota);
  for (const [nome, valor] of url.searchParams) {
    if (PARAMETROS.has(nome)) alvo.searchParams.set(nome, valor);
  }

  const corta = new AbortController();
  const relogio = setTimeout(() => corta.abort(), TEMPO_LIMITE);
  try {
    const resposta = await fetch(alvo, {
      headers: { Authorization: chave, Accept: 'application/json' },
      signal: corta.signal,
    });
    const texto = await resposta.text();

    /* 401 do Pierre tem dois motivos bem diferentes, e a pessoa precisa saber
       qual é o dela: chave errada se resolve colando outra, assinatura vencida
       não se resolve dentro do Aoii. */
    if (resposta.status === 401) {
      const semAssinatura = /subscription|assinatura/i.test(texto);
      return responder(res, 401, {
        erro: semAssinatura ? 'sem-assinatura' : 'chave-invalida',
        mensagem: semAssinatura
          ? 'O Pierre respondeu que não há assinatura ativa para esta chave.'
          : 'O Pierre recusou a chave.',
      });
    }

    let corpo;
    try { corpo = JSON.parse(texto); }
    catch (e) {
      return responder(res, 502, {
        erro: 'resposta-estranha',
        mensagem: 'O Pierre respondeu algo que não é JSON.',
      });
    }
    return responder(res, resposta.status, corpo);
  } catch (e) {
    const expirou = e && e.name === 'AbortError';
    return responder(res, expirou ? 504 : 502, {
      erro: expirou ? 'demorou' : 'sem-resposta',
      mensagem: expirou
        ? 'O Pierre demorou mais de 15 segundos para responder.'
        : 'Não deu para falar com o Pierre agora.',
    });
  } finally {
    clearTimeout(relogio);
  }
};
