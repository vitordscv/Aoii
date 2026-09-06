/* Motor financeiro: linha do tempo, projeção, sugestão de compra e médias.
   Todo cenário roda com "hoje" congelado em 05/09/2026 (um sábado). */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';

const base=()=>({
  saldoAtual:1000, dinheiroVivo:100,
  tipoRenda:'mensal', rendaMensal:{valor:3000,diaDoMes:20}, rendaDiaria:0, diasTrabalho:[1,2,3,4,5],
  dataAlvo:'2026-11-30', idioma:'pt',
  gastosMensais:[{id:'g1',nome:'Net',valor:100,diaDoMes:15,ativo:true,categoria:'Casa'}],
  cartoes:[{id:'a',nome:'A',limite:1000,diaFechamento:10},{id:'b',nome:'B',limite:1000,diaFechamento:12}],
  faturas:[
    {id:'f9a',mes:9,ano:2026,valor:200,pago:false,gastos:[],cartaoId:'a'},
    {id:'f9b',mes:9,ano:2026,valor:50,pago:false,gastos:[],cartaoId:'b'},
    {id:'f10a',mes:10,ano:2026,valor:200,pago:false,gastos:[],cartaoId:'a'},
    {id:'f10b',mes:10,ano:2026,valor:50,pago:false,gastos:[],cartaoId:'b'},
    {id:'f11a',mes:11,ano:2026,valor:200,pago:false,gastos:[],cartaoId:'a'},
    {id:'f11b',mes:11,ano:2026,valor:50,pago:false,gastos:[],cartaoId:'b'}],
  transacoes:[], entradasExtras:[], comprasPlanejadas:[], metas:[], rendasRecorrentes:[],
  investimentos:[], viagens:[], orcamentos:{}, diasNaoTrabalhados:[], reservaMeses:3, reservaGuardado:0
});

module.exports=function(t){

  /* ── o bug original: com 2 cartões havia 2 faturas por mês, e a renda
        e os gastos fixos eram contados uma vez POR CARTÃO ── */
  grupoMultiCartao(t);
  grupoConsistencia(t);
  grupoSugestaoCompra(t);
  grupoGastoVariavel(t);
  grupoMedias(t);
};

function grupoMultiCartao(t){
  console.log('\n\x1b[1mLinha do tempo com vários cartões\x1b[0m');
  const ctx=criarAmbiente(base(),HOJE);
  const p=ctx.getTrajectoryPoints();

  t.igual(p.length,4,'um ponto por mês, não um por fatura (agora + set/out/nov)');
  t.igual(p.filter(x=>x.monthLabel==='Setembro/2026').length,1,'Setembro aparece uma vez só');
  t.valor(p[0].value,1100,'ponto inicial = saldo em conta + dinheiro vivo');
  /* 3000 de renda − 100 de gasto fixo − 250 das duas faturas = 2650 */
  t.valor(p[1].value,3750,'Setembro soma a renda UMA vez (1100 + 2650)');
  t.valor(p[2].value,6400,'Outubro segue somando 2650');
  t.valor(p[3].value,9050,'Novembro segue somando 2650');

  const m=ctx.mesMetrics(ctx.faturasPorMes()[0]);
  t.valor(m.renda,3000,'renda do mês contada uma vez com dois cartões');
  t.valor(m.despesas,350,'despesa do mês = gasto fixo + as duas faturas');
}

function grupoConsistencia(t){
  console.log('\n\x1b[1mHero, gráfico e linha do tempo concordam\x1b[0m');
  const d=base();
  d.entradasExtras=[{id:'e1',nome:'X',valor:1000,feito:false}];
  d.comprasPlanejadas=[{id:'p1',nome:'Y',valor:500,feito:false,parcelas:1}];
  const ctx=criarAmbiente(d,HOJE);

  const tot=ctx.computeTotals();
  const pontos=ctx.getTrajectoryPoints();
  const alvo=pontos.find(p=>p.monthLabel==='Novembro/2026');
  t.valor(tot.projetado,alvo.value,'hero é exatamente o ponto do gráfico no mês da data-alvo');

  /* o hero tem que ser a soma exata das suas partes */
  const soma=1100+tot.rendaTrabalho-tot.gastosMensaisTotal-tot.faturasPendentes
            +tot.entradasPendentes-tot.comprasPendentes-tot.variavelPrevisto-tot.aportesPrevistos;
  t.valor(tot.projetado,soma,'projeção = disponível + renda − fixos − faturas + entradas − compras − variável − aportes');

  const diario=ctx.computeDailyBudget();
  const set=pontos.find(p=>p.monthLabel==='Setembro/2026');
  t.valor(diario.disponivel,set.value+0,'"quanto posso gastar" parte do mesmo número do gráfico');

  /* item sem data prevista pesa já no mês corrente */
  t.valor(ctx.buildTimeline().find(p=>p.mes===9).extras,1000,'entrada extra sem data entra no mês corrente');
  t.valor(ctx.buildTimeline().find(p=>p.mes===9).compras,500,'compra planejada sem data entra no mês corrente');

  /* com data prevista, pesa no mês certo */
  const d2=base();
  d2.comprasPlanejadas=[{id:'p1',nome:'Y',valor:500,feito:false,parcelas:1,dataPrevista:'2026-11-10'}];
  const ctx2=criarAmbiente(d2,HOJE);
  t.valor(ctx2.buildTimeline().find(p=>p.mes===9).compras,0,'compra com data futura não pesa em setembro');
  t.valor(ctx2.buildTimeline().find(p=>p.mes===11).compras,500,'compra com data prevista pesa em novembro');
}

function grupoSugestaoCompra(t){
  console.log('\n\x1b[1mSugestão de "melhor mês pra comprar"\x1b[0m');
  const d=base();
  d.dataAlvo='2027-06-30';
  d.comprasPlanejadas=[{id:'p1',nome:'Note',valor:5400,feito:false,parcelas:1}];
  const ctx=criarAmbiente(d,HOJE);

  const item=d.comprasPlanejadas[0];
  const semEla=ctx.getTrajectoryPoints({exceto:'p1'});
  const comEla=ctx.getTrajectoryPoints();
  t.verdadeiro(semEla[1].value>comEla[1].value,
    'a projeção usada na sugestão não desconta a própria compra',
    'sem ela '+semEla[1].value+' vs com ela '+comEla[1].value);

  const sug=ctx.suggestPurchaseTiming(item);
  t.verdadeiro(!!sug&&sug.ok,'encontra um mês viável','veio '+JSON.stringify(sug));

  /* o mês escolhido tem que cobrir o valor + folga e continuar cobrindo depois */
  const i=semEla.findIndex(p=>sug.when.includes(p.monthLabel));
  t.verdadeiro(i>0,'a sugestão aponta um mês da projeção','when='+sug.when);
  const daliPraFrente=semEla.slice(i,i+13).map(p=>p.value);
  t.verdadeiro(Math.min(...daliPraFrente)>=5400+150,
    'o saldo aguenta a compra no mês indicado e nos 12 meses seguintes',
    'menor saldo à frente: '+Math.min(...daliPraFrente));
  t.verdadeiro(semEla[i-1].value<5400+150,
    'o mês anterior não aguentava — a sugestão é o primeiro que aguenta',
    'mês anterior: '+semEla[i-1].value);

  /* uma compra que cabe agora e continua cabendo é liberada na hora */
  const d2=base(); d2.comprasPlanejadas=[{id:'p2',nome:'Fone',valor:200,feito:false,parcelas:1}];
  const ctx2=criarAmbiente(d2,HOJE);
  t.igual(ctx2.suggestPurchaseTiming(d2.comprasPlanejadas[0]).when,'compra.agora',
    'compra pequena com saldo folgado libera agora');
}

function grupoGastoVariavel(t){
  console.log('\n\x1b[1mGasto variável médio\x1b[0m');
  const d=base();
  d.transacoes=[
    {id:'t1',nome:'a',valor:900,categoria:'Outros',metodo:'debito',data:'2026-05-10'},
    {id:'t2',nome:'b',valor:100,categoria:'Outros',metodo:'debito',data:'2026-06-10'},
    {id:'t3',nome:'c',valor:300,categoria:'Outros',metodo:'debito',data:'2026-07-10'},
    {id:'t4',nome:'d',valor:500,categoria:'Outros',metodo:'debito',data:'2026-08-10'},
    {id:'t5',nome:'e',valor:50,categoria:'Outros',metodo:'debito',data:'2026-09-02'},
    {id:'t6',nome:'f',valor:9999,categoria:'Outros',metodo:'pix',data:'2026-08-11',tipo:'receita'}];
  const ctx=criarAmbiente(d,HOJE);

  t.valor(ctx.gastoVariavelMedio(),300,'média dos 3 últimos meses FECHADOS (jun+jul+ago)/3, ignorando maio');
  const set=ctx.buildTimeline().find(p=>p.mes===9);
  t.valor(set.variavel,300*(25/30),'no mês corrente conta só a parte proporcional aos dias que faltam');
  const out=ctx.buildTimeline().find(p=>p.mes===10);
  t.valor(out.variavel,300,'nos meses futuros conta a média inteira');

  const d2=base();
  d2.transacoes=[{id:'r',nome:'so receita',valor:5000,categoria:'Outros',metodo:'pix',data:'2026-07-10',tipo:'receita'}];
  t.valor(criarAmbiente(d2,HOJE).gastoVariavelMedio(),0,'entrada não vira gasto variável');
}

function grupoMedias(t){
  console.log('\n\x1b[1mMédias mensais\x1b[0m');
  const ctx=criarAmbiente(base(),HOJE);
  /* set/out/nov, 2650 cada — dividido por 3 MESES, não por 6 faturas */
  t.valor(ctx.sobraMensalMedia(),2650,'sobra média divide por mês, não por fatura');
  t.valor(ctx.rendaMediaMensal(),3000,'renda média divide por mês, não por fatura');

  const d=base();
  d.faturas=d.faturas.filter(f=>f.mes!==10); // outubro sem fatura nenhuma
  const ctx2=criarAmbiente(d,HOJE);
  const p=ctx2.getTrajectoryPoints();
  t.igual(p.length,4,'mês sem fatura continua na projeção (renda e fixos acontecem nele)');
  t.valor(p[2].value-p[1].value,2900,'no mês sem fatura sobra renda − gastos fixos');
}
