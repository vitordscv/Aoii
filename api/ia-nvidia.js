/* ── Ponte para a IA da NVIDIA ─────────────────────────────────────────────

   Mesma razão do api/pierre.js: o servidor da NVIDIA responde o preflight sem
   `Access-Control-Allow-Origin` (conferido em 17/11/2026), então o navegador
   não consegue chamá-lo direto. O app chama a própria origem e daqui a
   pergunta sai de um servidor, onde CORS não se aplica.

   **A chave é de quem está usando, e não fica aqui.** Chega no cabeçalho de
   cada chamada, é repassada e some quando a resposta volta. Nada é
   registrado — nem a chave, nem a pergunta, nem a resposta, que levam o
   resumo financeiro da pessoa.

   **O modelo é fixo, escolhido aqui.** Sem isso a função viraria uma ponte
   aberta para qualquer modelo pago da conta de quem chama. O escolhido foi o
   que se saiu melhor no teste com dados fictícios (acertou as contas,
   respondeu em ~6 s e não devolveu resposta vazia). Trocar de modelo é mudar
   esta linha e refazer aquele teste — ver docs/SECURITY.md. */
'use strict';

const URL_NVIDIA = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODELO = 'nvidia/nemotron-3-ultra-550b-a55b';
const TEMPO_LIMITE = 55000;
/* o resumo financeiro + regras + conversa cabem com folga em 40 mil caracteres */
const TAMANHO_MAXIMO = 40000;

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

/* A Vercel já entrega req.body lido; o servidor de desenvolvimento não. */
function lerCorpo(req) {
  if (req.body !== undefined) {
    return Promise.resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  }
  return new Promise((resolve, reject) => {
    let texto = '';
    req.on('data', parte => {
      texto += parte;
      if (texto.length > TAMANHO_MAXIMO * 2) { reject(new Error('grande')); req.destroy(); }
    });
    req.on('end', () => resolve(texto));
    req.on('error', reject);
  });
}

/* alguns modelos de raciocínio devolvem o "pensamento" antes da resposta */
function soAResposta(texto) {
  return String(texto || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') {
    return responder(res, 405, { erro: 'metodo', mensagem: 'Só POST.' });
  }

  const chave = req.headers.authorization || '';
  if (!/^Bearer\s+nvapi-[A-Za-z0-9_-]{20,}$/.test(chave)) {
    return responder(res, 401, {
      erro: 'sem-chave',
      mensagem: 'Falta a chave da NVIDIA, no formato "Bearer nvapi-…".',
    });
  }

  let prompt;
  try {
    const corpo = JSON.parse(await lerCorpo(req) || '{}');
    prompt = corpo && corpo.prompt;
  } catch (e) {
    return responder(res, 400, { erro: 'corpo', mensagem: 'Corpo inválido.' });
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > TAMANHO_MAXIMO) {
    return responder(res, 400, { erro: 'prompt', mensagem: 'Pergunta vazia ou grande demais.' });
  }

  const corta = new AbortController();
  const relogio = setTimeout(() => corta.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(URL_NVIDIA, {
      method: 'POST',
      signal: corta.signal,
      headers: { Authorization: chave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'user', content: prompt }],
        /* baixa: num app de dinheiro a mesma pergunta deve dar a mesma resposta */
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    if (!r.ok) {
      /* devolve só o status: o corpo do erro pode ecoar a chave ou o prompt */
      const status = [401, 403, 429].includes(r.status) ? r.status : (r.status >= 500 ? 503 : 502);
      return responder(res, status, { erro: 'nvidia', status: r.status });
    }
    const json = await r.json();
    const texto = soAResposta(json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content);
    if (!texto) return responder(res, 502, { erro: 'vazio' });
    return responder(res, 200, { texto });
  } catch (e) {
    return responder(res, 504, { erro: 'tempo', mensagem: 'A NVIDIA não respondeu a tempo.' });
  } finally {
    clearTimeout(relogio);
  }
};
