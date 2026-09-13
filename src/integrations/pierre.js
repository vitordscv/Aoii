/* ── Conversa com o Pierre Finance, pela ponte ─────────────────────────────

   Nada aqui fala com `pierre.finance` direto: a API deles não manda
   `Access-Control-Allow-Origin`, e o navegador recusa antes de sair. Tudo
   passa por `/api/pierre`, uma função na mesma origem do app — ver
   `api/pierre.js`, que explica por que ela existe e o que não resolve.

   A chave viaja no cabeçalho de cada chamada. Ela não fica guardada do outro
   lado; quem guarda é o aparelho de quem usa, em `pierre-key.js`. */

const PIERRE_PONTE = '/api/pierre';
const PIERRE_TEMPO = 25000;
/* estes passam: adianta tentar de novo. 401 e 400 não passam — insistir numa
   chave recusada só gasta o tempo de quem espera */
const PIERRE_PASSAGEIRO = new Set([429, 500, 502, 503, 504]);
const PIERRE_TENTATIVAS = 3;

/* Erro com nome, pra quem chama poder decidir o que dizer sem ler mensagem. */
function ErroPierre(codigo, mensagem) {
  const e = new Error(mensagem || codigo);
  e.codigo = codigo;
  return e;
}

async function chamarPierre(rota, params) {
  const chave = getPierreChave();
  if (!chave) throw ErroPierre('sem-chave', L('pierre.semChave'));

  const url = new URL(PIERRE_PONTE, location.origin);
  url.searchParams.set('rota', rota);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  let ultimo = null;
  for (let tentativa = 1; tentativa <= PIERRE_TENTATIVAS; tentativa++) {
    const corta = new AbortController();
    const relogio = setTimeout(() => corta.abort(), PIERRE_TEMPO);
    try {
      const res = await fetch(url, {
        signal: corta.signal,
        headers: { Authorization: 'Bearer ' + chave },
        cache: 'no-store',
      });
      const corpo = await res.json().catch(() => null);

      if (res.ok && corpo && corpo.success !== false) return corpo;

      /* A ponte devolve o motivo com nome; o Pierre, quando responde direto,
         manda outra coisa. Os dois caem aqui. */
      const codigo = (corpo && corpo.erro) || 'resposta-' + res.status;
      if (!PIERRE_PASSAGEIRO.has(res.status)) {
        throw ErroPierre(codigo, (corpo && (corpo.mensagem || corpo.message)) || L('pierre.erroGenerico'));
      }
      ultimo = ErroPierre(codigo, (corpo && corpo.mensagem) || L('pierre.erroGenerico'));
    } catch (e) {
      if (e.codigo && !PIERRE_PASSAGEIRO.has(Number(String(e.codigo).replace('resposta-', '')))) throw e;
      /* Com o app aberto sem a função por trás — em desenvolvimento sem o
         servidor, ou num arquivo local — o fetch morre aqui. Insistir não
         adianta, e "não deu pra falar" esconderia a causa. */
      if (e.name === 'TypeError') throw ErroPierre('sem-ponte', L('pierre.semPonte'));
      ultimo = e.name === 'AbortError' ? ErroPierre('demorou', L('pierre.demorou')) : e;
    } finally {
      clearTimeout(relogio);
    }
    if (tentativa < PIERRE_TENTATIVAS) await new Promise(r => setTimeout(r, 700 * tentativa));
  }
  throw ultimo || ErroPierre('sem-resposta', L('pierre.erroGenerico'));
}

/* ── o que o app pede ── */

/* Validar a chave é pedir as contas: é a chamada mais barata que só funciona
   com credencial boa, e de quebra já mostra o que está ligado do outro lado. */
async function validarChavePierre() {
  const r = await chamarPierre('get-accounts');
  const corpo = r.data;
  const contas = Array.isArray(corpo) ? corpo : [];
  const instituicoes = [...new Set(contas.map(c => c.connectorName).filter(Boolean))];
  return { contas, instituicoes, quantas: contas.length };
}

function buscarContasPierre() { return validarChavePierre(); }

/* `startDate` em branco faz o Pierre devolver três meses. Quem chama diz o
   período; a rotina de sincronização usa a data do último lançamento trazido. */
async function buscarTransacoesPierre(de, ate) {
  const r = await chamarPierre('get-transactions', {
    startDate: de || '', endDate: ate || '',
    includeStatus: 'POSTED', format: 'raw',
  });
  /* o corpo vai pra uma variavel antes de ser lido: `data` e o nome do objeto
     financeiro do app, e o lint de campos persistidos toma qualquer acesso a
     um campo dele como campo novo — inclusive aqui, onde e a resposta da API */
  const corpo = r.data;
  const lista = Array.isArray(corpo) ? corpo
    : (corpo && Array.isArray(corpo.transactions) ? corpo.transactions : []);
  return { lista, total: r.count || lista.length };
}
