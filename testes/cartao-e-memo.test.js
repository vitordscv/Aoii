/* Duas coisas que o motor faz e que nenhum teste executava.

   Descobertas medindo cobertura de verdade — instrumentando o ambiente e
   contando chamadas — e não procurando o nome da função nos arquivos de teste.
   Essa segunda conta engana nos dois sentidos: dá por descoberto o que só é
   chamado de dentro de outra função, e dá por descoberto o que aparece num
   comentário.

   1. `computeCartao()` diz quanto de um cartão está comprometido. É o número
      que decide se cabe mais uma compra, e aparece no resumo do mês, na lista
      de cartões e na linha do tempo.
   2. `invalidarTimeline()` é um invariante do guia: `buildTimeline()` guarda o
      resultado, e quem mexe em `data` sem invalidar deixa a tela mostrando
      número velho. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-12';

const base=()=>({saldoAtual:5000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:6000,diaDoMes:5},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',moeda:'BRL',dataAlvo:'2026-12-31',
  cartoes:[
    {id:'c1',nome:'Roxo',limite:10000,diaFechamento:28,diaVencimento:5},
    {id:'c2',nome:'Laranja',limite:2000,diaFechamento:10,diaVencimento:17},
  ],
  faturas:[],gastosMensais:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],
  dividas:[],metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],
  orcamentos:{},diasNaoTrabalhados:[],categorias:['Casa','Outros']});

module.exports=function(t){

  console.log('\n\x1b[1mQuanto de um cartão já está comprometido\x1b[0m');
  {
    const d=base();
    d.faturas=[
      {id:'f1',cartaoId:'c1',ano:2026,mes:9,valor:300,pago:false,gastos:[
        {id:'g1',nome:'Mercado',valor:200,categoria:'Casa'},
        {id:'g2',nome:'Livro',valor:100,categoria:'Outros'},
      ]},
      {id:'f2',cartaoId:'c1',ano:2026,mes:10,valor:0,pago:false,gastos:[
        {id:'g3',nome:'Parcela 2/3',valor:150,categoria:'Outros'},
      ]},
      {id:'f3',cartaoId:'c2',ano:2026,mes:9,valor:80,pago:false,gastos:[]},
    ];
    const c=criarAmbiente(d,HOJE);
    const roxo=c.computeCartao('c1');

    t.valor(roxo.comprometido,750,'soma a fatura e as compras de TODOS os meses em aberto');
    t.valor(roxo.limite,10000,'o limite vem do cartão');
    t.valor(roxo.disponivel,9250,'e o disponível é a diferença');
    t.valor(roxo.pct,7.5,'a porcentagem usada');

    /* o número do outro cartão não pode se misturar: duas faturas no mesmo mês
       são duas dívidas distintas, e é aqui que isso costuma vazar */
    t.valor(c.computeCartao('c2').comprometido,80,'cada cartão conta só o que é dele');

    t.valor(roxo.faturaAberta,300,'a fatura aberta é só a do mês corrente, sem o valor fechado dela');
    t.igual(roxo.faturaAbertaMes,'Setembro','e diz de que mês ela é');
  }

  console.log('\n\x1b[1mO que já foi pago sai da conta do cartão\x1b[0m');
  {
    const d=base();
    d.faturas=[
      {id:'f1',cartaoId:'c1',ano:2026,mes:9,valor:300,pago:false,gastos:[
        {id:'g1',nome:'Pago',valor:200,pago:true,categoria:'Casa'},
        {id:'g2',nome:'Em aberto',valor:100,categoria:'Outros'},
      ]},
      {id:'f2',cartaoId:'c1',ano:2026,mes:8,valor:900,pago:true,gastos:[
        {id:'g3',nome:'De agosto',valor:500,categoria:'Outros'},
      ]},
    ];
    const c=criarAmbiente(d,HOJE);
    const r=c.computeCartao('c1');
    t.valor(r.comprometido,400,'compra marcada como paga não pesa mais no limite');
    t.valor(r.limite-r.disponivel,400,'e o disponível acompanha');
  }

  console.log('\n\x1b[1mCartão sem limite informado\x1b[0m');
  {
    const d=base();
    d.cartoes=[{id:'c1',nome:'Sem limite',limite:0,diaFechamento:28,diaVencimento:5}];
    d.faturas=[{id:'f1',cartaoId:'c1',ano:2026,mes:9,valor:500,pago:false,gastos:[]}];
    const c=criarAmbiente(d,HOJE);
    const r=c.computeCartao('c1');
    /* sem limite não há porcentagem que faça sentido: 500/0 daria Infinity e a
       barra da tela iria para o infinito */
    t.valor(r.pct,0,'sem limite informado, a porcentagem é zero e não Infinity');
    t.valor(r.comprometido,500,'mas o comprometido continua sendo contado');

    const some=c.computeCartao('nao-existe');
    t.valor(some.limite,0,'cartão que não existe devolve zeros em vez de quebrar');
    t.valor(some.comprometido,0,'e nada comprometido');
  }

  console.log('\n\x1b[1mA linha do tempo é guardada, e invalidar é o que a solta\x1b[0m');
  {
    const d=base();
    d.faturas=[{id:'f1',cartaoId:'c1',ano:2026,mes:9,valor:1000,pago:false,gastos:[]}];
    const c=criarAmbiente(d,HOJE);

    const primeira=c.buildTimeline();
    t.verdadeiro(c.buildTimeline()===primeira,
      'duas chamadas seguidas devolvem o MESMO objeto — o resultado é guardado');

    /* mexer em `data` por fora não avisa ninguém */
    d.faturas[0].valor=9999;
    t.verdadeiro(c.buildTimeline()===primeira,
      'mudar os dados sem invalidar não muda o que a tela receberia',
      'é exatamente por isso que o guia manda invalidar antes de recalcular');

    c.invalidarTimeline();
    const depois=c.buildTimeline();
    t.verdadeiro(depois!==primeira,'invalidar solta o resultado guardado');

    const somaDe=pontos=>pontos.reduce((s,p)=>s+(p.m?p.m.despesas:0),0);
    t.verdadeiro(somaDe(depois)>somaDe(primeira),
      `e o número novo aparece (${somaDe(primeira)} → ${somaDe(depois)})`);
  }

  console.log('\n\x1b[1mQuem começa hoje começa com o quê\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const novo=c.defaultData();
    /* o estado inicial é o que toda pessoa nova recebe, e ninguém o executava */
    t.valor(novo.saldoAtual,0,'sem saldo inventado');
    t.valor(novo.dinheiroVivo,0,'nem dinheiro em espécie');
    t.igual(Array.isArray(novo.transacoes)&&novo.transacoes.length===0,true,'sem lançamentos');
    t.igual(Array.isArray(novo.cartoes)&&novo.cartoes.length===0,true,'sem cartões');
    t.igual(Array.isArray(novo.metas)&&novo.metas.length===0,true,'sem metas');
    /* `categorias` NÃO nasce no estado inicial: quem devolve a lista padrão é
       CATS(), quando o campo está vazio. Sem isso, o primeiro seletor de
       categoria do app abriria em branco. */
    t.igual(novo.categorias,undefined,'a lista de categorias não nasce no estado');
    t.verdadeiro(c.CATS().length>0,'mas CATS() entrega as padrão quando ela falta');

    /* a IA nasce desligada por AUSÊNCIA, e quem lê exige `=== true`. Um campo
       ausente que fosse lido como verdadeiro ligaria o envio de dados pro
       Google sem ninguém ter pedido. */
    t.igual(novo.iaAtiva,undefined,'a IA não nasce ligada nem desligada: nasce ausente');
    t.igual(novo.onboardingCompleto,false,'e o primeiro uso ainda não aconteceu');
    t.igual(novo.tipoRenda,'mensal','salário mensal é o caso comum');
    t.valor(novo.reservaMeses,3,'reserva de três meses como ponto de partida');
    t.igual(novo.reservaNaConta,true,'contada dentro do saldo até alguém dizer o contrário');
  }

};
