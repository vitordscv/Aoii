/* ── O cofre da sincronização: quando ele NÃO pode ser usado ────────────────

   `restaurarSessaoSync()` pega de volta, do IndexedDB, a chave de cifra e o
   token de escrita que a pessoa destrancou da última vez. É o que evita pedir a
   senha toda vez que o app abre.

   E é, por isso mesmo, o ponto onde credencial errada entra em cena. Ele tem
   quatro guardas, e cada uma impede um desfecho diferente:

     sem nada guardado ......... não há sessão a retomar
     código diferente .......... o cofre é de OUTRO código de sincronização
     chave que não é chave ..... texto no lugar de uma CryptoKey
     token ausente ............. sem ele não se escreve, e escrever é o risco

   A segunda é a que mais assusta. Se passasse, o app usaria a chave e o token
   de uma sincronização para falar com outra: decifraria lixo, ou escreveria com
   um token que não é daquela linha. Trocar o código no app e continuar com a
   credencial antiga é o caminho mais curto entre duas pessoas e um dado
   sobrescrito.

   O ambiente aqui é montado à mão — IndexedDB e localStorage falsos — porque é
   o que permite pôr o cofre em cada estado ruim de propósito. */
const { montarMotor } = require('./extrair-motor');
const vm = require('vm');
const path = require('path');

/* IndexedDB do tamanho do que `abrirCofreSync()` usa: abrir, ler 'atual',
   fechar. Nada além disso. */
function criarIndexedDBFalso(guardado) {
  return {
    open() {
      const pedido = {};
      setTimeout(() => {
        pedido.result = {
          transaction() {
            return {
              objectStore() {
                return {
                  get() {
                    const p = {};
                    setTimeout(() => {
                      p.result = guardado.valor;
                      if (p.onsuccess) p.onsuccess();
                    }, 0);
                    return p;
                  },
                };
              },
            };
          },
          close() { guardado.fechou = (guardado.fechou || 0) + 1; },
        };
        if (pedido.onsuccess) pedido.onsuccess();
      }, 0);
      return pedido;
    },
  };
}

function criarAparelho(guardado, espiaoDuravel) {
  const local = {};
  const c = {
    console, Math, JSON, Number, String, Array, Object, Set, Map, Date, URL,
    isNaN, isFinite, parseInt, parseFloat, TextEncoder, TextDecoder,
    crypto: require('crypto').webcrypto,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary'),
    fetch: async () => { throw new Error('sem rede neste teste'); },
    AbortController, setTimeout, clearTimeout,
    localStorage: {
      getItem: k => (k in local ? local[k] : null),
      setItem: (k, v) => { local[k] = String(v); },
      removeItem: k => { delete local[k]; },
    },
    indexedDB: criarIndexedDBFalso(guardado),
    navigator: espiaoDuravel ? { storage: espiaoDuravel } : {},
    L: k => k, esc: s => String(s), formatBRL: n => 'R$ ' + Number(n).toFixed(2),
    vibrate: () => {}, render: () => {}, setSaveStatus: () => {},
    renderStatusSync: () => {}, persist: async () => {},
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
  };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(montarMotor(path.join(__dirname, '..', 'dist', 'index.html')), c);
  return c;
}

async function chaveDeVerdade(A) {
  /* uma CryptoKey AES-GCM não exportável, que é o que `ehChaveDeCifra()` exige */
  return A.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

module.exports = async function (t) {
  console.log('\n\x1b[1mO cofre da sincronização só volta quando é o mesmo\x1b[0m');

  const CODIGO = 'CODIGODOTESTE';
  const guardado = { valor: null };
  const A = criarAparelho(guardado);
  const chave = await chaveDeVerdade(A);

  A.setSyncCode(CODIGO);
  t.igual(A.getSyncCode(), CODIGO, 'o código fica guardado e volta igual');

  /* ── 1. cofre vazio ── */
  guardado.valor = null;
  t.igual(await A.restaurarSessaoSync(), false, 'sem nada no cofre, não há sessão a retomar');

  /* ── 2. a sessão certa ── */
  guardado.valor = { codigo: CODIGO, salt: 'sal', chave, token: 'token-de-escrita-1234', revisao: 7 };
  t.igual(await A.restaurarSessaoSync(), true, 'com tudo certo, a sessão volta');
  t.igual(A.sync.codigo, CODIGO, 'o código entra no estado');
  t.igual(A.sync.token, 'token-de-escrita-1234', 'o token de escrita também');
  t.igual(A.sync.revisao, 7, 'e a revisão de onde parou');
  t.igual(A.sync.status, 'sincronizada', 'o estado passa a "sincronizada"');

  /* ── 3. o cofre é de OUTRO código ──
     Este é o guarda que importa: sem ele, trocar o código no app manteria a
     chave e o token do código anterior. */
  A.sync.codigo = null; A.sync.chave = null; A.sync.token = null;
  guardado.valor = { codigo: 'OUTROCODIGO9', salt: 'sal', chave, token: 'token-alheio-1234' };
  t.igual(await A.restaurarSessaoSync(), false,
    'cofre de outro código NÃO é aceito');
  t.igual(A.sync.token, null,
    'e nada do outro código entra no estado',
    'usar a credencial de uma sincronização em outra é o caminho curto para sobrescrever dado alheio');

  /* ── 4. no lugar da chave, um texto ── */
  guardado.valor = { codigo: CODIGO, salt: 'sal', chave: 'isto-nao-e-uma-chave', token: 'token-1234' };
  t.igual(await A.restaurarSessaoSync(), false,
    'texto no lugar da CryptoKey é recusado');

  /* uma chave EXPORTÁVEL também não serve: o projeto guarda só chave que não
     pode ser lida de volta */
  const exportavel = await A.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  guardado.valor = { codigo: CODIGO, salt: 'sal', chave: exportavel, token: 'token-1234' };
  t.igual(await A.restaurarSessaoSync(), false,
    'e chave exportável também não, porque ela poderia ser lida de volta');

  /* ── 5. sem token de escrita ── */
  guardado.valor = { codigo: CODIGO, salt: 'sal', chave, token: null };
  t.igual(await A.restaurarSessaoSync(), false,
    'sem token não retoma: sem ele não se escreve, e escrever é o risco');

  console.log('\n\x1b[1mA senha lembrada neste aparelho\x1b[0m');
  {
    guardado.valor = { codigo: CODIGO, salt: 'sal', chave, token: 'token-1234' };
    t.igual(await A.senhaLembradaAqui(), true, 'com o cofre no mesmo código, está lembrada');

    guardado.valor = { codigo: 'OUTRO1234567', salt: 'sal', chave, token: 'token-1234' };
    t.igual(await A.senhaLembradaAqui(), false,
      'cofre de outro código não conta como lembrada',
      'senão o app diria "já sei sua senha" sobre uma sincronização que não é esta');

    guardado.valor = null;
    t.igual(await A.senhaLembradaAqui(), false, 'e sem cofre, não está lembrada');
  }

  console.log('\n\x1b[1mSem IndexedDB, nada quebra\x1b[0m');
  {
    /* navegador em janela privada, ou com armazenamento bloqueado */
    const semCofre = criarAparelho({ valor: null });
    semCofre.indexedDB = undefined;
    semCofre.setSyncCode(CODIGO);
    t.igual(await semCofre.restaurarSessaoSync(), false,
      'sem IndexedDB a sessão não volta — e não estoura');
    t.igual(await semCofre.senhaLembradaAqui(), false,
      'nem a pergunta sobre a senha');
  }

  console.log('\n\x1b[1mO pedido para o navegador não descartar o cofre\x1b[0m');
  {
    /* O cofre guarda a chave de cifra. Se o navegador o descartar por falta de
       espaço, a pessoa tem que digitar a senha de novo — o dado não some, mas
       a porta fecha. Por isso o app pede persistência. */
    const pedidos = { persistiu: 0 };
    const comApi = criarAparelho({ valor: null }, {
      persisted: async () => false,
      persist: async () => { pedidos.persistiu++; return true; },
    });
    t.igual(await comApi.armazenamentoEhDuravel(), false, 'ainda não é durável');
    t.igual(await comApi.pedirArmazenamentoDuravel(), true, 'e o pedido é feito');
    t.igual(pedidos.persistiu, 1, 'uma vez');

    const jaDuravel = criarAparelho({ valor: null }, {
      persisted: async () => true,
      persist: async () => { throw new Error('não deveria ser chamado'); },
    });
    t.igual(await jaDuravel.armazenamentoEhDuravel(), true, 'quando já é durável, diz que é');
    t.igual(await jaDuravel.pedirArmazenamentoDuravel(), true,
      'e não pede de novo',
      'pedir permissão que já se tem é um diálogo à toa na cara da pessoa');

    /* navegador sem a API: não é erro, é ausência */
    const semApi = criarAparelho({ valor: null });
    t.igual(await semApi.armazenamentoEhDuravel(), false, 'navegador sem a API não é durável');
    t.igual(await semApi.pedirArmazenamentoDuravel(), null,
      'e o pedido devolve "não dá para saber", não uma exceção');
  }

  console.log('\n\x1b[1mHomologação\x1b[0m');
  {
    const B = criarAparelho({ valor: null });
    t.igual(B.emHomologacao(), false,
      'produção não é homologação',
      'se isto der true em produção, os dados vão para a gêmea e somem da vista');
  }
};
