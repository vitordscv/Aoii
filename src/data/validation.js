/* ═══════════════════════════════════════════════════════════════════════════
   A fronteira de confiança.

   Tudo que entra no app vindo de fora — arquivo JSON, código de backup em
   base64, resposta do Supabase, o próprio localStorage — passa por aqui antes
   de virar `data`. O que sai daqui obedece a data/schema.js: sem campo
   desconhecido, sem número impossível, sem texto de tamanho arbitrário e sem
   nenhum id que o remetente tenha escolhido.

   Sobre ids: eles vão parar em atributos de HTML e em seletores, então um id
   escolhido por quem manda o backup é uma alavanca. Aqui todo id precisa caber
   em [A-Za-z0-9:_-], no máximo 64 caracteres — sem aspas, sem sinal de maior,
   sem espaço. O que não couber é trocado por um id novo, e as referências entre
   listas (cartaoId, viagemId, parcelamentoId) seguem a troca, então a relação
   sobrevive.

   Trocar *todos* os ids, e não só os inválidos, seria mais radical e pior: o
   app compara o JSON local com o da nuvem pra saber se outro aparelho mexeu, e
   ids novos a cada leitura fariam essa comparação nunca bater — sincronização
   em laço infinito. Restringir o formato fecha o buraco sem esse efeito.

   O resultado nunca é `null` por descuido: ou a entrada é aceita e sai limpa,
   ou `ok` é falso e o app não toca em nada.
   ═══════════════════════════════════════════════════════════════════════════ */

/* chaves que nunca podem virar propriedade de nada que a gente monte */
const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);

/* id aceitável: nada que sirva pra sair de um atributo HTML */
const RE_ID = /^[A-Za-z0-9:_-]{1,64}$/;
function idSeguro(v) {
  return (typeof v === 'string' || typeof v === 'number') && RE_ID.test(String(v));
}

/* número vindo de fora. Aceita "1.234,56" e "1234.56"; recusa o resto. */
function numeroDeFora(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/* Link vindo de fora. Só sobrevive http/https absoluto: qualquer outro
   esquema (javascript:, data:, vbscript:) vira execução ao chegar num href.
   Quem digita "loja.com" ganha o https:// na frente — é o que a pessoa quis. */
function urlSegura(v) {
  if (typeof v !== 'string') return null;
  let bruto = v.trim();
  if (!bruto) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(bruto)) bruto = 'https://' + bruto;
  let u;
  try { u = new URL(bruto); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname) return null;
  return u.href;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})?$/;

function ehObjetoSimples(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* profundidade máxima, checada antes de qualquer travessia cara */
function profundidadeAcima(v, limite, nivel) {
  nivel = nivel || 0;
  if (nivel > limite) return true;
  if (v === null || typeof v !== 'object') return false;
  for (const k of Object.keys(v)) {
    if (profundidadeAcima(v[k], limite, nivel + 1)) return true;
  }
  return false;
}

/* ── um campo ──
   Devolve o valor limpo, ou `undefined` quando não dá pra aproveitar nada.
   `ctx` carrega os mapas de id e a lista de problemas. */
function limparCampo(valor, regra, ctx, caminho) {
  const anota = m => { if (ctx.problemas.length < 60) ctx.problemas.push(caminho + ': ' + m); };
  const nulo = () => (regra.nulo ? null : (regra.padrao !== undefined ? regra.padrao : undefined));

  switch (regra.tipo) {
    case 'id': {
      /* item de lista referenciada: o de-para já foi decidido em mapearIds(),
         pra que a referência e o dono cheguem no mesmo valor */
      const mapa = ctx.namespace && ctx.ids[ctx.namespace];
      if (mapa && valor != null && mapa.has(String(valor))) return mapa.get(String(valor));
      if (idSeguro(valor)) return String(valor);
      if (valor != null) anota('id em formato não aceito, trocado');
      return uid();
    }

    case 'ref': {
      if (valor == null) return null;
      const mapa = ctx.ids[regra.de];
      const novo = mapa && mapa.get(String(valor));
      if (!novo) { anota('referência para ' + regra.de + ' que não existe no backup'); return null; }
      return novo;
    }

    case 'dinheiro': {
      if (valor == null || valor === '') return nulo();
      const n = numeroDeFora(valor);
      if (n === null) { anota('não é número'); return nulo(); }
      if (Math.abs(n) > ctx.limites.dinheiro) { anota('valor fora de escala'); return nulo(); }
      if (regra.min !== undefined && n < regra.min) return regra.min;
      return n;
    }

    case 'inteiro': {
      if (valor == null || valor === '') return nulo();
      const n = numeroDeFora(valor);
      if (n === null) { anota('não é número'); return nulo(); }
      const i = Math.trunc(n);
      if (regra.min !== undefined && i < regra.min) return nulo();
      if (regra.max !== undefined && i > regra.max) return nulo();
      return i;
    }

    case 'texto': {
      if (valor == null) return nulo();
      if (typeof valor !== 'string' && typeof valor !== 'number') { anota('não é texto'); return nulo(); }
      const s = String(valor).trim();
      if (s.length > (regra.max || ctx.limites.texto)) {
        anota('texto grande demais, cortado');
        return s.slice(0, regra.max || ctx.limites.texto);
      }
      return s;
    }

    case 'url': {
      if (valor == null) return nulo();
      if (typeof valor !== 'string') { anota('link não é texto'); return nulo(); }
      if (valor.length > (regra.max || ctx.limites.texto)) { anota('link grande demais'); return nulo(); }
      const limpo = urlSegura(valor);
      if (!limpo && valor.trim()) anota('link precisa ser http ou https');
      return limpo || nulo();
    }

    case 'booleano':
      if (typeof valor === 'boolean') return valor;
      if (valor === undefined || valor === null) return nulo();
      anota('não é sim/não');
      return nulo();

    case 'dia': {
      if (valor == null || valor === '') return nulo();
      const s = String(valor).slice(0, 10);
      if (!RE_DIA.test(s) || isNaN(new Date(s + 'T12:00:00').getTime())) { anota('data inválida'); return nulo(); }
      return s;
    }

    case 'iso': {
      if (valor == null || valor === '') return nulo();
      const s = String(valor);
      if (s.length > 40 || !RE_ISO.test(s) || isNaN(new Date(s).getTime())) { anota('data-hora inválida'); return nulo(); }
      return s;
    }

    case 'opcao':
      if (valor == null) return nulo();
      if (regra.valores.includes(valor)) return valor;
      anota('valor fora das opções');
      return nulo();

    case 'listaTexto': {
      if (!Array.isArray(valor)) return [];
      const fora = [];
      for (const x of valor.slice(0, ctx.limites.itens)) {
        if (typeof x !== 'string') continue;
        const s = x.trim();
        if (!s) continue;
        if (regra.formato === 'dia' && !RE_DIA.test(s)) continue;
        fora.push(s.slice(0, regra.max || ctx.limites.texto));
      }
      return fora;
    }

    case 'listaInteiro': {
      if (!Array.isArray(valor)) return [];
      const fora = [];
      for (const x of valor.slice(0, ctx.limites.itens)) {
        const n = numeroDeFora(x);
        if (n === null) continue;
        const i = Math.trunc(n);
        if (regra.min !== undefined && i < regra.min) continue;
        if (regra.max !== undefined && i > regra.max) continue;
        if (!fora.includes(i)) fora.push(i);
      }
      return fora;
    }

    case 'mapaDinheiro':
    case 'mapaTexto': {
      if (!ehObjetoSimples(valor)) return {};
      const fora = {};
      let n = 0;
      for (const k of Object.keys(valor)) {
        if (CHAVES_PROIBIDAS.has(k)) { anota('chave proibida descartada: ' + k); continue; }
        if (++n > ctx.limites.itens) break;
        const chave = k.slice(0, regra.maxChave || ctx.limites.categoria);
        if (regra.tipo === 'mapaDinheiro') {
          const v = numeroDeFora(valor[k]);
          if (v === null || Math.abs(v) > ctx.limites.dinheiro) continue;
          fora[chave] = v;
        } else {
          if (typeof valor[k] !== 'string') continue;
          fora[chave] = valor[k].slice(0, regra.maxValor || ctx.limites.texto);
        }
      }
      return fora;
    }

    case 'objeto': {
      if (!ehObjetoSimples(valor)) return nulo();
      return limparObjeto(valor, regra.campos, ctx, caminho);
    }

    case 'lista': {
      if (!Array.isArray(valor)) return [];
      if (valor.length > ctx.limites.itens) anota('lista com ' + valor.length + ' itens, cortada em ' + ctx.limites.itens);
      const fora = [];
      const anterior = ctx.namespace;
      ctx.namespace = regra.idNamespace || null;
      valor.slice(0, ctx.limites.itens).forEach((item, i) => {
        if (!ehObjetoSimples(item)) return;
        fora.push(limparObjeto(item, regra.item, ctx, caminho + '[' + i + ']'));
      });
      ctx.namespace = anterior;
      return fora;
    }

    default:
      anota('tipo desconhecido no esquema: ' + regra.tipo);
      return undefined;
  }
}

/* monta um objeto novo só com as chaves declaradas — é isto que impede
   prototype pollution e campo estranho de sobreviver */
function limparObjeto(entrada, campos, ctx, caminho) {
  const fora = {};
  for (const nome of Object.keys(campos)) {
    const regra = campos[nome];
    const bruto = Object.prototype.hasOwnProperty.call(entrada, nome) ? entrada[nome] : undefined;
    if (bruto === undefined && regra.legado) continue;   // formato antigo: só passa se veio
    const limpo = limparCampo(bruto, regra, ctx, caminho ? caminho + '.' + nome : nome);
    if (limpo !== undefined) fora[nome] = limpo;
  }
  for (const nome of Object.keys(entrada)) {
    if (!Object.prototype.hasOwnProperty.call(campos, nome)) {
      ctx.descartados.add((caminho ? caminho + '.' : '') + nome);
    }
  }
  return fora;
}

/* Monta o de-para dos ids que outras listas referenciam. Id aceitável fica como
   está; id fora do formato ganha um novo. Nos dois casos o mapa é a autoridade,
   pra que o dono e quem aponta pra ele cheguem no mesmo valor. */
function mapearIds(entrada, ctx) {
  const registrar = (mapa, bruto) => {
    if (bruto == null || typeof bruto === 'object') return;
    const chave = String(bruto);
    if (!mapa.has(chave)) mapa.set(chave, idSeguro(bruto) ? chave : uid());
  };

  for (const lista of Object.keys(NAMESPACES_DE_ID)) {
    const mapa = new Map();
    const arr = Array.isArray(entrada[lista]) ? entrada[lista] : [];
    for (const item of arr.slice(0, ctx.limites.itens)) {
      if (ehObjetoSimples(item)) registrar(mapa, item.id);
    }
    ctx.ids[NAMESPACES_DE_ID[lista]] = mapa;
  }

  /* parcelamentoId não aponta pra uma lista: é a marca que junta as parcelas de
     uma compra. Precisa continuar juntando exatamente as mesmas. */
  const mapa = new Map();
  const faturas = Array.isArray(entrada.faturas) ? entrada.faturas : [];
  for (const f of faturas.slice(0, ctx.limites.itens)) {
    if (!ehObjetoSimples(f) || !Array.isArray(f.gastos)) continue;
    for (const g of f.gastos.slice(0, ctx.limites.itens)) {
      if (ehObjetoSimples(g)) registrar(mapa, g.parcelamentoId);
    }
  }
  ctx.ids.parcelamento = mapa;
}

/* ── a porta de entrada ──
   entrada: o que veio (já JSON.parse-ado)
   opcoes.origem: 'arquivo' | 'codigo' | 'nuvem' | 'local' — só pra mensagem
   opcoes.bytes:  tamanho do texto original, quando o chamador tem              */
function validateAndNormalizeData(entrada, opcoes) {
  opcoes = opcoes || {};
  const problemas = [];
  const descartados = new Set();

  if (!ehObjetoSimples(entrada)) {
    return { ok: false, data: null, problemas: ['o backup não é um objeto'], descartados: [] };
  }
  if (opcoes.bytes && opcoes.bytes > LIMITES.bytes) {
    return { ok: false, data: null, problemas: ['backup grande demais: ' + opcoes.bytes + ' bytes'], descartados: [] };
  }
  if (profundidadeAcima(entrada, LIMITES.profundidade)) {
    return { ok: false, data: null, problemas: ['estrutura aninhada demais'], descartados: [] };
  }
  if (!opcoes.bytes) {
    let tam = 0;
    try { tam = JSON.stringify(entrada).length; } catch (e) {
      return { ok: false, data: null, problemas: ['o backup não pôde ser lido (referência circular?)'], descartados: [] };
    }
    if (tam > LIMITES.bytes) {
      return { ok: false, data: null, problemas: ['backup grande demais: ' + tam + ' bytes'], descartados: [] };
    }
  }

  /* Envelope cifrado não é dado: é a cópia da nuvem que esta versão do app não
     sabe (ou não deveria) abrir aqui. Sem esta recusa, ele passaria pela
     validação como um punhado de campos desconhecidos, sobraria um objeto vazio
     e o app poderia sobrescrever a nuvem com nada. A checagem é feita à mão, e
     não chamando storage/encryption.js, pra que a fronteira de confiança não
     dependa de outra camada. */
  if (entrada.aoii === 'sync' && entrada.cipher) {
    return {
      ok: false, data: null, descartados: [],
      problemas: ['isto é uma cópia cifrada, não um backup legível — abra com a senha da sincronização'],
    };
  }

  /* Objeto com conteúdo, mas nenhum campo que a gente reconheça. Aceitar
     resultaria num `data` vazio no lugar dos dados reais — e, pior, esse vazio
     seria salvo por cima. É o que aconteceria com um arquivo de outro app, ou
     com um formato futuro que esta versão não entende. */
  const conhecidos = Object.keys(entrada).filter(k => Object.prototype.hasOwnProperty.call(ESQUEMA, k));
  if (Object.keys(entrada).length > 0 && conhecidos.length === 0) {
    return {
      ok: false, data: null, descartados: Object.keys(entrada).slice(0, 20),
      problemas: ['nenhum campo reconhecido — isto não parece um backup do Aoii'],
    };
  }

  const versao = numeroDeFora(entrada.schemaVersion);
  if (versao !== null && versao > SCHEMA_VERSAO) {
    return {
      ok: false, data: null, descartados: [],
      problemas: ['este backup foi salvo por uma versão mais nova do app (schema ' +
                  Math.trunc(versao) + ', esta entende até ' + SCHEMA_VERSAO + ')'],
    };
  }

  const ctx = { problemas, descartados, ids: {}, namespace: null, limites: LIMITES };
  mapearIds(entrada, ctx);

  const limpo = limparObjeto(entrada, ESQUEMA, ctx, '');
  limpo.schemaVersion = SCHEMA_VERSAO;

  return { ok: true, data: limpo, problemas, descartados: [...descartados] };
}
