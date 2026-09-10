/* O ciclo inteiro da sincronização, com dois aparelhos.

   Este é o roteiro de ensaio pedido, na ordem:
     registro antigo → senha → criptografia → gravação → releitura e
     decifragem → edição concorrente → conflito sem sobrescrita → queda de rede
     → retomada → recarga offline.

   Roda contra uma nuvem de mentira que reproduz aoii_get/aoii_put statement por
   statement. O MESMO roteiro roda contra as funções reais em homologação, por
   testes/ciclo-homologacao.js — é essa segunda passagem que prova que a
   mentira não mentiu. */
const {criarAmbiente}=require('./ambiente');
const {criarNuvemFalsa,criarArmazenamentoFalso}=require('./nuvem-falsa');

const HOJE='2026-09-05';
const CODIGO='HOMOLOG12345';
const SENHA='senha do ensaio 2026';

/* Cada "aparelho" é um contexto próprio: `sync`, `localStorage` e id de
   aparelho separados, uma nuvem só. */
function criarAparelho(nuvem){
  const c=criarAmbiente({},HOJE);
  c.fetch=nuvem.fetch;
  c.localStorage=criarArmazenamentoFalso();
  c.AbortController=AbortController;
  c.setTimeout=setTimeout; c.clearTimeout=clearTimeout;
  return c;
}

const dadosDe=(saldo,nome)=>({
  schemaVersion:1, saldoAtual:saldo, dinheiroVivo:0,
  cartoes:[{id:'c1',nome:nome||'Nubank',limite:2000}],
  transacoes:[], faturas:[], entradasExtras:[], comprasPlanejadas:[], metas:[],
});

module.exports=async function(t){
  console.log('\n\x1b[1mCiclo da sincronização (dois aparelhos)\x1b[0m');

  const nuvem=criarNuvemFalsa();
  const A=criarAparelho(nuvem);
  const B=criarAparelho(nuvem);

  if(!A.cryptoDisponivel()){ t.verdadeiro(false,'Web Crypto no ambiente de teste'); return; }

  /* ── 1. registro antigo, em texto puro, como está hoje na produção ── */
  nuvem.semearRegistroAntigo(CODIGO,dadosDe(1000));
  t.igual(nuvem.linhas.get(CODIGO).write_token_hash,null,
    'registro antigo não tem token de escrita — qualquer um grava nele');

  const sessaoAntesDaConsulta=JSON.stringify(A.sync);
  t.igual((await A.consultarSincronizacao(CODIGO)).resultado,'migrar',
    'a consulta identifica a cópia antiga antes de pedir uma senha');
  t.igual(JSON.stringify(A.sync),sessaoAntesDaConsulta,
    'a consulta não altera a sessão antes da pessoa confirmar a criação');
  t.igual((await A.consultarSincronizacao('CODIGO-NOVO')).resultado,'nova',
    'código ausente é identificado como uma criação nova');

  /* ── 2. o aparelho A abre com uma senha e reconhece que é migração ── */
  const abrir=await A.abrirSincronizacao(CODIGO,SENHA);
  t.igual(abrir.resultado,'migrar','registro em texto puro é reconhecido como "a migrar"');
  t.valor(abrir.dados.saldoAtual,1000,'e os dados de lá chegam pra decidir o que fazer');

  /* ── 3. migração: ensaio local, gravação, releitura ── */
  const mig=await A.migrarParaCifrado(abrir.dados);
  t.igual(mig.resultado,'enviado','a migração grava');
  t.igual(mig.revisao,1,'e a linha passa a ter revisão 1');

  /* ── 4. o que ficou no servidor não é legível ──
     Marcadores distintivos de propósito: um valor curto como "1000" aparece
     por acaso no base64 do texto cifrado e daria falso alarme. Nome de campo e
     valor com casas decimais não aparecem por acaso. */
  const guardado=nuvem.linhas.get(CODIGO);
  const comoTexto=JSON.stringify(guardado.data);
  t.igual(guardado.data.aoii,'sync','virou envelope');
  t.igual(comoTexto.includes('Nubank'),false,'o nome do cartão não está mais legível no servidor');
  t.igual(comoTexto.includes('saldoAtual'),false,'nem os nomes dos campos');
  t.igual(comoTexto.includes('schemaVersion'),false,'nem a versão do esquema');
  t.igual(comoTexto.includes('cartoes'),false,'nem a estrutura das listas');
  t.verdadeiro(guardado.write_token_hash!==null,'e a linha ganhou token de escrita');
  t.igual(Object.keys(guardado.data).sort().join(','),
    'aoii,cipher,device_id,format_version,kdf,revision,updated_at',
    'o servidor só vê o envelope: identificação, metadados e o texto cifrado');

  /* ── 5. o aparelho B entra com o mesmo código e a mesma senha ── */
  const abrirB=await B.abrirSincronizacao(CODIGO,SENHA);
  t.igual(abrirB.resultado,'aberta','o segundo aparelho decifra com a mesma senha');
  t.valor(abrirB.dados.saldoAtual,1000,'e vê os mesmos dados');

  /* o token de B tem que bater com o de A — é isto que o salt estável garante */
  const gravB=await B.enviarParaNuvem(dadosDe(1100));
  t.igual(gravB.resultado,'enviado',
    'e consegue GRAVAR: o token que ele derivou é o mesmo que A gravou',
    'se o salt girasse a cada gravação, aqui viria {erro:"token"}');
  t.igual(gravB.revisao,2,'revisão 2');

  /* ── 6. senha errada não abre e não estraga nada ── */
  const C=criarAparelho(nuvem);
  const errada=await C.abrirSincronizacao(CODIGO,'outra senha');
  t.igual(errada.resultado,'senha-errada','senha errada é recusada');
  t.igual(nuvem.linhas.get(CODIGO).revision,2,'e a nuvem não foi tocada');

  /* quem não abriu não grava */
  const semSenha=await C.enviarParaNuvem(dadosDe(9999));
  t.igual(semSenha.resultado,'precisa-senha','sem senha aberta, não grava');
  t.igual(nuvem.linhas.get(CODIGO).revision,2,'e de novo a nuvem fica intacta');

  /* ── 7. edição concorrente: A ainda pensa que está na revisão 1 ── */
  t.igual(A.sync.revisao,1,'A não sabe da gravação de B (não releu)');
  const conflito=await A.enviarParaNuvem(dadosDe(1200));
  t.igual(conflito.resultado,'conflito','A grava e leva conflito');
  t.igual(conflito.revisao,2,'com a revisão que está lá');

  const aindaB=await B.receberDaNuvem();
  t.igual(aindaB.resultado,'igual','e o dado de B continua sendo o que está na nuvem');
  const depoisDoConflito=await B.receberDaNuvem();
  t.valor((await (async()=>{
    const r=await C.abrirSincronizacao(CODIGO,SENHA); return r.dados;
  })()).saldoAtual,1100,'o conteúdo da nuvem é o de B — o de A não passou por cima');
  t.igual(depoisDoConflito.resultado,'igual','sem novidade pra quem já estava em dia');

  /* ── 8. A resolve o conflito lendo antes de gravar ── */
  const releu=await A.receberDaNuvem();
  t.igual(releu.resultado,'novidade','A relê e recebe a versão de B');
  t.valor(releu.dados.saldoAtual,1100,'com o saldo que B gravou');
  t.igual(A.sync.revisao,2,'e agora A está na revisão 2');
  const agoraVai=await A.enviarParaNuvem(dadosDe(1200));
  t.igual(agoraVai.resultado,'enviado','com a revisão em dia, a gravação passa');
  t.igual(agoraVai.revisao,3,'revisão 3');

  /* ── 9. queda de rede ── */
  nuvem.derrubarRede();
  const semRede=await A.enviarParaNuvem(dadosDe(1300));
  t.igual(semRede.resultado,'sem-conexao','queda de rede é desfecho nomeado, não exceção solta');
  t.igual(A.sync.status,'sem-conexao','e o status diz isso');
  t.igual(nuvem.linhas.get(CODIGO).revision,3,'nada foi gravado');
  const lerSemRede=await A.receberDaNuvem();
  t.igual(lerSemRede.resultado,'sem-conexao','ler também');

  /* ── 10. retomada ── */
  nuvem.religarRede();
  const retomou=await A.enviarParaNuvem(dadosDe(1300));
  t.igual(retomou.resultado,'enviado','com a rede de volta, a gravação vai');
  t.igual(retomou.revisao,4,'revisão 4');
  t.igual(A.sync.status,'sincronizada','e o status volta pra sincronizada');

  const codigoCorrompido='CORROMPIDO123';
  const linhaCorrompida=JSON.parse(JSON.stringify(nuvem.linhas.get(CODIGO)));
  linhaCorrompida.data.kdf.salt='@@';
  nuvem.linhas.set(codigoCorrompido,linhaCorrompida);
  const E=criarAparelho(nuvem);
  const abriuCorrompido=await E.abrirSincronizacao(codigoCorrompido,SENHA);
  t.igual(abriuCorrompido.resultado,'erro','envelope com salt corrompido vira erro nomeado');
  t.igual(E.sync.codigo,null,'envelope corrompido não deixa código parcial na sessão');
  t.igual(E.sync.chave,null,'nem deixa chave parcial na sessão');
  t.igual(E.sync.token,null,'nem deixa token parcial na sessão');
  nuvem.linhas.delete(codigoCorrompido);

  /* ── 11. recarga offline: sessão nova, sem senha em lugar nenhum ── */
  const D=criarAparelho(nuvem);
  t.igual(D.sincronizacaoDestrancada(),false,'sessão nova começa trancada');
  t.igual((await D.enviarParaNuvem(dadosDe(1))).resultado,'precisa-senha',
    'e não grava nada antes de a senha ser digitada');
  t.igual(Object.prototype.hasOwnProperty.call(D.sync,'senha'),false,'a senha não fica no estado da sessão');
  t.igual(D.sync.chave,null,'sessão nova também não tem a chave derivada');
  t.verdadeiro(A.sync.chave&&A.sync.chave.extractable===false,'sessão destrancada conserva só uma chave não exportável');
  let exportou=true;
  try{ await crypto.subtle.exportKey('raw',A.sync.chave); }catch(e){ exportou=false; }
  t.igual(exportou,false,'a chave da sessão não pode ser exportada');

  /* esquecer a senha no meio da sessão devolve o app pro estado trancado */
  A.esquecerSenha();
  t.igual(A.sync.chave,null,'esquecer a senha limpa a chave derivada');
  t.igual(A.sync.token,null,'inclusive o token de escrita');
  t.igual(A.sync.status,'precisa-senha','e o status avisa');
  t.igual((await A.enviarParaNuvem(dadosDe(7777))).resultado,'precisa-senha',
    'e a partir daí não grava mais');
  t.igual(nuvem.linhas.get(CODIGO).revision,4,'a nuvem continua na revisão 4');

  /* ── 12. o código gerado ── */
  const cod=A.gerarCodigoSync();
  t.igual(cod.length,12,'código novo tem 12 caracteres');
  t.verdadeiro(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(cod),
    'sem caracteres que se confundem lendo em voz alta (0/O, 1/I/L)');
  const muitos=new Set(); for(let i=0;i<200;i++) muitos.add(A.gerarCodigoSync());
  t.igual(muitos.size,200,'e 200 sorteios não repetem');

  const criptoReal=A.crypto;A.crypto=null;let semCripto='';
  try{ A.gerarCodigoSync(); }catch(e){ semCripto=e.message; }
  A.crypto=criptoReal;
  t.igual(semCripto,'cripto-indisponivel','não há fallback inseguro para gerar código');
};
