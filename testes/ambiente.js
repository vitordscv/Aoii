/* Monta um ambiente isolado pra rodar o motor de cálculo:
   - congela a data de "hoje", pra todo teste ser determinístico
   - injeta o objeto `data` do cenário
   - substitui por versões simples as funções que só servem pra desenhar
     na tela (L, formatBRL, uid, vibrate...) */
const vm=require('vm');
const {montarMotor,CAMINHO_PADRAO}=require('./extrair-motor');

const motorCache=new Map();
/* permite apontar pra outra versao do index.html:  node testes/executar.js <caminho> */
function motor(arquivo){
  const alvo=arquivo||process.env.AOII_INDEX||CAMINHO_PADRAO;
  if(!motorCache.has(alvo)) motorCache.set(alvo,montarMotor(alvo));
  return motorCache.get(alvo);
}

function criarAmbiente(dados,hojeISO,arquivo){
  const RealDate=Date;
  const congelado=new RealDate(hojeISO+'T10:00:00');
  /* Date que responde "hoje" de forma fixa, mas continua funcionando
     normalmente quando recebe argumentos */
  function DateFalso(...args){
    if(!(this instanceof DateFalso)) return new RealDate(...args).toString();
    return args.length===0 ? new RealDate(congelado.getTime()) : new RealDate(...args);
  }
  DateFalso.prototype=RealDate.prototype;
  DateFalso.now=()=>congelado.getTime();
  DateFalso.parse=RealDate.parse;
  DateFalso.UTC=RealDate.UTC;

  let contador=0;
  const ctx={
    data:dados,
    Date:DateFalso,
    Math,JSON,Number,String,Array,Object,Set,Map,isNaN,isFinite,parseInt,parseFloat,console,
    uid:()=>'id-teste-'+(++contador),
    /* dublê de tradução: devolve a própria chave, exceto onde o teste
       precisa que o marcador {…} sobreviva pra ser substituído */
    L:k=>({'compra.aPartirDe':'a partir de {mes}',
           'compra.semPrevisao':'sem previsão até {mes}',
           'rp.fixoDia':'fixo dia {dia}',
           'rp.rendaPorDia':'renda por dia ({n} dias)',
           'rp.saldoProjetado':'projetado até {data}'}[k]||k),
    formatBRL:n=>'R$ '+Number(n).toFixed(2),
    esc:s=>String(s),
    vibrate:()=>{},
    nomeCartao:id=>{const c=(dados.cartoes||[]).find(x=>x.id===id);return c?c.nome:'';},
    tipoInvest:id=>({id,label:id}),
    catIcon:()=>'',
    CATS:()=>(dados.categorias&&dados.categorias.length?dados.categorias:['Mercado','Transporte','Lazer','Saúde','Casa','Outros']),
    todayISO:()=>{const d=congelado;return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');},
    mediana:a=>{if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;},
    /* Web Crypto e companhia: o módulo de criptografia usa as mesmas APIs do
       navegador, então o teste roda contra o código de verdade, sem dublê */
    crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, Promise, Error,
  };
  ctx.window=ctx; ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(motor(arquivo),ctx,{filename:'motor-aoii.js'});
  return ctx;
}

module.exports={criarAmbiente};
