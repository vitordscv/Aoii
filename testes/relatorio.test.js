/* O resumo do mês é o documento que vai pro contador. Ele precisa separar o
   que JÁ passou pela conta do que ainda está por acontecer — sem essa divisão
   ninguém consegue conciliar o papel com um extrato bancário.

   Estes testes fixam o critério: é regime de CAIXA. "Realizado" quer dizer que
   o dinheiro entrou ou saiu até hoje. */
const {criarAmbiente}=require('./ambiente');

/* dia 12 de setembro: o salário (dia 20) ainda não caiu, o aluguel (dia 5) já
   saiu, a internet (dia 20) ainda não. */
const HOJE='2026-09-12';

const base=()=>({saldoAtual:5000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:8000,diaDoMes:20},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',moeda:'BRL',dataAlvo:'2026-12-31',
  gastosMensais:[
    {id:'alu',nome:'Aluguel',valor:1800,diaDoMes:5,categoria:'Casa',ativo:true,pagoEm:[]},
    {id:'net',nome:'Internet',valor:120,diaDoMes:20,categoria:'Casa',ativo:true,pagoEm:[]},
  ],
  cartoes:[{id:'c1',nome:'Nubank',limite:5000,diaVencimento:15}],
  faturas:[{cartaoId:'c1',ano:2026,mes:9,valor:0,pago:false,gastos:[
    {id:'g1',nome:'Notebook',valor:1250,categoria:'Casa'},
  ]}],
  transacoes:[
    {id:'t1',tipo:'gasto',nome:'Mercado',valor:300,data:'2026-09-03',categoria:'Mercado',metodo:'debito'},
    {id:'t2',tipo:'receita',nome:'Freela',valor:900,data:'2026-09-02',categoria:'Outros'},
  ],
  entradasExtras:[],comprasPlanejadas:[],
  dividas:[],metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],
  orcamentos:{},diasNaoTrabalhados:[],categorias:['Casa','Mercado','Outros']});

/* acha uma linha pelo começo do nome */
const acha=(lista,pedaco)=>lista.find(i=>String(i.nome).indexOf(pedaco)===0);
const somar=(lista,quais)=>lista.filter(i=>i.realizado===quais).reduce((s,i)=>s+i.val,0);

module.exports=function(t){

  console.log('\n\x1b[1mResumo do mês: receita só conta quando a data chega\x1b[0m');
  {
    const d=base();
    d.rendasRecorrentes=[{id:'r1',nome:'Salário',valor:3000,diaDoMes:5,ativo:true}];
    d.entradasExtras=[
      {id:'e1',nome:'Restituição',valor:400,recebido:400,modo:'unica',dataPrevista:'2026-09-08',feito:true,feitoEm:'2026-09-08'},
      {id:'e2',nome:'Venda da bicicleta',valor:700,recebido:0,modo:'unica',dataPrevista:'2026-09-28',feito:false},
    ];
    const c=criarAmbiente(d,HOJE);
    const itens=c.computeReceitasMesDetalhe();

    t.igual(acha(itens,'Salário').realizado,true,'renda recorrente do dia 5 já caiu');
    t.igual(acha(itens,'rp.rendaMensalPrincipal').realizado,false,
      'renda mensal do dia 20 ainda NÃO caiu no dia 12');
    t.igual(acha(itens,'Freela').realizado,true,'lançamento de receita do dia 02 entrou');
    t.igual(acha(itens,'Restituição').realizado,true,'entrada extra recebida entrou');

    const aReceber=acha(itens,'Venda da bicicleta');
    t.verdadeiro(!!aReceber,'entrada extra ainda não recebida aparece no documento',
      'ela sumia do relatório e o contador não sabia que era esperada');
    t.igual(aReceber&&aReceber.realizado,false,'…do lado do previsto');

    t.valor(somar(itens,true),4300,'realizado = 3000 + 900 + 400');
    t.valor(somar(itens,false),8700,'previsto = 8000 + 700');
  }

  console.log('\n\x1b[1mResumo do mês: renda diária vira dias trabalhados + dias a trabalhar\x1b[0m');
  {
    const d=base();
    d.tipoRenda='diaria'; d.rendaDiaria=200; d.rendaMensal={valor:0,diaDoMes:1};
    d.transacoes=[];
    const c=criarAmbiente(d,HOJE);
    const itens=c.computeReceitasMesDetalhe().filter(i=>i.tag==='rp.rendaDiaria');
    t.igual(itens.length,2,'duas linhas: o que já foi trabalhado e o que falta');
    /* setembro/2026: seg-sex. Até 12/09 (sábado) há 9 dias úteis; de 14 a 30, 13. */
    t.valor(somar(itens,true),9*200,'9 dias úteis até hoje');
    t.valor(somar(itens,false),13*200,'13 dias úteis restantes');
  }

  console.log('\n\x1b[1mResumo do mês: despesa separa o que saiu do que vai sair\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const map=c.computeCategoryDetalhe();
    const casa=map['Casa']||[];

    t.igual(acha(casa,'Aluguel').realizado,true,'conta fixa do dia 5 já saiu');
    t.igual(acha(casa,'Internet').realizado,false,'conta fixa do dia 20 ainda não saiu');
    t.igual(acha(casa,'Notebook').realizado,false,
      'compra no cartão só sai da conta quando a fatura é paga');
    t.igual(acha(map['Mercado']||[],'Mercado').realizado,true,'débito do dia 03 saiu');
  }

  console.log('\n\x1b[1mResumo do mês: marcar como pago antecipa o realizado\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    c.definirGastoFixoPago('net',2026,9,true);
    t.igual(acha(c.computeCategoryDetalhe()['Casa'],'Internet').realizado,true,
      'internet paga antes do dia 20 conta como realizada');

    d.faturas[0].pago=true;
    t.igual(acha(c.computeCategoryDetalhe()['Casa'],'Notebook').realizado,true,
      'fatura paga torna os itens dela realizados');
  }

  console.log('\n\x1b[1mResumo do mês: fatura vencida e não marcada conta como paga\x1b[0m');
  {
    /* mesmo critério das contas fixas: passou o dia, o app presume que saiu.
       O vencimento do Nubank é dia 15; em 20/09 já passou. */
    const d=base();
    const c=criarAmbiente(d,'2026-09-20');
    t.igual(acha(c.computeCategoryDetalhe()['Casa'],'Notebook').realizado,true,
      'depois do vencimento a fatura entra como realizada');
  }

};
