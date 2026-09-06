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
  grupoSemChuteDeGasto(t);
  grupoMedias(t);
  grupoAosPoucos(t);
};

/* quem te deve pagando em pedaços: o valor que falta se divide pelos meses */
function grupoAosPoucos(t){
  console.log('\n\x1b[1mEntrada recebida aos poucos\x1b[0m');
  const comEntrada=(extra)=>{
    const d=base(); d.dataAlvo='2027-06-30';
    d.entradasExtras=[Object.assign({id:'e1',nome:'Geovane',valor:1200,feito:false},extra)];
    return criarAmbiente(d,HOJE);
  };

  /* desligado: continua tudo no mês corrente, como antes */
  const normal=comEntrada({});
  t.valor(normal.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,1200,
    'sem marcar, entra tudo de uma vez no mês corrente');

  /* ligado, até dezembro: setembro a dezembro = 4 meses */
  const dividido=comEntrada({modo:'aosPoucos',dataPrevista:'2026-12-20'});
  const linha=dividido.buildTimeline();
  const meses=[9,10,11,12].map(m=>linha.find(p=>p.mes===m&&p.ano===2026).extras);
  meses.forEach((v,i)=>t.valor(v,300,'mês '+[9,10,11,12][i]+' recebe 1200/4 = 300'));
  t.valor(linha.find(p=>p.ano===2027&&p.mes===1).extras,0,'depois do prazo não entra mais nada');
  t.valor(meses.reduce((s,v)=>s+v,0),1200,'a soma das parcelas continua sendo o valor cheio');

  const f=dividido.fatiasAosPoucos(dividido===null?null:{modo:'aosPoucos',dataPrevista:'2026-12-20',valor:1200});
  t.igual(f&&f.meses,4,'o rótulo da linha diz 4 meses');
  t.valor(f&&f.porMes,300,'e R$ 300 por mês');

  /* ligado sem data: não dá pra dividir, então volta ao comportamento normal */
  const semData=comEntrada({modo:'aosPoucos'});
  t.valor(semData.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,1200,
    'marcado mas sem data, não inventa divisão');
  t.igual(semData.fatiasAosPoucos({modo:'aosPoucos',valor:1200}),null,
    'sem data o rótulo pede a data em vez de mostrar um número');

  /* data no passado: cai tudo no mês corrente, sem parcelas negativas */
  const passado=comEntrada({modo:'aosPoucos',dataPrevista:'2026-07-01'});
  t.valor(passado.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,1200,
    'data já vencida vira uma parcela só, no mês corrente');

  /* o total pendente da lista não muda — é o que ainda falta receber */
  const tot=dividido.computeTotals();
  t.valor(tot.entradasPendentes,1200,'o "a receber" continua mostrando o valor cheio que falta');

  /* sem previsão: continua a receber, mas sai da projeção */
  const semPrevisao=comEntrada({modo:'semPrevisao'});
  t.valor(semPrevisao.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,0,
    '"sem previsão" não entra em nenhum mês da projeção');
  const tp=semPrevisao.computeTotals();
  t.valor(tp.entradasPendentes,1200,'mas continua contando como valor a receber');
  t.valor(tp.entradasSemPrevisao,1200,'e é identificado à parte');
  t.valor(tp.entradasNaProjecao,0,'nada dele entra na conta do saldo previsto');
  const semProj=semPrevisao.getTrajectoryPoints();
  const comProj=comEntrada({}).getTrajectoryPoints();
  t.verdadeiro(semProj[1].value<comProj[1].value,
    'a projeção fica mais conservadora do que contar tudo hoje',
    semProj[1].value+' vs '+comProj[1].value);

  grupoPagamentoParcial(t,comEntrada);
}

/* pagamentos chegando em pedaços imprevisíveis, anotados um a um */
function grupoPagamentoParcial(t,comEntrada){
  console.log('\n\x1b[1mAnotando quanto já foi pago\x1b[0m');

  const c=comEntrada({modo:'semPrevisao',recebido:0});
  t.valor(c.restanteEntrada({valor:1200,recebido:0}),1200,'nada recebido, falta tudo');
  t.valor(c.restanteEntrada({valor:1200,recebido:450}),750,'recebeu 450, faltam 750');
  t.valor(c.restanteEntrada({valor:1200,recebido:1200}),0,'quitado, não falta nada');
  t.valor(c.restanteEntrada({valor:1200,recebido:1500}),0,'pagou a mais: nunca fica negativo');

  /* o que entra na projeção é sempre o que FALTA */
  const parcial=comEntrada({modo:'unica',recebido:900});
  t.valor(parcial.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,300,
    'a projeção conta só os 300 que ainda faltam, não os 1200 combinados');
  t.valor(parcial.computeTotals().entradasPendentes,300,'o "a receber" também mostra o que falta');

  const quitado=comEntrada({modo:'unica',recebido:1200});
  t.valor(quitado.buildTimeline().find(p=>p.mes===9&&p.ano===2026).extras,0,
    'entrada já quitada não entra mais na projeção');

  /* dividido aos poucos usa o saldo devedor, não o total original */
  const dividido=comEntrada({modo:'aosPoucos',dataPrevista:'2026-12-20',recebido:400});
  const f=dividido.fatiasAosPoucos({modo:'aosPoucos',dataPrevista:'2026-12-20',valor:1200,recebido:400});
  t.igual(f&&f.meses,4,'ainda são 4 meses');
  t.valor(f&&f.porMes,200,'mas divide os 800 que faltam, não os 1200');

  /* registrar um pagamento: entra no saldo, aparece no Diário, abate a dívida */
  const d=base(); d.saldoAtual=1000; d.entradasExtras=[{id:'e1',nome:'Guilherme',valor:1200,feito:false,modo:'semPrevisao',recebido:0}];
  const ctx=criarAmbiente(d,HOJE);
  ctx.registrarReceita('Guilherme',450,'Outros','pix');
  d.entradasExtras[0].recebido=450;
  t.valor(d.saldoAtual,1450,'o pagamento entra no saldo');
  t.igual(d.transacoes.length,1,'e vira um lançamento no Diário');
  t.igual(d.transacoes[0].tipo,'receita','marcado como entrada, não como gasto');
  t.valor(ctx.restanteEntrada(d.entradasExtras[0]),750,'a dívida cai para 750');
  t.valor(ctx.transacoesGasto().length,0,'e não polui o gasto do mês');
}

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
            +tot.entradasNaProjecao-tot.comprasPendentes-tot.aportesPrevistos;
  t.valor(tot.projetado,soma,'projeção = disponível + renda − fixos − faturas + entradas − compras − aportes');

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

/* o app não estima mais um "gasto variável médio" e desconta da projeção:
   o que você lançou no Diário já baixou o saldo, e o futuro não leva chute */
function grupoSemChuteDeGasto(t){
  console.log('\n\x1b[1mProjeção sem chute de gasto\x1b[0m');
  const d=base();
  d.transacoes=[
    {id:'t1',nome:'a',valor:900,categoria:'Outros',metodo:'debito',data:'2026-05-10'},
    {id:'t2',nome:'b',valor:100,categoria:'Outros',metodo:'debito',data:'2026-06-10'},
    {id:'t3',nome:'c',valor:300,categoria:'Outros',metodo:'debito',data:'2026-07-10'},
    {id:'t4',nome:'d',valor:500,categoria:'Outros',metodo:'debito',data:'2026-08-10'}];
  const ctx=criarAmbiente(d,HOJE);
  const limpo=criarAmbiente(base(),HOJE);

  const p=k=>ctx.buildTimeline().find(x=>x.mes===k);
  t.igual(p(9).variavel,undefined,'o ponto do gráfico não carrega mais um gasto estimado');
  t.igual(ctx.computeTotals().variavelPrevisto,undefined,'os totais não têm mais "variável previsto"');
  t.valor(p(10).delta,limpo.buildTimeline().find(x=>x.mes===10).delta,
    'histórico do Diário não muda mais o saldo previsto dos meses futuros');
  t.valor(ctx.computeTotals().projetado,limpo.computeTotals().projetado,
    'a projeção do hero é a mesma com ou sem histórico de gastos');
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
