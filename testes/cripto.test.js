/* Criptografia da cópia na nuvem (src/storage/encryption.js).

   Roda contra a Web Crypto de verdade — a mesma API do navegador —, sem dublê.
   O que se testa aqui não é "a cifra funciona" (isso é do navegador), e sim que
   o envelope está montado do jeito que o servidor nunca consiga ler, e que
   adulterar qualquer parte dele quebra a decifragem em vez de devolver algo
   plausível. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-05';
const SENHA='uma senha razoável 123';

const SEGREDO={
  saldoAtual:1083.23,
  cartoes:[{id:'c1',nome:'Nubank'}],
  transacoes:[{id:'t1',nome:'Farmácia',valor:87.4,data:'2026-09-01'}],
};

module.exports=async function(t){
  const c=criarAmbiente({},HOJE);
  console.log('\n\x1b[1mCriptografia da nuvem\x1b[0m');

  if(!c.cryptoDisponivel()){
    t.verdadeiro(false,'Web Crypto disponível no ambiente de teste',
      'sem crypto.subtle não dá pra testar a criptografia');
    return;
  }

  const env=await c.cifrarParaNuvem(SEGREDO,SENHA,{revision:7,device_id:'aparelho-a'});

  /* ── o que o servidor enxerga ── */
  const comoTexto=JSON.stringify(env);
  t.igual(comoTexto.includes('Nubank'),false,'o nome do cartão não aparece no que vai pro servidor');
  t.igual(comoTexto.includes('Farmácia'),false,'nem o nome da compra');
  t.igual(comoTexto.includes('1083'),false,'nem o saldo');
  t.igual(comoTexto.includes(SENHA),false,'e a senha, claro, também não');
  t.igual(env.aoii,'sync','o envelope se identifica');
  t.igual(env.kdf.name,'PBKDF2','a derivação declarada é PBKDF2');
  t.igual(env.kdf.hash,'SHA-256','com SHA-256');
  t.verdadeiro(env.kdf.iterations>=310000,'com pelo menos 310.000 voltas',
    'veio '+env.kdf.iterations);
  t.verdadeiro(c.b64ParaBytes(env.kdf.salt).length>=16,'salt de 16 bytes ou mais');
  t.igual(c.b64ParaBytes(env.cipher.iv).length,12,'IV de 12 bytes, como o AES-GCM pede');
  t.igual(env.cipher.name,'AES-GCM','a cifra declarada é AES-GCM');

  /* ── ida e volta ── */
  const volta=await c.decifrarDaNuvem(env,SENHA);
  t.igual(JSON.stringify(volta),JSON.stringify(SEGREDO),'com a senha certa, volta idêntico');

  /* ── senha errada ── */
  let erro=null;
  try{ await c.decifrarDaNuvem(env,SENHA+'x'); }catch(e){ erro=e.message; }
  t.igual(erro,'senha-errada','senha errada não devolve conteúdo, dá erro nomeado');

  /* ── IV novo a cada gravação, salt estável ── */
  const env2=await c.cifrarParaNuvem(SEGREDO,SENHA,{revision:7,device_id:'aparelho-a',salt:env.kdf.salt});
  t.verdadeiro(env.cipher.iv!==env2.cipher.iv,'cada gravação usa um IV novo',
    'reusar IV em AES-GCM derruba a cifra inteira');
  t.igual(env2.kdf.salt,env.kdf.salt,
    'o salt informado é carregado adiante, não sorteado de novo');
  t.verdadeiro(env.cipher.ciphertext!==env2.cipher.ciphertext,
    'mesmo com o salt igual, o mesmo conteúdo não dá o mesmo texto cifrado (é o IV)');
  const semSalt=await c.cifrarParaNuvem(SEGREDO,SENHA,{});
  t.verdadeiro(semSalt.kdf.salt!==env.kdf.salt,
    'sem salt informado, nasce um novo — é a primeira gravação de uma sincronização');

  /* ── token de escrita ──
     Sai da mesma senha e do mesmo salt, mas com contexto separado. Precisa ser
     ESTÁVEL: é ele que o servidor compara a cada gravação, e o outro aparelho
     deriva o dele por conta própria. Se mudasse a cada gravação, o segundo
     aparelho seria recusado. */
  const salt=env.kdf.salt;
  const tok1=await c.derivarTokenDeEscrita(SENHA,c.b64ParaBytes(salt),c.CRIPTO_VOLTAS);
  const tok2=await c.derivarTokenDeEscrita(SENHA,c.b64ParaBytes(salt),c.CRIPTO_VOLTAS);
  t.igual(tok1,tok2,'mesma senha e mesmo salt dão sempre o mesmo token');
  t.verdadeiro(tok1.length>=32,'o token tem pelo menos 32 caracteres (aoii_put exige)',
    'veio com '+tok1.length);
  t.verdadeiro(/^[0-9a-f]+$/.test(tok1),'e é hexadecimal, seguro em qualquer transporte');

  const tokOutraSenha=await c.derivarTokenDeEscrita(SENHA+'x',c.b64ParaBytes(salt),c.CRIPTO_VOLTAS);
  t.verdadeiro(tok1!==tokOutraSenha,'senha diferente dá token diferente');
  const tokOutroSalt=await c.derivarTokenDeEscrita(SENHA,c.b64ParaBytes(semSalt.kdf.salt),c.CRIPTO_VOLTAS);
  t.verdadeiro(tok1!==tokOutroSalt,'salt diferente dá token diferente');

  /* o token não pode ser a chave de cifra disfarçada */
  const chaveCrua=await crypto.subtle.deriveBits(
    {name:'PBKDF2',salt:c.b64ParaBytes(salt),iterations:c.CRIPTO_VOLTAS,hash:'SHA-256'},
    await crypto.subtle.importKey('raw',new TextEncoder().encode(SENHA),'PBKDF2',false,['deriveBits']),
    256);
  const chaveHex=Array.from(new Uint8Array(chaveCrua),b=>b.toString(16).padStart(2,'0')).join('');
  t.verdadeiro(tok1!==chaveHex,
    'o token de escrita não é a chave que cifra — contextos separados',
    'se fossem iguais, mandar o token pro servidor entregaria a chave junto');

  /* ── adulteração ── */
  const virarUmByte=(b64)=>{
    const b=c.b64ParaBytes(b64);
    b[Math.floor(b.length/2)]^=0x01;
    return c.bytesParaB64(b);
  };

  const mexido=JSON.parse(JSON.stringify(env));
  mexido.cipher.ciphertext=virarUmByte(mexido.cipher.ciphertext);
  erro=null;
  try{ await c.decifrarDaNuvem(mexido,SENHA); }catch(e){ erro=e.message; }
  t.igual(erro,'senha-errada','um byte trocado no conteúdo faz a decifragem falhar');

  const ivMexido=JSON.parse(JSON.stringify(env));
  ivMexido.cipher.iv=virarUmByte(ivMexido.cipher.iv);
  erro=null;
  try{ await c.decifrarDaNuvem(ivMexido,SENHA); }catch(e){ erro=e.message; }
  t.igual(erro,'senha-errada','IV trocado também');

  /* os metadados ficam em claro pro servidor comparar revisão — mas amarrados
     ao conteúdo, então mudar um deles quebra a decifragem */
  const revMexida=JSON.parse(JSON.stringify(env));
  revMexida.revision=999;
  erro=null;
  try{ await c.decifrarDaNuvem(revMexida,SENHA); }catch(e){ erro=e.message; }
  t.igual(erro,'senha-errada','trocar a revisão no envelope quebra: os metadados são autenticados');

  const devMexido=JSON.parse(JSON.stringify(env));
  devMexido.device_id='outro-aparelho';
  erro=null;
  try{ await c.decifrarDaNuvem(devMexido,SENHA); }catch(e){ erro=e.message; }
  t.igual(erro,'senha-errada','trocar o aparelho no envelope também');

  /* ── envelope malformado ── */
  const casos=[
    [{}, 'nao-e-envelope', 'objeto vazio'],
    [{aoii:'sync'}, 'nao-e-envelope', 'sem a parte cifrada'],
    [Object.assign({},env,{format_version:99}), 'formato-mais-novo', 'formato de uma versão futura'],
    [Object.assign({},env,{kdf:Object.assign({},env.kdf,{name:'scrypt'})}), 'kdf-desconhecida', 'derivação que não conhecemos'],
    [Object.assign({},env,{kdf:Object.assign({},env.kdf,{iterations:10})}), 'kdf-fora-de-faixa', 'poucas voltas de PBKDF2'],
    [Object.assign({},env,{cipher:Object.assign({},env.cipher,{iv:'AAAA'})}), 'envelope-corrompido', 'IV do tamanho errado'],
  ];
  for(const [entrada,esperado,descricao] of casos){
    let e2=null;
    try{ await c.decifrarDaNuvem(entrada,SENHA); }catch(e){ e2=e.message; }
    t.igual(e2,esperado,'recusa: '+descricao);
  }

  t.igual(c.ehEnvelopeCifrado(env),true,'o envelope é reconhecível sem tentar decifrar');
  t.igual(c.ehEnvelopeCifrado(SEGREDO),false,'e um backup comum não é confundido com envelope');

  /* ── a fronteira de confiança recusa o envelope ──
     é o que impede uma versão do app que não sabe decifrar de tratar a cópia
     cifrada como "backup vazio" e sobrescrever a nuvem com nada */
  const r=c.validateAndNormalizeData(env);
  t.igual(r.ok,false,'a validação recusa um envelope cifrado em vez de esvaziar os dados');
  t.verdadeiro(r.problemas[0].includes('cifrada'),'e diz por quê',
    'veio: '+JSON.stringify(r.problemas));

  const nadaConhecido=c.validateAndNormalizeData({coisaDeOutroApp:1,maisUma:'x'});
  t.igual(nadaConhecido.ok,false,
    'arquivo sem nenhum campo do Aoii é recusado, não vira um `data` vazio');
};
