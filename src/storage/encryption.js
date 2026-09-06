/* ═══════════════════════════════════════════════════════════════════════════
   Criptografia da cópia na nuvem.

   O que sai daqui é o que pode ir pro servidor: um envelope em que só o
   `cipher.ciphertext` carrega conteúdo, e ele é ilegível sem a senha. A senha
   nunca sai do aparelho — nem ela, nem a chave derivada dela.

   Escolhas, e por quê:

   - **AES-GCM 256.** Cifra e autentica na mesma operação: mexer num byte do
     texto cifrado faz a decifragem falhar em vez de devolver lixo plausível.
   - **PBKDF2-SHA-256, 310.000 voltas.** É o que a Web Crypto oferece sem
     dependência externa. Argon2 seria melhor contra ataque com GPU, mas exigiria
     WebAssembly de terceiros — num app que roda offline e guarda dinheiro, uma
     dependência a menos vale mais do que a diferença. O número de voltas fica no
     envelope, então dá pra subir depois sem quebrar o que já foi salvo.
   - **IV de 12 bytes novo a cada gravação; salt de 16 bytes estável.** Reusar
     IV em AES-GCM é a falha clássica que derruba a cifra inteira, então ele é
     sorteado sempre. O salt do PBKDF2 é outra história: ele precisa ser único
     por senha, não por mensagem. E precisa ser **estável**, porque o token de
     escrita sai dele — girar o salt a cada gravação faria o token mudar junto,
     e o outro aparelho, que derivou o dele do salt anterior, seria recusado
     pelo servidor. O salt nasce uma vez, quando a sincronização é ligada, e é
     carregado adiante em toda gravação.
   - **Duas chaves da mesma senha, com contextos separados.** A chave que cifra
     usa o salt; o token de escrita usa o salt + "/escrita". Nenhum dos dois
     revela o outro, e o servidor só guarda o hash do token.
   - **Os metadados entram como dados autenticados (AAD).** `format_version`,
     `revision` e `device_id` precisam ficar em claro pro servidor comparar
     revisão. Amarrá-los ao AAD faz com que trocar qualquer um deles quebre a
     decifragem — dá pra ler, não dá pra falsificar.

   Não há recuperação de senha. Se ela se perder, a cópia na nuvem vira ruído;
   os dados do aparelho continuam intactos. Isso é a consequência de o servidor
   nunca ter a chave, e está dito na tela antes de o usuário escolher a senha.
   ═══════════════════════════════════════════════════════════════════════════ */

const CRIPTO_FORMATO = 1;
const CRIPTO_VOLTAS = 310000;
const CRIPTO_SALT_BYTES = 16;
const CRIPTO_IV_BYTES = 12;

function cryptoDisponivel() {
  return typeof crypto !== 'undefined' && crypto.subtle && crypto.getRandomValues;
}

/* base64 sem depender de Buffer nem de bibliotecas */
function bytesParaB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
function b64ParaBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* o que o AES-GCM autentica junto com o conteúdo */
function dadosAutenticados(env) {
  return new TextEncoder().encode(
    'aoii/' + env.format_version + '/' + (env.revision || 0) + '/' + (env.device_id || ''));
}

function materialDaSenha(senha) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
}

async function derivarChave(senha, salt, voltas) {
  const material = await materialDaSenha(senha);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: voltas, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']);
}

/* Token de escrita: prova pro servidor que quem grava conhece a senha, sem que
   a senha nem a chave de cifra saiam do aparelho. Sai do mesmo salt, mas com um
   sufixo de contexto — então nem o token revela a chave, nem o contrário.

   O servidor guarda só sha256(token) e compara. Sai como hexadecimal de 64
   caracteres, acima do mínimo de 32 que aoii_put exige. */
async function derivarTokenDeEscrita(senha, salt, voltas) {
  if (!cryptoDisponivel()) throw new Error('cripto-indisponivel');
  const contexto = new Uint8Array(salt.length + 8);
  contexto.set(salt, 0);
  contexto.set(new TextEncoder().encode('/escrita'), salt.length);
  const material = await materialDaSenha(senha);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: contexto, iterations: voltas, hash: 'SHA-256' }, material, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}

/* Salt novo, pra quando a sincronização é ligada pela primeira vez. Depois
   disso ele é carregado adiante — ver o cabeçalho deste arquivo. */
function novoSaltDeSenha() {
  if (!cryptoDisponivel()) throw new Error('cripto-indisponivel');
  return bytesParaB64(crypto.getRandomValues(new Uint8Array(CRIPTO_SALT_BYTES)));
}

/* objeto → envelope pronto pra guardar */
async function cifrarParaNuvem(objeto, senha, meta) {
  if (!cryptoDisponivel()) throw new Error('cripto-indisponivel');
  if (!senha) throw new Error('senha-vazia');
  meta = meta || {};

  /* `meta.salt` é o salt já em uso por esta sincronização. Sem ele, esta é a
     primeira gravação e o salt nasce agora. Ver o cabeçalho: girar o salt a
     cada gravação quebraria o token de escrita dos outros aparelhos. */
  const salt = meta.salt ? b64ParaBytes(meta.salt)
                         : crypto.getRandomValues(new Uint8Array(CRIPTO_SALT_BYTES));
  if (salt.length < 8) throw new Error('salt-invalido');
  const iv = crypto.getRandomValues(new Uint8Array(CRIPTO_IV_BYTES));
  const chave = await derivarChave(senha, salt, CRIPTO_VOLTAS);

  const env = {
    aoii: 'sync',
    format_version: CRIPTO_FORMATO,
    revision: meta.revision || 0,
    device_id: meta.device_id || '',
    updated_at: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2', hash: 'SHA-256',
      iterations: CRIPTO_VOLTAS,
      salt: bytesParaB64(salt),
    },
    cipher: { name: 'AES-GCM', iv: bytesParaB64(iv), ciphertext: '' },
  };

  const claro = new TextEncoder().encode(JSON.stringify(objeto));
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: dadosAutenticados(env) }, chave, claro);
  env.cipher.ciphertext = bytesParaB64(new Uint8Array(cifrado));
  return env;
}

/* Reconhece o envelope sem tentar decifrar. Serve pra uma versão do app que
   ainda não sabe decifrar não confundir isto com dados e sobrescrever a nuvem
   com um objeto vazio. */
function ehEnvelopeCifrado(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v) &&
    v.aoii === 'sync' && !!v.cipher && typeof v.cipher === 'object' &&
    typeof v.cipher.ciphertext === 'string';
}

/* envelope → objeto. Erros nomeados, pra tela saber o que dizer:
   'senha-errada' cobre tanto senha errada quanto conteúdo adulterado — o
   AES-GCM não distingue os dois, e do ponto de vista do usuário é a mesma
   pergunta: "essa senha é a certa?" */
async function decifrarDaNuvem(env, senha) {
  if (!cryptoDisponivel()) throw new Error('cripto-indisponivel');
  if (!ehEnvelopeCifrado(env)) throw new Error('nao-e-envelope');
  if (env.format_version > CRIPTO_FORMATO) throw new Error('formato-mais-novo');
  const kdf = env.kdf || {};
  if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256') throw new Error('kdf-desconhecida');
  const voltas = Math.trunc(kdf.iterations || 0);
  if (!(voltas >= 100000 && voltas <= 5000000)) throw new Error('kdf-fora-de-faixa');
  if ((env.cipher.name || 'AES-GCM') !== 'AES-GCM') throw new Error('cifra-desconhecida');

  let salt, iv, corpo;
  try {
    salt = b64ParaBytes(kdf.salt);
    iv = b64ParaBytes(env.cipher.iv);
    corpo = b64ParaBytes(env.cipher.ciphertext);
  } catch (e) { throw new Error('envelope-corrompido'); }
  if (salt.length < 8 || iv.length !== CRIPTO_IV_BYTES) throw new Error('envelope-corrompido');

  const chave = await derivarChave(senha, salt, voltas);
  let claro;
  try {
    claro = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: dadosAutenticados(env) }, chave, corpo);
  } catch (e) { throw new Error('senha-errada'); }

  try { return JSON.parse(new TextDecoder().decode(claro)); }
  catch (e) { throw new Error('conteudo-invalido'); }
}
