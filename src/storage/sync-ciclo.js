/* ═══════════════════════════════════════════════════════════════════════════
   O ciclo da sincronização: decidir, sem desenhar.

   Aqui não há DOM. Cada função devolve um desfecho nomeado e quem chama decide
   o que mostrar. É isso que permite ensaiar o ciclo inteiro — registro antigo,
   criação de senha, criptografia, gravação, releitura, dois aparelhos em
   conflito, queda de rede, retomada — sem navegador.

   Regras que valem para tudo aqui:

   - **Nada sobrescreve em silêncio.** Conflito é desfecho, não erro. Quando o
     servidor recusa, o estado local não muda.
   - **A senha nunca é guardada.** O que fica em memória é a chave derivada e o
     token de escrita. Se a pessoa fechar o app, precisa digitar de novo (ou ter
     escolhido, explicitamente, lembrar a chave neste aparelho).
   - **Gravação só conta depois de reler.** Cifrar, gravar, buscar de volta e
     decifrar. Só então a revisão local avança. Sem isso, uma gravação que o
     servidor aceitou mas guardou errado passaria despercebida até o dia em que
     alguém precisasse do backup.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Estado da sincronização nesta sessão. `chave` e `token` são o material
   derivado da senha — nunca a senha. */
const sync = {
  codigo: null,
  salt: null,          // base64, estável por código de sincronização
  senha: null,         // só enquanto a sessão está aberta; ver o cabeçalho
  token: null,         // token de escrita, hexadecimal
  revisao: 0,          // última revisão que este aparelho viu
  aparelho: null,
  status: 'desligada',
};

const CHAVE_SALT = 'financas-sync-salt';
const CHAVE_APARELHO = 'financas-device-id';

function idDesteAparelho() {
  if (sync.aparelho) return sync.aparelho;
  let id = null;
  try { id = localStorage.getItem(CHAVE_APARELHO); } catch (e) {}
  if (!id || !/^[A-Za-z0-9:_-]{1,64}$/.test(id)) {
    id = 'ap-' + (cryptoDisponivel()
      ? Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')
      : Date.now().toString(36));
    try { localStorage.setItem(CHAVE_APARELHO, id); } catch (e) {}
  }
  sync.aparelho = id;
  return id;
}

/* O código deixa de ser credencial e vira endereço, então pode ser mais longo
   sem incomodar: 12 caracteres num alfabeto de 31 dão ~7,9 × 10¹⁷ combinações.
   E sorteado com crypto, não com Math.random. */
function gerarCodigoSync() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c = '';
  if (cryptoDisponivel()) {
    const b = crypto.getRandomValues(new Uint8Array(12));
    for (let i = 0; i < 12; i++) c += alfabeto[b[i] % alfabeto.length];
  } else {
    for (let i = 0; i < 12; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return c;
}

function saltGuardado() { try { return localStorage.getItem(CHAVE_SALT) || null; } catch (e) { return null; } }
function guardarSalt(s) { try { s ? localStorage.setItem(CHAVE_SALT, s) : localStorage.removeItem(CHAVE_SALT); } catch (e) {} }

function sincronizacaoDestrancada() { return !!(sync.codigo && sync.senha && sync.token); }

function esquecerSenha() {
  sync.senha = null; sync.token = null;
  sync.status = sync.codigo ? 'precisa-senha' : 'desligada';
}

/* ── abrir ──────────────────────────────────────────────────────────────────
   Liga a sincronização de um código com uma senha. Descobre sozinha em qual
   dos três mundos está: código novo, cópia já cifrada, ou registro antigo em
   texto puro esperando migração.

   Desfechos:
     {resultado:'nova'}                    o código não existe na nuvem ainda
     {resultado:'aberta', dados}           decifrou; `dados` é o que está na nuvem
     {resultado:'migrar', dados}           registro antigo, em texto puro
     {resultado:'senha-errada'}            não decifrou — o local não é tocado
     {resultado:'erro', motivo}            rede, ou algo que não sabemos ler   */
async function abrirSincronizacao(codigo, senha) {
  if (!codigo) return { resultado: 'erro', motivo: 'sem-codigo' };
  if (!senha) return { resultado: 'erro', motivo: 'sem-senha' };

  let remoto;
  try { remoto = await nuvemLer(codigo); }
  catch (e) { return { resultado: 'erro', motivo: 'rede' }; }

  /* código ainda não existe: salt novo, e a primeira gravação cria a linha */
  if (!remoto) {
    const salt = novoSaltDeSenha();
    sync.codigo = codigo; sync.salt = salt; sync.senha = senha;
    sync.token = await derivarTokenDeEscrita(senha, b64ParaBytes(salt), CRIPTO_VOLTAS);
    sync.revisao = 0; sync.status = 'nova';
    return { resultado: 'nova' };
  }

  /* registro antigo, em texto puro: não há o que decifrar, há o que migrar */
  if (!ehEnvelopeCifrado(remoto.envelope)) {
    const salt = novoSaltDeSenha();
    sync.codigo = codigo; sync.salt = salt; sync.senha = senha;
    sync.token = await derivarTokenDeEscrita(senha, b64ParaBytes(salt), CRIPTO_VOLTAS);
    sync.revisao = remoto.revision; sync.status = 'migrar';
    return { resultado: 'migrar', dados: remoto.envelope };
  }

  /* cópia cifrada: o salt vem de lá, e é ele que decide se a senha bate */
  const salt = (remoto.envelope.kdf || {}).salt;
  if (!salt) return { resultado: 'erro', motivo: 'envelope-sem-salt' };

  let dados;
  try { dados = await decifrarDaNuvem(remoto.envelope, senha); }
  catch (e) {
    if (e.message === 'senha-errada') return { resultado: 'senha-errada' };
    return { resultado: 'erro', motivo: e.message };
  }

  sync.codigo = codigo; sync.salt = salt; sync.senha = senha;
  sync.token = await derivarTokenDeEscrita(senha, b64ParaBytes(salt), CRIPTO_VOLTAS);
  sync.revisao = remoto.revision; sync.status = 'sincronizada';
  guardarSalt(salt);
  return { resultado: 'aberta', dados };
}

/* ── enviar ─────────────────────────────────────────────────────────────────
   Cifra, grava, relê e confere. A revisão local só avança no fim.

   Desfechos:
     {resultado:'enviado', revisao}
     {resultado:'conflito', revisao}   outro aparelho gravou antes; nada mudou
     {resultado:'precisa-senha'}
     {resultado:'sem-conexao'}
     {resultado:'erro', motivo}                                              */
async function enviarParaNuvem(dados) {
  if (!sincronizacaoDestrancada()) return { resultado: 'precisa-senha' };

  let envelope;
  try {
    envelope = await cifrarParaNuvem(dados, sync.senha, {
      revision: sync.revisao + 1,
      device_id: idDesteAparelho(),
      salt: sync.salt,
    });
  } catch (e) { return { resultado: 'erro', motivo: e.message }; }

  let r;
  try { r = await nuvemGravar(sync.codigo, envelope, sync.revisao, sync.token); }
  catch (e) { sync.status = 'sem-conexao'; return { resultado: 'sem-conexao' }; }

  if (r.conflito) {
    sync.status = 'conflito';
    return { resultado: 'conflito', revisao: r.revision };
  }
  if (!r.ok) {
    sync.status = 'erro';
    return { resultado: 'erro', motivo: r.erro };
  }

  /* releitura: gravou mesmo, e o que está lá decifra? */
  try {
    const volta = await nuvemLer(sync.codigo);
    if (!volta || !ehEnvelopeCifrado(volta.envelope)) {
      sync.status = 'erro';
      return { resultado: 'erro', motivo: 'releitura-vazia' };
    }
    await decifrarDaNuvem(volta.envelope, sync.senha);
    sync.revisao = volta.revision;
  } catch (e) {
    sync.status = 'erro';
    return { resultado: 'erro', motivo: 'releitura-' + (e.message || 'falhou') };
  }

  sync.status = 'sincronizada';
  guardarSalt(sync.salt);
  return { resultado: 'enviado', revisao: sync.revisao };
}

/* ── receber ────────────────────────────────────────────────────────────────
   Desfechos:
     {resultado:'igual'}                nada novo
     {resultado:'novidade', dados, revisao}
     {resultado:'sumiu'}                a linha não está mais lá
     {resultado:'precisa-senha'} · {resultado:'sem-conexao'} · {resultado:'erro'} */
async function receberDaNuvem() {
  if (!sincronizacaoDestrancada()) return { resultado: 'precisa-senha' };

  let remoto;
  try { remoto = await nuvemLer(sync.codigo); }
  catch (e) { sync.status = 'sem-conexao'; return { resultado: 'sem-conexao' }; }

  if (!remoto) return { resultado: 'sumiu' };
  if (remoto.revision === sync.revisao) { sync.status = 'sincronizada'; return { resultado: 'igual' }; }
  if (!ehEnvelopeCifrado(remoto.envelope)) return { resultado: 'erro', motivo: 'nao-cifrado' };

  let dados;
  try { dados = await decifrarDaNuvem(remoto.envelope, sync.senha); }
  catch (e) {
    /* a senha abriu antes e agora não abre: outra pessoa trocou a senha do
       mesmo código. Não é erro de rede, e não pode virar sobrescrita. */
    sync.status = 'erro';
    return { resultado: 'erro', motivo: e.message === 'senha-errada' ? 'senha-mudou' : e.message };
  }

  sync.revisao = remoto.revision;
  sync.status = 'sincronizada';
  return { resultado: 'novidade', dados, revisao: remoto.revision };
}

/* ── migrar ─────────────────────────────────────────────────────────────────
   Registro antigo em texto puro vira envelope cifrado. Não apaga nada: a
   gravação substitui a linha, e o aparelho continua com os dados locais. Se
   qualquer passo falhar, a linha antiga fica como está.                     */
async function migrarParaCifrado(dados) {
  if (!sincronizacaoDestrancada()) return { resultado: 'precisa-senha' };

  /* prova local antes de qualquer gravação: cifrar e decifrar de volta */
  try {
    const ensaio = await cifrarParaNuvem(dados, sync.senha, { revision: 1, device_id: idDesteAparelho(), salt: sync.salt });
    const volta = await decifrarDaNuvem(ensaio, sync.senha);
    if (JSON.stringify(volta) !== JSON.stringify(dados)) {
      return { resultado: 'erro', motivo: 'ensaio-nao-bateu' };
    }
  } catch (e) { return { resultado: 'erro', motivo: 'ensaio-' + e.message }; }

  return await enviarParaNuvem(dados);
}
