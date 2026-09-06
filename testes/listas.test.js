/* Entrada x gasto, parcelamento, metas e o desfazer do Diário. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';

const base=()=>({saldoAtual:1000,dinheiroVivo:0,tipoRenda:'mensal',rendaMensal:{valor:0,diaDoMes:20},
  rendaDiaria:0,diasTrabalho:[1,2,3,4,5],idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[],cartoes:[{id:'a',nome:'Nu',limite:2000,diaFechamento:10}],
  faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],metas:[],rendasRecorrentes:[],
  investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[],categorias:['Mercado','Outros']});

module.exports=function(t){

  console.log('\n\x1b[1mEntrada não pode contar como gasto\x1b[0m');
  const d=base();
  d.transacoes=[
    {id:'g1',nome:'Mercado',valor:200,categoria:'Mercado',metodo:'debito',data:'2026-09-02'},
    {id:'g2',nome:'Café',valor:30,categoria:'Outros',metodo:'dinheiro',data:'2026-09-05'},
    {id:'r1',nome:'Reembolso',valor:500,categoria:'Outros',metodo:'pix',data:'2026-09-03',tipo:'receita'},
    {id:'r2',nome:'Presente',valor:900,categoria:'Outros',metodo:'pix',data:'2026-09-05',tipo:'receita'}];
  const ctx=criarAmbiente(d,HOJE);

  t.valor(ctx.computeMonthSpend(2026,9),230,'gasto do mês soma só os gastos (200+30), não as entradas');
  t.valor(ctx.computeCategoryBreakdown().total,230,'gasto por categoria ignora entradas');
  t.valor(ctx.computeWeekSummary().gastoSemana,230,'últimos 7 dias ignora entradas E inclui o dia de hoje');
  t.valor(ctx.computeGastoMesPorCategoria()['Mercado'],200,'orçamento por categoria ignora entradas');
  t.valor(ctx.transacoesGasto().length,2,'só dois lançamentos são gasto de verdade');
  const insights=ctx.computeInsights();
  t.valor(insights[1]&&Number(String(insights[1].value).replace(/[^\d.]/g,'')),200,
    'o "maior gasto" é o Mercado de 200, não o Presente de 900');

  console.log('\n\x1b[1mDesfazer a remoção de um lançamento\x1b[0m');
  /* replica o que a tela faz: remover e depois desfazer */
  function ciclo(tipo){
    const dd=base();
    dd.transacoes=[{id:'x',nome:'t',valor:100,categoria:'Outros',metodo:'pix',data:'2026-09-04',tipo}];
    const c=criarAmbiente(dd,HOJE);
    const item=dd.transacoes[0];
    c.removerTransacao('x');
    const depoisDeApagar=dd.saldoAtual;
    /* desfazer, com o mesmo sinal que removerTransacao usou */
    const sinal=item.tipo==='receita'?-1:1;
    dd.transacoes.splice(0,0,item);
    dd.saldoAtual=dd.saldoAtual-sinal*item.valor;
    return {depoisDeApagar,depoisDeDesfazer:dd.saldoAtual};
  }
  const gasto=ciclo(undefined);
  t.valor(gasto.depoisDeApagar,1100,'apagar um gasto de 100 devolve o dinheiro');
  t.valor(gasto.depoisDeDesfazer,1000,'desfazer volta ao saldo original');
  const receita=ciclo('receita');
  t.valor(receita.depoisDeApagar,900,'apagar uma entrada de 100 tira o dinheiro');
  t.valor(receita.depoisDeDesfazer,1000,'desfazer volta ao saldo original (não desconta de novo)');

  console.log('\n\x1b[1mParcelamento fecha a soma\x1b[0m');
  [[100,3],[10,3],[0.05,3],[1234.56,7],[99.99,2]].forEach(([valor,n])=>{
    const dd=base();
    const c=criarAmbiente(dd,HOJE);
    c.lancarParcelamento('Teste',valor,n,2026,9,'Outros','a');
    const parcelas=dd.faturas.flatMap(f=>f.gastos).filter(g=>/Teste/.test(g.nome));
    const soma=parcelas.reduce((s,g)=>s+g.valor,0);
    t.valor(soma,valor,'R$ '+valor+' em '+n+'x soma exatamente R$ '+valor);
    t.igual(parcelas.length,n,'gera '+n+' parcelas');
    t.verdadeiro(parcelas.every(g=>Math.round(g.valor*100)===g.valor*100||Math.abs(g.valor*100-Math.round(g.valor*100))<1e-6),
      'parcelas de '+valor+' em '+n+'x têm no máximo 2 casas',parcelas.map(g=>g.valor).join(','));
  });

  console.log('\n\x1b[1mAporte automático de meta move dinheiro de verdade\x1b[0m');
  const dm=base();
  dm.metas=[{id:'m',nome:'Viagem',valorAlvo:1000,valorGuardado:400,aporteMensal:250,ultimoAporte:'2026-8'}];
  const cm=criarAmbiente(dm,HOJE);
  const patrimonioAntes=cm.patrimonioCalculado();
  const mudou=cm.aplicarAportesAutomaticos();
  t.verdadeiro(mudou,'o aporte do mês é aplicado quando o mês virou');
  t.valor(dm.saldoAtual,750,'o valor sai da conta');
  t.valor(dm.metas[0].valorGuardado,650,'e entra na meta');
  t.valor(cm.patrimonioCalculado(),patrimonioAntes,'patrimônio não cresce sozinho');
  t.verdadeiro(!cm.aplicarAportesAutomaticos(),'não aplica duas vezes no mesmo mês');

  /* teto: não passa do alvo */
  const dm2=base();
  dm2.metas=[{id:'m',nome:'Quase lá',valorAlvo:1000,valorGuardado:900,aporteMensal:250,ultimoAporte:'2026-8'}];
  const cm2=criarAmbiente(dm2,HOJE);
  cm2.aplicarAportesAutomaticos();
  t.valor(dm2.metas[0].valorGuardado,1000,'o aporte para no alvo da meta');
  t.valor(dm2.saldoAtual,900,'e só o que entrou de fato sai da conta (100, não 250)');

  console.log('\n\x1b[1mReserva de emergência: na conta ou guardada à parte\x1b[0m');
  {
    const naConta=base(); naConta.reservaGuardado=2000; naConta.reservaNaConta=true;
    const c1=criarAmbiente(naConta,HOJE);
    t.valor(c1.reservaContaNoPatrimonio(),0,'"na conta": não entra de novo no patrimônio');
    t.valor(c1.patrimonioCalculado(),1000,'patrimônio = só o saldo (a reserva já está dentro dele)');

    const fora=base(); fora.reservaGuardado=2000; fora.reservaNaConta=false;
    const c2=criarAmbiente(fora,HOJE);
    t.valor(c2.reservaContaNoPatrimonio(),2000,'"guardada à parte": entra somada');
    t.valor(c2.patrimonioCalculado(),3000,'patrimônio = saldo + reserva');

    /* quem já usava o app e nunca respondeu não pode ver o número mudar */
    const antigo=base(); antigo.reservaGuardado=2000; delete antigo.reservaNaConta;
    const c3=criarAmbiente(antigo,HOJE);
    t.valor(c3.patrimonioCalculado(),1000,'sem resposta ainda, vale "na conta" — patrimônio não muda sozinho');

    /* a reserva não interfere em quem guarda em metas */
    const misto=base(); misto.reservaGuardado=500; misto.reservaNaConta=false;
    misto.metas=[{id:'m',nome:'Viagem',valorAlvo:5000,valorGuardado:800,aporteMensal:0}];
    misto.dinheiroVivo=200;
    t.valor(criarAmbiente(misto,HOJE).patrimonioCalculado(),2500,
      'saldo 1000 + vivo 200 + meta 800 + reserva 500');
  }

  console.log('\n\x1b[1mMédia da fatura para a reserva de emergência\x1b[0m');
  const dr=base();
  dr.gastosMensais=[{id:'g',nome:'Aluguel',valor:1000,diaDoMes:10,ativo:true,categoria:'Casa'}];
  dr.cartoes=[{id:'a',nome:'A',limite:0},{id:'b',nome:'B',limite:0}];
  /* dois cartões por mês: a média tem que ser POR MÊS, não por fatura */
  dr.faturas=[
    {id:'1',mes:6,ano:2026,valor:100,pago:true,gastos:[],cartaoId:'a'},
    {id:'2',mes:6,ano:2026,valor:100,pago:true,gastos:[],cartaoId:'b'},
    {id:'3',mes:7,ano:2026,valor:200,pago:true,gastos:[],cartaoId:'a'},
    {id:'4',mes:7,ano:2026,valor:200,pago:true,gastos:[],cartaoId:'b'},
    {id:'5',mes:8,ano:2026,valor:300,pago:true,gastos:[],cartaoId:'a'},
    {id:'6',mes:8,ano:2026,valor:300,pago:true,gastos:[],cartaoId:'b'}];
  const cr=criarAmbiente(dr,HOJE);
  /* meses fechados: jun 200, jul 400, ago 600 → média 400; + aluguel 1000 */
  t.valor(cr.custoMensalEssencial(),1400,'média usa os 3 últimos MESES somando os cartões de cada um');
};
