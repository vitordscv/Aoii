/* Quando o app deve perguntar "qual lado você quer?" — e quando não deve.

   O diálogo aparecia sempre que a REVISÃO divergia. Revisão divergente não é
   conteúdo divergente: dois aparelhos que abrem no mesmo dia aplicam o mesmo
   aporte automático, gravam o mesmo conteúdo e chegam a revisões diferentes.
   A pessoa via dois lados idênticos e tinha que escolher entre eles.

   Um diálogo que aparece sem haver decisão a tomar ensina a clicar sem ler —
   e aí, no dia em que a escolha importa, clica-se sem ler também.

   Os três desfechos estão aqui, e o terceiro é o que não pode se perder de
   vista: quando os dois lados divergem de verdade, tem que continuar
   perguntando. */
const {criarNuvemFalsa}=require('./nuvem-falsa');
const {montarMotor}=require('./extrair-motor');
const vm=require('vm');
const path=require('path');

const ID='CODIGOTESTE1';

function criarAparelho(nuvem,espiao){
  const guardado={};
  const c={
    console, Math, JSON, Number, String, Array, Object, Set, Map, Date, URL,
    isNaN, isFinite, parseInt, parseFloat, TextEncoder, TextDecoder,
    crypto: require('crypto').webcrypto,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),
    fetch:nuvem.fetch, AbortController, setTimeout, clearTimeout,
    localStorage:{getItem:k=>(k in guardado?guardado[k]:null),
                  setItem:(k,v)=>{guardado[k]=String(v);},
                  removeItem:k=>{delete guardado[k];}},
    /* dublês do que a interface faria; o de mostrarConflitoSync é o que
       registra se a pessoa foi incomodada */
    L:k=>k, esc:s=>String(s), formatBRL:n=>'R$ '+Number(n).toFixed(2),
    vibrate:()=>{}, render:()=>{}, setSaveStatus:()=>{}, renderStatusSync:()=>{},
    espelhoPendente:()=>false, retomarEspelho:()=>{}, confirmarRevisaoLocal:()=>{},
    persist:async()=>{},
    adotarDadosDeFora:bruto=>({ok:true,data:JSON.parse(JSON.stringify(bruto))}),
    mostrarConflitoSync:async()=>{ espiao.vezes++; return espiao.resposta; },
    document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]},
  };
  c.window=c; c.globalThis=c;
  vm.createContext(c);
  vm.runInContext(montarMotor(path.join(__dirname,'..','dist','index.html')),c);
  return c;
}

const dados=(saldo,tema)=>({
  schemaVersion:1, saldoAtual:saldo, dinheiroVivo:0, tema:tema||'onda',
  cartoes:[], transacoes:[], faturas:[], entradasExtras:[],
  comprasPlanejadas:[], metas:[],
});

module.exports=async function(t){
  console.log('\n\x1b[1mConflito: só pergunta quando há escolha\x1b[0m');

  const nuvem=criarNuvemFalsa();
  const espiao={vezes:0,resposta:'local'};
  const A=criarAparelho(nuvem,espiao);

  if(!A.cryptoDisponivel()){ t.verdadeiro(false,'Web Crypto no ambiente de teste'); return; }

  /* grava na nuvem como se fosse outro aparelho: mesma senha, mesmo token,
     revisão certa — o que muda é só quem escreveu */
  const gravarPorFora=async conteudo=>{
    const atual=nuvem.get(ID);
    const envelope=await A.cifrarParaNuvem(conteudo,A.sync.chave,{
      revision:atual.revision+1, device_id:'outro-aparelho', salt:A.sync.salt});
    const r=nuvem.put(ID,envelope,atual.revision,A.sync.token);
    if(!r.ok) throw new Error('gravação por fora falhou: '+JSON.stringify(r));
    return r.revision;
  };
  const oQueEstaLa=async()=>A.decifrarDaNuvem(nuvem.get(ID).data,A.sync.chave);

  A.setSyncCode(ID);
  t.igual((await A.abrirSincronizacao(ID,'senha-de-ensaio-1234')).resultado,'nova',
    'a sincronização abre num código novo');

  A.data=dados(1000);
  t.igual((await A.enviarParaNuvem(A.data)).resultado,'enviado','a primeira gravação vai');
  t.igual(typeof A.sync.ultimoConhecido,'string','e o aparelho passa a lembrar o que a nuvem tem');

  /* ── 1. os dois lados com o mesmo conteúdo ──
     Outro aparelho gravou exatamente o mesmo texto (o mesmo automático
     aplicado no mesmo dia). A revisão anda; o conteúdo não. */
  const antes=A.sync.revisao;
  await gravarPorFora(A.data);
  t.igual(nuvem.get(ID).revision>antes,true,'a revisão da nuvem andou');

  espiao.vezes=0;
  const r1=await A.empurrarParaNuvem();
  t.igual(espiao.vezes,0,'lados iguais: não pergunta nada');
  t.igual(r1.resultado,'enviado','e trata como resolvido');
  t.igual(A.sync.revisao,nuvem.get(ID).revision,'o contador local acerta o passo');

  /* ── 2. a nuvem está como este aparelho a deixou ──
     Só o contador local ficou para trás. Mandar por cima não perde nada. */
  A.sync.revisao=A.sync.revisao-1;   // contador atrasado, de propósito
  A.data=dados(1000,'sakura');       // a pessoa só trocou o tema
  espiao.vezes=0;
  const r2=await A.empurrarParaNuvem();
  t.igual(espiao.vezes,0,'nuvem intocada: não pergunta, só reenvia');
  t.igual(r2.resultado,'enviado','a troca de tema sobe');
  t.igual((await oQueEstaLa()).tema,'sakura','e chega lá');

  /* ── 3. divergência de verdade ──
     A nuvem tem algo que este aparelho não tem. Aqui perguntar É o certo, e a
     pergunta não pode ter sumido junto com as outras duas. */
  await gravarPorFora(dados(7777,'matcha'));
  A.data=dados(2222,'onda');
  espiao.vezes=0; espiao.resposta='local';
  const r3=await A.empurrarParaNuvem();
  t.igual(espiao.vezes,1,'os dois lados mudaram: aí sim pergunta');
  t.igual(r3.resultado,'enviado','e respeita a escolha');
  t.valor((await oQueEstaLa()).saldoAtual,2222,'o lado escolhido é o que fica');

  /* ── 4. e escolher a nuvem continua funcionando ── */
  await gravarPorFora(dados(5555,'noite'));
  A.data=dados(3333,'onda');
  espiao.vezes=0; espiao.resposta='nuvem';
  const r4=await A.empurrarParaNuvem();
  t.igual(espiao.vezes,1,'pergunta de novo');
  t.igual(r4.resultado,'adotado','e adota o lado da nuvem quando é o escolhido');
  t.valor(A.data.saldoAtual,5555,'os dados de cá viram os de lá');

  /* ── a lembrança não sobrevive a esquecer a senha ──
     Sem senha não há como conferir o que a nuvem tem; guardar a lembrança
     seria decidir com base em algo que já não dá pra verificar. */
  A.esquecerSenha();
  t.igual(A.sync.ultimoConhecido,null,'esquecer a senha esquece a lembrança junto');
};
