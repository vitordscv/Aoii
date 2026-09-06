/* Datas: dias que não existem no mês, contagem de dias trabalhados e
   ocorrências de conta fixa. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';   // sábado

const base=()=>({saldoAtual:0,dinheiroVivo:0,tipoRenda:'diaria',rendaDiaria:100,diasTrabalho:[1,2,3,4,5],
  rendaMensal:{valor:0,diaDoMes:5},idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],
  metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[]});

module.exports=function(t){
  console.log('\n\x1b[1mDia do mês que não existe\x1b[0m');
  const ctx=criarAmbiente(base(),HOJE);
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

  t.igual(iso(ctx.dataNoMes(2027,2,31)),'2027-02-28','31 de fevereiro vira o último dia (28)');
  t.igual(iso(ctx.dataNoMes(2028,2,31)),'2028-02-29','em ano bissexto vira 29');
  t.igual(iso(ctx.dataNoMes(2026,4,31)),'2026-04-30','31 de abril vira 30');
  t.igual(iso(ctx.dataNoMes(2026,9,15)),'2026-09-15','dia que existe passa direto');
  t.igual(iso(ctx.dataNoMes(2026,9,0)),'2026-09-01','dia 0 vira dia 1');

  console.log('\n\x1b[1mConta fixa no dia 31 cai no mês certo\x1b[0m');
  const d=base();
  d.tipoRenda='mensal'; d.rendaMensal={valor:3000,diaDoMes:31};
  d.gastosMensais=[{id:'g',nome:'Aluguel',valor:1200,diaDoMes:31,ativo:true,categoria:'Casa'}];
  d.faturas=[{id:'f2',mes:2,ano:2027,valor:0,pago:false,gastos:[],cartaoId:null}];
  const c2=criarAmbiente(d,HOJE);
  const fev=c2.monthMetrics({ano:2027,mes:2,valor:0,pago:true,gastos:[]});
  t.valor(fev.renda,3000,'salário do dia 31 entra em fevereiro (travado no dia 28)');
  t.valor(fev.gastosMensaisCusto,1200,'aluguel do dia 31 entra em fevereiro');

  console.log('\n\x1b[1mDias trabalhados\x1b[0m');
  const d3=base();
  d3.diasTrabalho=[4,5,6];   // qui, sex, sáb
  const c3=criarAmbiente(d3,HOJE);
  const setembro=c3.monthMetrics({ano:2026,mes:9,valor:0,pago:true,gastos:[]});
  /* de 05/09 (sáb) a 30/09: sáb 5,12,19,26 · qui 10,17,24 · sex 11,18,25 = 10 dias */
  t.valor(setembro.renda,10*100,'conta os dias de trabalho restantes do mês, incluindo hoje');

  d3.diasNaoTrabalhados=['2026-09-10','2026-09-11'];
  const c4=criarAmbiente(d3,HOJE);
  t.valor(c4.monthMetrics({ano:2026,mes:9,valor:0,pago:true,gastos:[]}).renda,8*100,
    'dias marcados como não trabalhados saem da conta');

  console.log('\n\x1b[1mMês já encerrado\x1b[0m');
  const d5=base();
  d5.faturas=[{id:'fp',mes:7,ano:2026,valor:300,pago:false,gastos:[],cartaoId:null}];
  const c5=criarAmbiente(d5,HOJE);
  const julho=c5.monthMetrics(d5.faturas[0]);
  t.valor(julho.renda,0,'mês passado não gera renda futura');
  t.valor(julho.despesas,300,'mas a fatura em aberto do mês passado continua devendo');
  t.verdadeiro(julho.isPast,'mês passado é marcado como encerrado');
  const pontos=c5.getTrajectoryPoints();
  t.verdadeiro(!pontos.some(p=>p.monthLabel==='Julho/2026'),
    'mês encerrado não vira ponto no gráfico','pontos: '+pontos.map(p=>p.monthLabel).join(','));
};
