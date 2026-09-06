/* Uma nuvem de mentira que se comporta como a de verdade.

   Reproduz o que aoii_get e aoii_put fazem no Postgres, statement por
   statement (supabase/migrations/0001_sync_seguro.sql). Serve para ensaiar o
   ciclo sem rede — e o mesmo roteiro de ensaio roda depois contra as funções
   reais em homologação, por testes/ciclo-homologacao.js.

   Se um dia o SQL mudar e isto não mudar junto, o ensaio passa a mentir. Por
   isso o roteiro é o mesmo nos dois lugares: o de homologação é a prova. */
const crypto = require('crypto');

function sha256Hex(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

function criarNuvemFalsa() {
  const linhas = new Map();
  let quedaDeRede = false;
  const registro = [];

  const nuvem = {
    linhas,
    registro,
    derrubarRede(v) { quedaDeRede = v !== false; },
    religarRede() { quedaDeRede = false; },

    get(p_id) {
      const l = linhas.get(p_id);
      if (!l) return null;
      return { data: l.data, revision: l.revision, device_id: l.device_id, updated_at: l.updated_at };
    },

    put(p_id, p_data, p_expected_revision, p_write_token) {
      if (p_id == null || p_id.length < 8 || p_id.length > 64) return { erro: 'id' };
      if (p_write_token == null || p_write_token.length < 32) return { erro: 'token' };
      if (JSON.stringify(p_data).length > 5 * 1024 * 1024) return { erro: 'tamanho' };

      const hash = sha256Hex(p_write_token);
      const atual = linhas.get(p_id);

      if (!atual) {
        linhas.set(p_id, {
          data: p_data, revision: 1, device_id: (p_data && p_data.device_id) || null,
          write_token_hash: hash, updated_at: new Date().toISOString(),
        });
        return { ok: true, revision: 1 };
      }
      if (atual.write_token_hash != null && atual.write_token_hash !== hash) return { erro: 'token' };
      if ((p_expected_revision == null ? -1 : p_expected_revision) !== atual.revision) {
        return { conflito: true, revision: atual.revision };
      }
      atual.data = p_data;
      atual.revision = atual.revision + 1;
      atual.device_id = (p_data && p_data.device_id) || null;
      atual.write_token_hash = hash;
      atual.updated_at = new Date().toISOString();
      return { ok: true, revision: atual.revision };
    },

    /* põe uma linha do formato antigo, em texto puro e sem token */
    semearRegistroAntigo(p_id, objeto) {
      linhas.set(p_id, {
        data: objeto, revision: 0, device_id: null,
        write_token_hash: null, updated_at: new Date().toISOString(),
      });
    },
  };

  /* o fetch que o app enxerga */
  nuvem.fetch = async (url, opcoes) => {
    if (quedaDeRede) throw new Error('falha de rede');
    const corpo = JSON.parse(opcoes.body);
    const qual = url.endsWith('aoii_get') ? 'get' : url.endsWith('aoii_put') ? 'put' : null;
    if (!qual) throw new Error('rpc desconhecida: ' + url);
    registro.push({ qual, corpo });
    const r = qual === 'get'
      ? nuvem.get(corpo.p_id)
      : nuvem.put(corpo.p_id, corpo.p_data, corpo.p_expected_revision, corpo.p_write_token);
    return { ok: true, status: 200, json: async () => r };
  };

  return nuvem;
}

/* localStorage de mentira, um por "aparelho" */
function criarArmazenamentoFalso() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _mapa: m,
  };
}

module.exports = { criarNuvemFalsa, criarArmazenamentoFalso, sha256Hex };
