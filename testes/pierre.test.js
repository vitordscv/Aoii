/* O De-Para do Pierre Finance: o que o banco devolve virando lançamento.

   É a parte da integração que mexe com dinheiro, e duas coisas aqui podem
   estragar meses de registro sem ninguém notar na hora:

   - sincronizar duas vezes e duplicar tudo;
   - trazer compra de cartão para o Diário, contando o mesmo real duas vezes,
     uma aqui e outra dentro da fatura. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-12';

const base=()=>({saldoAtual:1000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:5000,diaDoMes:5},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',moeda:'BRL',dataAlvo:'2026-12-31',
  categorias:['Mercado','Transporte','Lazer','Saúde','Casa','Outros'],
  gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],
  comprasPlanejadas:[],dividas:[],metas:[],rendasRecorrentes:[],
  investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[]});

/* como o Pierre devolve */
const doBanco=(id,desc,valor,tipo,extra)=>Object.assign({
  id, description:desc, amount:valor, type:tipo, date:'2026-09-10',
  category:'Alimentação', status:'POSTED',
  account_type:'BANK', account_subtype:'CHECKING_ACCOUNT', account_name:'Conta',
},extra||{});

/* A forma REAL de `get-accounts`, conferida contra a API com chave de verdade
   em 12/09/2026. Uma conta nao usa os mesmos nomes de campo que uma transacao:
   aqui e `id`/`type`/`balance`/`connectorName`, la e `account_id`/`account_type`.
   A primeira versao disto foi inventada — `accountId`, `accountType`,
   `accountBalance` — e o teste passava porque testava a invencao. */
const conta=(id,tipo,saldo,banco)=>({
  id, connectorName:banco||'Nubank', name:'Conta', customName:null, marketingName:null,
  type:tipo, subtype:tipo==='BANK'?'CHECKING_ACCOUNT':'CREDIT_CARD',
  /* o saldo vem como TEXTO com ponto decimal: "1268.01" */
  balance:String(saldo.toFixed ? saldo.toFixed(2) : saldo), currencyCode:'BRL',
  itemIsActive:true,
});

module.exports=function(t){

  console.log('\n\x1b[1mUma transação do banco vira um lançamento\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const saida=c.transacaoDoPierre(doBanco('tx1','Padaria do Zé',-42.9,'DEBIT'));
    t.igual(saida.tipo,'gasto','DEBIT vira gasto');
    t.valor(saida.valor,42.9,'o valor entra positivo, como o app guarda');
    t.igual(saida.data,'2026-09-10','a data vem como está');
    t.igual(saida.nome,'Padaria do Zé','e a descrição também');
    t.igual(saida.idExterno,'tx1','com o id do Pierre junto, pra não duplicar depois');
    t.igual(saida.categoria,'Mercado','"Alimentação" cai em Mercado');

    const entrada=c.transacaoDoPierre(doBanco('tx2','Salário',5000,'CREDIT'));
    t.igual(entrada.tipo,'receita','CREDIT vira receita');
    t.valor(entrada.valor,5000,'também positivo');

    /* o campo declarado manda no sinal: um DEBIT com valor positivo continua
       sendo saída, senão uma devolução viraria renda */
    t.igual(c.transacaoDoPierre(doBanco('tx3','Estranha',42,'DEBIT')).tipo,'gasto',
      'quando o sinal discorda do tipo, o tipo é quem manda');
  }

  console.log('\n\x1b[1mCompra no cartão NÃO entra no Diário\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const cartao=doBanco('tx9','Notebook',-2500,'DEBIT',
      {account_type:'CREDIT',account_subtype:'CREDIT_CARD'});
    t.igual(c.transacaoDoPierre(cartao),null,
      'transação de cartão é recusada');

    const plano=c.planoDeSincronizacaoPierre([],[
      doBanco('tx1','Mercado',-100,'DEBIT'),
      cartao,
    ]);
    t.igual(plano.novas.length,1,'só a da conta entra');
    t.igual(plano.doCartao.length,1,'e a do cartão é contada à parte, pra poder avisar');
  }

  console.log('\n\x1b[1mSincronizar duas vezes não duplica\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const vindas=[doBanco('tx1','Mercado',-100,'DEBIT'),doBanco('tx2','Farmácia',-30,'DEBIT')];

    const primeira=c.planoDeSincronizacaoPierre([conta('a','BANK',900)],vindas);
    t.igual(primeira.novas.length,2,'na primeira vez, as duas são novas');
    c.aplicarSincronizacaoPierre(primeira);
    t.igual(d.transacoes.length,2,'e entram no Diário');

    const segunda=c.planoDeSincronizacaoPierre([conta('a','BANK',900)],vindas);
    t.igual(segunda.novas.length,0,'na segunda, nenhuma é nova');
    t.igual(segunda.repetidas.length,2,'as duas são reconhecidas como já lançadas');
    c.aplicarSincronizacaoPierre(segunda);
    t.igual(d.transacoes.length,2,'o Diário continua com duas',
      'sem o id externo, cada sincronização dobraria o extrato');

    /* repetida DENTRO da mesma leva também */
    const comRepetida=c.planoDeSincronizacaoPierre([],[
      doBanco('tx7','Nova',-10,'DEBIT'),doBanco('tx7','Nova',-10,'DEBIT')]);
    t.igual(comRepetida.novas.length,1,'id repetido na mesma resposta entra uma vez só');
  }

  console.log('\n\x1b[1mO saldo é a soma das contas de banco\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const contas=[conta('a','BANK',1500.5),conta('b','BANK',300),
                  conta('c','CREDIT',-2200),conta('d','INVESTMENT',9000)];
    t.valor(c.saldoDoPierre(contas),1800.5,
      'soma só as de banco: cartão é dívida e investimento não é saldo em conta');

    const plano=c.planoDeSincronizacaoPierre(contas,[]);
    t.valor(plano.saldo,1800.5,'o plano traz o saldo calculado');
    t.valor(plano.diferencaDeSaldo,800.5,'e a diferença pro que está no app (1000)');
    t.igual(plano.contasDeBanco,2,'diz quantas contas de banco vieram');
    t.igual(plano.instituicoes.length,1,'e de quantas instituições');
  }

  console.log('\n\x1b[1mAplicar só mexe no que foi combinado\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const plano=c.planoDeSincronizacaoPierre([conta('a','BANK',2500)],
      [doBanco('tx1','Mercado',-100,'DEBIT')]);

    const r=c.aplicarSincronizacaoPierre(plano,{trazerSaldo:false});
    t.igual(r.lancadas,1,'lança o que era pra lançar');
    t.valor(d.saldoAtual,1000,'e não encosta no saldo quando não foi pedido');

    c.aplicarSincronizacaoPierre(
      c.planoDeSincronizacaoPierre([conta('a','BANK',2500)],[]),{trazerSaldo:true});
    t.valor(d.saldoAtual,2500,'pedindo o saldo, ele passa a ser o do banco');
    t.verdadeiro(!!d.pierreSincronizadoEm,'e fica registrado quando foi');
  }

  console.log('\n\x1b[1mO que não dá pra aproveitar é recusado, não chutado\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const plano=c.planoDeSincronizacaoPierre([],[
      doBanco('a','Sem data',-10,'DEBIT',{date:null}),
      doBanco('b','Data torta',-10,'DEBIT',{date:'10/09/2026'}),
      doBanco('c','Valor zero',0,'DEBIT'),
      doBanco('d','Boa',-10,'DEBIT'),
    ]);
    t.igual(plano.novas.length,1,'só a que dá pra aproveitar entra');
    t.igual(plano.recusadas.length,3,'as outras três são separadas, não inventadas');
  }

  console.log('\n\x1b[1mA categoria que a pessoa usa ganha da tabela\x1b[0m');
  {
    const d=base();
    d.categorias=['Rolê','Mercado','Outros'];
    const c=criarAmbiente(d,HOJE);
    t.igual(c.categoriaDoPierre('Rolê'),'Rolê','categoria própria é respeitada');
    t.igual(c.categoriaDoPierre('rolê'),'Rolê','sem ligar pra maiúscula');
    t.igual(c.categoriaDoPierre('Alimentação'),'Mercado','a tabela cobre o resto');
    t.igual(c.categoriaDoPierre('Transporte'),'Outros',
      'categoria que o app não tem cai em Outros, em vez de criar uma sozinha');
    t.igual(c.categoriaDoPierre('Coisa que ninguém viu'),'Outros','e o desconhecido também');
  }

  console.log('\n\x1b[1mA forma que a API devolve de verdade\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    /* copia fiel do que veio com chave real, so com id e nome trocados */
    const comoVem=[
      {id:'f71a9461',name:'gold',customName:null,marketingName:null,type:'CREDIT',
       subtype:'CREDIT_CARD',balance:'520.38',connectorName:'Nubank',itemIsActive:true},
      {id:'84eb73a1',name:'Nu Pagamentos S.A. - Instituição de Pagamento',customName:null,
       marketingName:'Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)',
       type:'BANK',subtype:'CHECKING_ACCOUNT',balance:'1268.01',connectorName:'Nubank',
       itemIsActive:true},
      {id:'0960aea0',name:'Carteira',customName:'Carteira Pierre',marketingName:null,
       type:'BANK',subtype:'SAVINGS',balance:'0.00',connectorName:null,itemIsActive:true},
    ];
    t.valor(c.saldoDoPierre(comoVem),1268.01,
      'o saldo sai das contas de banco, e o cartão fica de fora');
    const p=c.planoDeSincronizacaoPierre(comoVem,[]);
    t.igual(p.contasDeBanco,2,'duas das três são conta de banco');
    t.igual(p.instituicoes.join(','),'Nubank','e a instituição tem nome');

    /* "1268.01" nao pode virar 126801: parseNum() leria o ponto como milhar */
    t.valor(c.numeroDoPierre('1268.01'),1268.01,'"1268.01" é mil duzentos e sessenta e oito');
    t.valor(c.numeroDoPierre('0.00'),0,'"0.00" é zero');
    t.valor(c.numeroDoPierre(null),0,'e o que não é número vira zero, não NaN');
  }

  console.log('\n\x1b[1mLançamento que o banco ainda não confirmou\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const pendente=doBanco('tp','Restaurante',-80,'DEBIT',{status:'PENDING'});
    t.igual(c.transacaoDoPierre(pendente),null,
      'PENDING não entra no Diário: o valor ainda pode mudar');
    const firme=doBanco('tf','Restaurante',-80,'DEBIT',{status:'POSTED'});
    t.verdadeiro(!!c.transacaoDoPierre(firme),'POSTED entra');

    const plano=c.planoDeSincronizacaoPierre([],[pendente,firme]);
    t.igual(plano.novas.length,1,'só o confirmado vira lançamento novo');
    t.igual(plano.recusadas.length,1,'e o outro é contado, não some calado');
  }

  console.log('\n\x1b[1mO cartão sai da conta de crédito\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    /* a forma real de uma conta CREDIT, conferida com chave de verdade */
    const cartao={id:'cc1',name:'gold',customName:null,type:'CREDIT',
      subtype:'CREDIT_CARD',balance:'520.38',connectorName:'Nubank',
      creditData:{creditLimit:700,balanceDueDate:'2026-08-28',balanceCloseDate:null}};
    const faturas=[
      {accountId:'cc1',dueDate:'2026-08-28',billClosingDate:'2026-08-21',totalAmount:1049.43},
      {accountId:'cc1',dueDate:'2026-07-28',billClosingDate:'2026-07-21',totalAmount:903.03},
    ];
    const k=c.cartaoDoPierre(cartao,faturas);
    t.igual(k.nome,'Nubank gold','o nome junta banco e cartão');
    t.valor(k.limite,700,'o limite vem de creditData');
    t.igual(k.diaVencimento,28,'o vencimento sai de balanceDueDate');
    t.igual(k.diaFechamento,21,'e o fechamento da fatura, porque a conta manda nulo');
    t.igual(k.idExterno,'cc1','com o id do Pierre junto, pra reencontrar depois');
    t.igual(c.cartaoDoPierre({id:'b1',type:'BANK'},[]),null,'conta de banco não vira cartão');
  }

  console.log('\n\x1b[1mCada mês tira o valor de UMA fonte\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'520.38',connectorName:'Nubank',
      creditData:{creditLimit:700,balanceDueDate:'2026-08-28'}};
    const faturas=[
      {accountId:'cc1',dueDate:'2026-08-28',totalAmount:1049.43},
      {accountId:'cc1',dueDate:'2026-07-28',totalAmount:903.03},
    ];
    const parcelas={data:{purchases:[{purchaseDate:'2026-06-20',totalAmount:47.82,
      installments:[
        {installmentNumber:1,totalInstallments:3,amount:15.94,dueDate:'2026-08-20',isPaid:true,status:'POSTED',description:'Compra'},
        {installmentNumber:2,totalInstallments:3,amount:15.94,dueDate:'2026-10-20',isPaid:false,status:'PENDING',description:'Compra'},
        {installmentNumber:3,totalInstallments:3,amount:15.94,dueDate:'2026-11-20',isPaid:false,status:'PENDING',description:'Compra'}]}]}};

    /* o pagamento da fatura de agosto, como ele aparece no extrato do cartão */
    const pagouAgosto=[{id:'pg1',description:'Pagamento de fatura',amount:-1049.43,
      type:'CREDIT',date:'2026-09-02',status:'POSTED',operation_type:'PAGAMENTO',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',category:'Pagamento de cartão de crédito'}];

    const p=c.planoDoCartaoPierre([cartao],faturas,parcelas,HOJE,pagouAgosto);
    const acha=(ano,mes)=>p.faturas.find(f=>f.ano===ano&&f.mes===mes);

    t.igual(acha(2026,8).origem,'banco-paga',
      'fatura fechada com pagamento confirmado usa o número do banco');
    t.valor(acha(2026,8).valor,1049.43,'com o valor que o banco diz');
    t.igual(acha(2026,9).origem,'saldo','o mês corrente usa o saldo do cartão');
    t.valor(acha(2026,9).valor,520.38,'que é o que se deve hoje');
    t.igual(acha(2026,10).origem,'parcelas','mês futuro usa as parcelas');
    t.valor(acha(2026,10).valor,15.94,'somando só as que vencem nele');

    /* a parcela de agosto NÃO entra: aquele mês já tem a fatura do banco, e
       somar as duas contaria o mesmo dinheiro duas vezes */
    t.valor(acha(2026,8).valor,1049.43,'a parcela de agosto não é somada à fatura de agosto');

    const chaves=p.faturas.map(f=>f.ano+'-'+f.mes);
    t.igual(chaves.length,new Set(chaves).size,'nenhum mês aparece duas vezes');

    /* SEM a prova de pagamento, a fatura fechada não é trazida */
    const semProva=c.planoDoCartaoPierre([cartao],faturas,parcelas,HOJE,[]);
    t.igual(semProva.faturas.find(f=>f.ano===2026&&f.mes===8),undefined,
      'sem confirmação do banco, a fatura fechada NÃO entra',
      'trazer como paga por ter passado o mês esconderia uma dívida atrasada');
    t.igual(semProva.faturasSemPagamento.length,2,
      'e o plano diz quantas ficaram de fora, em vez de calar');
    t.verdadeiro(!!semProva.faturas.find(f=>f.ano===2026&&f.mes===9),
      'o mês corrente continua entrando, que é o que se deve agora');
  }

  console.log('\n\x1b[1mO total do banco é o teto da fatura, não uma linha a mais\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'500.00',connectorName:'Nubank',creditData:{creditLimit:2000,balanceDueDate:'2026-09-28'}};

    /* primeiro a importação cria o cartão */
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],[],{},HOJE,[]));
    const cartaoId=d.cartoes.find(k=>k.idExterno==='cc1').id;

    /* agora a pessoa lança um gasto à mão dentro da fatura do mês */
    const fatura=d.faturas.find(f=>f.ano===2026&&f.mes===9&&f.cartaoId===cartaoId);
    fatura.gastos.push({id:'g1',nome:'Livraria',valor:100,pago:false,categoria:'Lazer'});

    /* e sincroniza de novo: o banco continua dizendo 500 */
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],[],{},HOJE,[]));

    /* Este é o defeito que a revisão pegou: 500 do banco + 100 do gasto = 600,
       e o comprometido passava a ser um número que não existe em lugar nenhum. */
    const uso=c.computeCartao(cartaoId);
    t.valor(uso.comprometido,500,
      'o comprometido é o total do banco, e não o total mais o que foi digitado');
    t.valor(fatura.valor,400,'o valor da fatura vira o RESTO: 500 do banco menos os 100 lançados');
    t.igual((fatura.gastos||[]).length,1,'e o gasto digitado continua lá, com nome e categoria');

    /* o que foi digitado passando do total do banco não é escondido */
    fatura.gastos.push({id:'g2',nome:'Outro',valor:900,pago:false,categoria:'Outros'});
    const r=c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],[],{},HOJE,[]));
    t.valor(fatura.valor,0,'com o digitado passando do total, o resto vai a zero');
    t.igual(r.estourando.length,1,
      'e a diferença é devolvida, porque costuma ser gasto lançado duas vezes');
  }

  console.log('\n\x1b[1mParcela de cada cartão fica no cartão dela\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const nu={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',balance:'100.00',
      connectorName:'Nubank',creditData:{creditLimit:700,balanceDueDate:'2026-09-28'}};
    const itau={id:'cc2',name:'platinum',type:'CREDIT',subtype:'CREDIT_CARD',balance:'50.00',
      connectorName:'Itau',creditData:{creditLimit:3000,balanceDueDate:'2026-09-10'}};

    const parcelas={data:{purchasesByCard:[
      {cardName:'Nubank',purchases:[{purchaseDate:'2026-08-01',totalAmount:200,installments:[
        {installmentNumber:2,totalInstallments:2,amount:100,dueDate:'2026-10-01',isPaid:false,description:'Fone'}]}]},
      {cardName:'Itau',purchases:[{purchaseDate:'2026-08-02',totalAmount:600,installments:[
        {installmentNumber:2,totalInstallments:2,amount:300,dueDate:'2026-10-02',isPaid:false,description:'Mala'}]}]},
    ]}};

    const p=c.planoDoCartaoPierre([nu,itau],[],parcelas,HOJE,[]);
    const outubro=p.faturas.filter(f=>f.ano===2026&&f.mes===10);
    t.igual(outubro.length,2,'outubro tem uma fatura para cada cartão');
    const doNu=outubro.find(f=>f.cartaoExterno==='cc1');
    const doItau=outubro.find(f=>f.cartaoExterno==='cc2');
    t.valor(doNu.valor,100,'a parcela do Nubank fica no Nubank');
    t.valor(doItau.valor,300,'e a do Itaú, no Itaú',
      'juntar tudo no primeiro cartão inflava o limite de um e esvaziava o do outro');

    c.aplicarCartaoPierre(p);
    const idNu=d.cartoes.find(k=>k.idExterno==='cc1').id;
    const idItau=d.cartoes.find(k=>k.idExterno==='cc2').id;
    t.valor(c.computeCartao(idNu).comprometido,200,'o limite do Nubank conta 100 agora + 100 em outubro');
    t.valor(c.computeCartao(idItau).comprometido,350,'e o do Itaú, 50 agora + 300 em outubro');
  }

  console.log('\n\x1b[1mSincronizar o cartão duas vezes não duplica\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'100.00',connectorName:'Nubank',creditData:{creditLimit:700,balanceDueDate:'2026-08-28'}};
    const faturas=[{accountId:'cc1',dueDate:'2026-08-28',totalAmount:900}];
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE));
    const depoisDaPrimeira={c:d.cartoes.length,f:d.faturas.length};
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE));
    t.igual(d.cartoes.length,depoisDaPrimeira.c,'continua um cartão só');
    t.igual(d.faturas.length,depoisDaPrimeira.f,'e o mesmo número de faturas');

    /* o valor é do banco; o "pago" é de quem usa */
    d.faturas.find(f=>f.mes===9).pago=true;
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE));
    t.verdadeiro(d.faturas.find(f=>f.mes===9).pago,
      'fatura que a pessoa marcou como paga não volta a dever');
  }

  console.log('\n\x1b[1mGasto fixo é sugestão, nunca decisão\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const fixo=(desc,valor,dia,mes)=>doBanco('t'+desc+mes,desc,-valor,'DEBIT',
      {date:'2026-0'+mes+'-'+dia,account_id:'a',account_name:'Nubank'});
    const vindas=[
      fixo('TIM',129.99,'05','7'), fixo('TIM',129.99,'05','8'),
      fixo('Pagamento de fatura',903.03,'10','7'),
      fixo('Pagamento de fatura',1049.43,'10','8'),
      fixo('Padaria',12.50,'03','7'),   /* valor muda muito: não é fixo */
      fixo('Padaria',48.00,'19','8'),
      fixo('Uma vez so',300,'02','8'),  /* um mês só */
    ];
    const sug=c.sugerirGastosFixosPierre(vindas,HOJE);
    const nomes=sug.map(g=>g.nome);
    t.verdadeiro(nomes.some(n=>/TIM/.test(n)),'o que repete no mesmo valor é sugerido');
    t.verdadeiro(!nomes.some(n=>/fatura/i.test(n)),
      'pagamento de fatura fica de fora: já é a fatura do cartão');
    t.verdadeiro(!nomes.some(n=>/Padaria/.test(n)),
      'valor que varia muito não é conta fixa');
    t.verdadeiro(!nomes.some(n=>/Uma vez/.test(n)),
      'um mês só não é repetição');
    const tim=sug.find(g=>/TIM/.test(g.nome));
    t.valor(tim.valor,129.99,'com o valor mais recente');
    t.igual(tim.diaDoMes,5,'e o dia em que costuma cair');

    const antes=d.gastosMensais.length;
    c.aplicarGastosFixosPierre([],HOJE);
    t.igual(d.gastosMensais.length,antes,'lista vazia não cria nada');
    c.aplicarGastosFixosPierre([tim],HOJE);
    t.igual(d.gastosMensais.length,antes+1,'marcando, o fixo é criado');
    t.verdadeiro(d.gastosMensais[0].ativo===true&&d.gastosMensais[0].inicioMes===9,
      'valendo a partir do mês corrente, e não retroativo');
  }

  console.log('\n\x1b[1mAssinatura no cartão entra; parcela, não\x1b[0m');
  {
    const d=base();
    d.cartoes=[{id:'k1',nome:'Nubank gold',limite:700,diaFechamento:21,diaVencimento:28,idExterno:'cc1'}];
    const c=criarAmbiente(d,HOJE);
    const noCartao=(id,desc,valor,mes,extra)=>Object.assign({
      id, description:desc, amount:-valor, type:'DEBIT',
      date:'2026-0'+mes+'-24', category:'Serviços', status:'POSTED',
      account_type:'CREDIT', account_subtype:'CREDIT_CARD', account_name:'Nubank',
    },extra||{});

    const vindas=[
      /* a assinatura: mesmo valor, todo mês, sem fim à vista */
      noCartao('s1','Claude Pro',114.38,'7'),
      noCartao('s2','Claude Pro',114.38,'8'),
      /* a parcela: mesmo valor, todo mês, mas ACABA. O Pierre marca. */
      noCartao('p1','Fone de ouvido',100,'7',
        {credit_card_data:{installmentNumber:1,totalInstallments:3,isIndividualInstallment:true}}),
      noCartao('p2','Fone de ouvido',100,'8',
        {credit_card_data:{installmentNumber:2,totalInstallments:3,isIndividualInstallment:true}}),
      /* e a que só o texto denuncia, sem credit_card_data */
      noCartao('q1','Cadeira (1/4)',80,'7'),
      noCartao('q2','Cadeira (2/4)',80,'8'),
    ];

    const sug=c.sugerirGastosFixosPierre(vindas,HOJE,'k1');
    const nomes=sug.map(g=>g.nome);
    t.verdadeiro(nomes.some(n=>/Claude Pro/.test(n)),
      'assinatura cobrada no cartão é sugerida',
      'olhar só o débito em conta perde quem paga streaming no crédito');
    t.verdadeiro(!nomes.some(n=>/Fone/.test(n)),
      'parcela marcada em credit_card_data NÃO vira conta fixa',
      'ela acaba; virar fixo cobraria o valor para sempre na projeção');
    t.verdadeiro(!nomes.some(n=>/Cadeira/.test(n)),
      'e o "(2/4)" na descrição também basta para recusar');

    const claude=sug.find(g=>/Claude Pro/.test(g.nome));
    t.verdadeiro(claude.cartao===true,'a sugestão sai marcada como cobrada no cartão');
    t.igual(claude.cartaoId,'k1','apontando para o cartão que veio do Pierre');
    t.igual(claude.diaDoMes,24,'com o dia em que cai');

    c.aplicarGastosFixosPierre([claude],HOJE);
    const criado=d.gastosMensais[d.gastosMensais.length-1];
    t.verdadeiro(criado.cartao===true&&criado.cartaoId==='k1',
      'e o gasto fixo nasce ligado ao cartão',
      'sem isso o dinheiro sairia da conta no dia, em vez de entrar na fatura');
  }

  console.log('\n\x1b[1mDesmarcar todas quer dizer nenhuma\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank'),conta('b','BANK',500,'Inter')];
    const vindas=[
      doBanco('t1','Do Nu',-100,'DEBIT',{account_id:'a',account_name:'Nubank'}),
      doBanco('t2','Do Inter',-50,'DEBIT',{account_id:'b',account_name:'Inter'}),
    ];

    /* quem nunca escolheu continua recebendo tudo: e o que ja acontecia */
    const nuncaEscolheu=c.planoDeSincronizacaoPierre(contas,vindas,{contas:[],definidas:false});
    t.igual(nuncaEscolheu.novas.length,2,'quem nunca escolheu recebe de todas as contas');

    /* Este é o defeito: desmarcar tudo caía na mesma lista vazia e o app
       trazia justamente o extrato inteiro que a pessoa tinha dispensado. */
    const desmarcouTudo=c.planoDeSincronizacaoPierre(contas,vindas,{contas:[],definidas:true});
    t.igual(desmarcouTudo.novas.length,0,
      'desmarcar todas as contas não traz nada',
      'vazio significava "todas" e "nenhuma" ao mesmo tempo');
    t.igual(desmarcouTudo.deOutrasContas.length,2,'e as duas são contadas como de fora');
  }

  console.log('\n\x1b[1mConfirmar duas vezes o mesmo plano não duplica\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const vindas=[doBanco('t1','Padaria',-42.9,'DEBIT',{account_id:'a'})];
    const plano=c.planoDeSincronizacaoPierre(contas,vindas);

    const primeira=c.aplicarSincronizacaoPierre(plano);
    t.igual(primeira.lancadas,1,'a primeira confirmação lança');

    /* O plano é uma FOTO: entre montar e confirmar, a nuvem pode ter trazido os
       mesmos lançamentos, ou a pessoa clica duas vezes num plano velho. */
    const segunda=c.aplicarSincronizacaoPierre(plano);
    t.igual(segunda.lancadas,0,'reaplicar o mesmo plano não lança de novo');
    t.igual(segunda.jaEstavam,1,'e diz quantos já estavam');
    t.igual((d.transacoes||[]).filter(x=>x.idExterno).length,1,
      'o Diário continua com um lançamento só',
      'o `jaTem` do plano envelhece; a conferência tem que ser na hora de gravar');
  }

  console.log('\n\x1b[1mDesfazer a última importação\x1b[0m');
  {
    const d=base();
    d.saldoAtual=10;
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'300.00',connectorName:'Nubank',creditData:{creditLimit:700,balanceDueDate:'2026-09-28'}};
    const vindas=[
      doBanco('t1','Padaria',-42.9,'DEBIT',{account_id:'a'}),
      doBanco('t2','Mercado',-80,'DEBIT',{account_id:'a'}),
    ];

    const plano=c.planoDeSincronizacaoPierre(contas,vindas);
    const sinc=c.aplicarSincronizacaoPierre(plano);
    const doCartao=c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],[],{},HOJE,[]));
    const fixos=c.aplicarGastosFixosPierre([{nome:'TIM',valor:129.99,diaDoMes:5,categoria:'Assinaturas'}],HOJE);
    c.registrarImportacaoPierre({sinc,cartao:doCartao,fixos});

    t.igual(d.transacoes.length,2,'a importação trouxe dois lançamentos');
    t.valor(d.saldoAtual,1000,'e mexeu no saldo');
    t.igual(d.cartoes.length,1,'criou o cartão');
    t.igual(d.gastosMensais.length,1,'e o gasto fixo marcado');

    const resumo=c.resumoDaUltimaImportacaoPierre();
    t.igual(resumo.lancamentos,2,'o resumo diz quantos lançamentos sairiam');
    t.valor(resumo.saldoVolta,10,'e para quanto o saldo voltaria');

    const feito=c.desfazerImportacaoPierre();
    t.igual(feito.lancamentos,2,'desfazer tira os dois lançamentos');
    t.igual(d.transacoes.length,0,'o Diário volta ao que era');
    t.valor(d.saldoAtual,10,'o saldo volta ao anterior');
    t.igual(d.cartoes.length,0,'o cartão criado sai');
    t.igual(d.gastosMensais.length,0,'e o gasto fixo também');
    t.igual(d.pierreUltimaImportacao,null,'e não dá pra desfazer duas vezes');
    t.igual(c.resumoDaUltimaImportacaoPierre(),null,'o resumo some junto');

    /* a próxima sincronização tem que buscar o mesmo período de novo */
    t.igual(d.pierreSincronizadoEm,null,
      'o relógio volta, senão a próxima busca pularia o que acabou de sair');
  }

  console.log('\n\x1b[1mDesfazer não apaga o que você digitou\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'300.00',connectorName:'Nubank',creditData:{creditLimit:700,balanceDueDate:'2026-09-28'}};

    const doCartao=c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],[],{},HOJE,[]));
    c.registrarImportacaoPierre({sinc:{idsLancados:[],saldoAntes:0},cartao:doCartao,fixos:{ids:[]}});

    /* depois da importação, a pessoa lança um gasto na fatura que veio do banco */
    const fatura=d.faturas.find(f=>f.mes===9);
    fatura.gastos.push({id:'meu',nome:'Livraria',valor:60,pago:false,categoria:'Lazer'});

    const feito=c.desfazerImportacaoPierre();
    const aindaLa=d.faturas.find(f=>f.id===fatura.id);
    t.verdadeiro(!!aindaLa,
      'fatura com gasto digitado NÃO é removida',
      'apagar o que a pessoa escreveu nunca é a resposta');
    t.valor(aindaLa.valor,0,'mas o valor que veio do banco volta a zero');
    t.igual((aindaLa.gastos||[]).length,1,'e o gasto digitado continua lá');
    t.igual(feito.faturasGuardadas,1,'o resultado conta o que foi preservado');
    t.igual(d.cartoes.length,1,
      'o cartão também fica, porque ainda há fatura apontando pra ele');
    t.igual(feito.cartoesGuardados,1,'e isso é dito, em vez de escolhido em silêncio');
  }

  console.log('\n\x1b[1mO banco confirma o que você já tinha escrito\x1b[0m');
  {
    const d=base();
    /* a pessoa lançou a padaria no caminho de casa; o banco processa depois */
    d.transacoes=[{id:'meu',nome:'Padaria da esquina',valor:42.9,categoria:'Mercado',
      metodo:'debito',data:'2026-09-08',nota:'pão de queijo'}];
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const vindas=[doBanco('tx1','PADARIA DO ZE LTDA',-42.9,'DEBIT',
      {account_id:'a',date:'2026-09-10'})];

    const plano=c.planoDeSincronizacaoPierre(contas,vindas);
    t.igual(plano.novas.length,0,'o que já foi digitado não entra como novo');
    t.igual(plano.conciliadas.length,1,'ele é reconhecido como o mesmo gasto');
    t.igual(plano.conciliadas[0].meuId,'meu','apontando pro lançamento da pessoa');
    t.igual(plano.conciliadas[0].dias,2,'com a distância em dias');

    c.aplicarSincronizacaoPierre(plano);
    t.igual(d.transacoes.length,1,
      'depois de conciliar continua UM lançamento, não dois',
      'o idExterno só evitava repetir o que veio do Pierre; o que a pessoa escreveu ficava de fora');
    t.igual(d.transacoes[0].nome,'Padaria da esquina',
      'e é o texto da PESSOA que fica, não o do banco');
    t.igual(d.transacoes[0].nota,'pão de queijo','com a nota dela');
    t.igual(d.transacoes[0].idExterno,'tx1',
      'carimbado com o id do Pierre, pra próxima vez reconhecer sozinho');

    /* e a proxima sincronizacao nao mexe mais nele */
    const p2=c.planoDeSincronizacaoPierre(contas,vindas);
    t.igual(p2.novas.length,0,'na próxima vez não entra de novo');
    t.igual(p2.conciliadas.length,0,'nem volta a ser proposta de conciliação');
    t.igual(p2.repetidas.length,1,'ele passa a ser simplesmente "já estava"');
  }

  console.log('\n\x1b[1mConciliar só quando é mesmo o mesmo\x1b[0m');
  {
    const d=base();
    d.transacoes=[
      {id:'longe',nome:'Mercado',valor:100,categoria:'Mercado',metodo:'debito',data:'2026-09-01'},
      {id:'outro',nome:'Mercado',valor:99,categoria:'Mercado',metodo:'debito',data:'2026-09-10'},
      {id:'entrada',nome:'Devolução',valor:50,categoria:'Outros',metodo:'pix',
       data:'2026-09-10',tipo:'receita'}];
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];

    const longe=c.planoDeSincronizacaoPierre(contas,
      [doBanco('t1','Mercado',-100,'DEBIT',{account_id:'a',date:'2026-09-10'})]);
    t.igual(longe.conciliadas.length,0,
      'nove dias de distância não é o mesmo gasto');
    t.igual(longe.novas.length,1,'então entra como novo');

    const centavo=c.planoDeSincronizacaoPierre(contas,
      [doBanco('t2','Mercado',-100.5,'DEBIT',{account_id:'a',date:'2026-09-10'})]);
    t.igual(centavo.conciliadas.length,0,
      'valor diferente não concilia, nem por cinquenta centavos',
      'aproximar valores é como se apaga um gasto de verdade sem ninguém ver');

    const sentido=c.planoDeSincronizacaoPierre(contas,
      [doBanco('t3','Devolução',-50,'DEBIT',{account_id:'a',date:'2026-09-10'})]);
    t.igual(sentido.conciliadas.length,0,'gasto não concilia com entrada');

    /* dois do banco, um seu: só um casa */
    const dois=c.planoDeSincronizacaoPierre(contas,[
      doBanco('t4','Mercado',-99,'DEBIT',{account_id:'a',date:'2026-09-10'}),
      doBanco('t5','Mercado',-99,'DEBIT',{account_id:'a',date:'2026-09-11'})]);
    t.igual(dois.conciliadas.length,1,'um lançamento seu concilia com um só');
    t.igual(dois.novas.length,1,'o outro entra como novo');
  }

  console.log('\n\x1b[1mAssinatura com prefixo de maquininha é uma só\x1b[0m');
  {
    const d=base();
    d.cartoes=[{id:'k1',nome:'Nubank gold',limite:700,idExterno:'cc1'}];
    const c=criarAmbiente(d,HOJE);
    const noCartao=(id,desc,valor,mes,dia)=>({
      id, description:desc, amount:-valor, type:'DEBIT',
      date:'2026-0'+mes+'-'+dia, category:'Serviços', status:'POSTED',
      account_type:'CREDIT', account_subtype:'CREDIT_CARD', account_name:'Nubank'});

    /* a MESMA assinatura, cobrada por dois caminhos da maquininha */
    const sug=c.sugerirGastosFixosPierre([
      noCartao('a1','Ec *Melimais',9.9,'7','18'),
      noCartao('a2','Mp *Melimais',9.9,'8','19'),
    ],HOJE,'k1');
    t.igual(sug.length,1,
      '"Ec *Melimais" e "Mp *Melimais" viram uma sugestão só',
      'marcadas as duas, davam R$ 19,80 por mês de uma assinatura de R$ 9,90');
    t.valor(sug[0].valor,9.9,'com o valor certo');
  }

  console.log('\n\x1b[1mBar não é conta fixa: o dia tem que ser estável\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const naConta=(id,desc,valor,mes,dia)=>doBanco(id,desc,-valor,'DEBIT',
      {date:'2026-0'+mes+'-'+dia,account_id:'a'});

    /* mesmo valor por acaso, em dias quaisquer */
    const bar=c.sugerirGastosFixosPierre([
      naConta('b1','Golden Beer',16.49,'7','05'),
      naConta('b2','Golden Beer',16.49,'8','22'),
    ],HOJE);
    t.igual(bar.length,0,
      'dois valores iguais em dias distantes não é assinatura',
      'era o que deixava um bar visitado em dois meses virar despesa fantasma');

    /* assinatura de verdade: mesmo dia */
    const real=c.sugerirGastosFixosPierre([
      naConta('s1','TIM Celular',129.99,'7','05'),
      naConta('s2','TIM Celular',129.99,'8','05'),
    ],HOJE);
    t.igual(real.length,1,'mas a que cai sempre no mesmo dia continua sendo sugerida');

    /* dia 30 em fevereiro escorrega poucos dias, e isso ainda é assinatura */
    const escorrega=c.sugerirGastosFixosPierre([
      naConta('e1','Servico X',30,'7','28'),
      naConta('e2','Servico X',30,'8','30'),
    ],HOJE);
    t.igual(escorrega.length,1,'e alguns dias de escorregão continuam valendo');
  }

  console.log('\n\x1b[1mO histórico lembra o que cada importação fez\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const vindas=[doBanco('h1','Padaria',-42.9,'DEBIT',{account_id:'a'})];
    const plano=c.planoDeSincronizacaoPierre(contas,vindas);
    const sinc=c.aplicarSincronizacaoPierre(plano);
    c.registrarImportacaoPierre({sinc,cartao:null,fixos:{criados:0,ids:[]}});

    t.igual((d.pierreHistorico||[]).length,1,'a importação entra no histórico');
    t.igual(d.pierreHistorico[0].lancamentos,1,'com o que ela trouxe');
    t.verdadeiro(!!d.pierreHistorico[0].em,'e quando foi');

    /* a segunda entra na frente, e desfazer NAO apaga a memoria */
    const p2=c.planoDeSincronizacaoPierre(contas,
      [doBanco('h2','Mercado',-80,'DEBIT',{account_id:'a'})]);
    const s2=c.aplicarSincronizacaoPierre(p2);
    c.registrarImportacaoPierre({sinc:s2,cartao:null,fixos:{criados:0,ids:[]}});
    t.igual(d.pierreHistorico.length,2,'a segunda também');
    c.desfazerImportacaoPierre();
    t.igual(d.pierreHistorico.length,2,
      'desfazer não apaga o histórico',
      'saber que aconteceu é diferente de manter o efeito');
  }

  console.log('\n\x1b[1mA fatura ganha detalhe sem deixar de fechar\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'0.00',connectorName:'Nubank',creditData:{creditLimit:2000,balanceDueDate:'2026-08-28'}};
    /* o banco diz 1000; as compras que ele lista somam 700. A diferença é
       juros, IOF e saldo anterior — e tem que caber em algum lugar. */
    const faturas=[{accountId:'cc1',dueDate:'2026-08-28',totalAmount:1000}];
    const compra=(id,valor)=>({id,description:'Compra '+id,amount:-valor,type:'DEBIT',
      date:'2026-08-10',status:'POSTED',category:'Serviços',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',
      account_id:'cc1',credit_card_data:{billForecastDate:'2026-08'}});
    const pagou=[{id:'pg',description:'Pagamento de fatura',amount:-1000,type:'CREDIT',
      date:'2026-09-02',status:'POSTED',operation_type:'PAGAMENTO',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',
      category:'Pagamento de cartão de crédito'}];
    const tx=[compra('c1',400),compra('c2',300),...pagou];

    const p=c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx);
    t.igual(p.faturasDetalhadas,1,'a fatura entra com as compras detalhadas');
    c.aplicarCartaoPierre(p);

    const f=d.faturas.find(x=>x.ano===2026&&x.mes===8);
    t.igual((f.gastos||[]).length,2,'as duas compras estão lá');
    t.valor(f.valor,300,'e o valor vira o RESTO: 1000 do banco menos as 700 itemizadas');
    const total=f.valor+(f.gastos||[]).reduce((s2,g)=>s2+g.valor,0);
    t.valor(total,1000,
      'as duas partes somam exatamente o que o banco diz',
      'era o motivo pelo qual eu tinha declarado o detalhe impossível');

    /* sincronizar de novo nao repete as compras */
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx));
    t.igual((f.gastos||[]).length,2,'a segunda sincronização não duplica as compras');
    t.valor(f.valor+(f.gastos||[]).reduce((s2,g)=>s2+g.valor,0),1000,'e o total continua fechando');
  }

  console.log('\n\x1b[1mQuando as compras passam do total, entra só o total\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'0.00',connectorName:'Nubank',creditData:{creditLimit:2000,balanceDueDate:'2026-08-28'}};
    /* estorno: o banco cobra 900, mas as compras listadas somam 950 */
    const faturas=[{accountId:'cc1',dueDate:'2026-08-28',totalAmount:900}];
    const tx=[
      {id:'x1',description:'Compra',amount:-950,type:'DEBIT',date:'2026-08-10',
       status:'POSTED',category:'Serviços',account_type:'CREDIT',
       account_subtype:'CREDIT_CARD',account_id:'cc1',credit_card_data:{billForecastDate:'2026-08'}},
      {id:'pg',description:'Pagamento de fatura',amount:-900,type:'CREDIT',
       date:'2026-09-02',status:'POSTED',operation_type:'PAGAMENTO',
       account_type:'CREDIT',account_subtype:'CREDIT_CARD',
       category:'Pagamento de cartão de crédito'}];

    const p=c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx);
    t.igual(p.faturasDetalhadas,0,'essa fatura não é detalhada');
    t.igual(p.faturasSemDetalhe,1,'e o plano diz que ficou sem detalhe');
    c.aplicarCartaoPierre(p);
    const f=d.faturas.find(x=>x.ano===2026&&x.mes===8);
    t.igual((f.gastos||[]).length,0,'nenhuma compra entrou');
    t.valor(f.valor,900,
      'só o total do banco, que é o número que se pode garantir',
      'detalhar com uma soma que não cabe seria voltar ao problema pelo outro lado');
  }

  console.log('\n\x1b[1mDesfazer tira as compras que a importação pôs\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'0.00',connectorName:'Nubank',creditData:{creditLimit:2000,balanceDueDate:'2026-08-28'}};
    const faturas=[{accountId:'cc1',dueDate:'2026-08-28',totalAmount:1000}];
    const tx=[
      {id:'c1',description:'Compra',amount:-400,type:'DEBIT',date:'2026-08-10',
       status:'POSTED',category:'Serviços',account_type:'CREDIT',
       account_subtype:'CREDIT_CARD',account_id:'cc1',credit_card_data:{billForecastDate:'2026-08'}},
      {id:'pg',description:'Pagamento de fatura',amount:-1000,type:'CREDIT',
       date:'2026-09-02',status:'POSTED',operation_type:'PAGAMENTO',
       account_type:'CREDIT',account_subtype:'CREDIT_CARD',
       category:'Pagamento de cartão de crédito'}];

    const doCartao=c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx));
    c.registrarImportacaoPierre({sinc:{idsLancados:[],saldoAntes:0},cartao:doCartao,fixos:{ids:[]}});

    const f=d.faturas.find(x=>x.ano===2026&&x.mes===8);
    /* e a pessoa acrescenta um gasto dela na mesma fatura */
    f.gastos.push({id:'meu',nome:'Digitado por mim',valor:50,pago:false,categoria:'Lazer'});

    const feito=c.desfazerImportacaoPierre();
    t.igual(feito.gastosTirados,1,'a compra que veio do banco sai');
    const aindaLa=d.faturas.find(x=>x.id===f.id);
    t.igual((aindaLa.gastos||[]).length,1,'e sobra uma só');
    t.igual(aindaLa.gastos[0].id,'meu',
      'a que fica é a que a pessoa digitou',
      'apagar o que a pessoa escreveu nunca é a resposta');
  }

  console.log('\n\x1b[1mCompra de um cartão não entra na fatura do outro\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    /* os dois com saldo: assim as duas faturas do MÊS CORRENTE entram, sem
       depender de prova de pagamento */
    const nu={id:'ccA',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',balance:'400.00',
      connectorName:'Nubank',creditData:{creditLimit:5000,balanceDueDate:'2026-09-28'}};
    const itau={id:'ccB',name:'platinum',type:'CREDIT',subtype:'CREDIT_CARD',balance:'400.00',
      connectorName:'Itau',creditData:{creditLimit:5000,balanceDueDate:'2026-09-10'}};
    /* a compra é do cartão A, e só dele */
    const tx=[{id:'a1',description:'Compra do A',amount:-300,type:'DEBIT',
      date:'2026-09-05',status:'POSTED',category:'Serviços',account_id:'ccA',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',
      credit_card_data:{billForecastDate:'2026-09'}}];

    const p=c.planoDoCartaoPierre([nu,itau],[],{},HOJE,tx);
    const doA=p.faturas.find(f=>f.cartaoExterno==='ccA'&&f.mes===9);
    const doB=p.faturas.find(f=>f.cartaoExterno==='ccB'&&f.mes===9);
    t.verdadeiro(!!doA&&!!doB,'cada cartão tem a sua fatura do mês');
    t.igual((doA.compras||[]).length,1,'a compra aparece na fatura do cartão dela');
    t.igual((doB.compras||[]).length,0,
      'e NÃO aparece na fatura do outro cartão',
      'agrupar as compras só por mês fazia os dois cartões receberem a mesma lista');

    c.aplicarCartaoPierre(p);
    const d2=c.data||null;
    void d2;
  }

  console.log('\n\x1b[1mPagamento de um cartão não quita a fatura do outro\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const nu={id:'ccA',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      connectorName:'Nubank',creditData:{creditLimit:5000,balanceDueDate:'2026-08-28'}};
    const itau={id:'ccB',name:'platinum',type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      connectorName:'Itau',creditData:{creditLimit:5000,balanceDueDate:'2026-08-10'}};
    /* duas faturas fechadas, MESMO valor, e um pagamento só — no cartão B */
    /* MESMO vencimento nos dois, de proposito: assim a janela de data nao
       separa nada e quem tem que separar e a conta */
    const faturas=[
      {accountId:'ccA',dueDate:'2026-08-28',totalAmount:500},
      {accountId:'ccB',dueDate:'2026-08-28',totalAmount:500},
    ];
    const tx=[{id:'p1',description:'Pagamento de fatura',amount:-500,type:'CREDIT',
      date:'2026-08-30',status:'POSTED',operation_type:'PAGAMENTO',account_id:'ccB',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',
      category:'Pagamento de cartão de crédito'}];

    const p=c.planoDoCartaoPierre([nu,itau],faturas,{},HOJE,tx);
    const doB=p.faturas.find(f=>f.cartaoExterno==='ccB'&&f.mes===8);
    const doA=p.faturas.find(f=>f.cartaoExterno==='ccA'&&f.mes===8);

    t.verdadeiro(!!doB&&doB.origem==='banco-paga',
      'a fatura do cartão que recebeu o pagamento entra como paga');
    t.igual(doA,undefined,
      'e a do OUTRO cartão não entra, porque ninguém provou que foi paga',
      'o pagamento de R$ 500 no B dava a do A como paga: ela sumia do limite sem ter sido paga');
    t.igual(p.faturasSemPagamento.length,1,'e o plano diz que uma ficou de fora');
  }

  console.log('\n\x1b[1mUm pagamento quita uma fatura só\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      connectorName:'Nubank',creditData:{creditLimit:5000,balanceDueDate:'2026-08-28'}};
    /* dois meses com o MESMO valor, e um pagamento só */
    const faturas=[
      {accountId:'cc1',dueDate:'2026-07-28',totalAmount:400},
      {accountId:'cc1',dueDate:'2026-08-28',totalAmount:400},
    ];
    const tx=[{id:'pg',description:'Pagamento de fatura',amount:-400,type:'CREDIT',
      date:'2026-08-02',status:'POSTED',operation_type:'PAGAMENTO',account_id:'cc1',
      account_type:'CREDIT',account_subtype:'CREDIT_CARD',
      category:'Pagamento de cartão de crédito'}];

    const p=c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx);
    const pagas=p.faturas.filter(f=>f.origem==='banco-paga');
    t.igual(pagas.length,1,
      'um pagamento marca UMA fatura, não as duas de mesmo valor',
      'sem consumir o pagamento, ele quitava todo mês que tivesse aquele valor');
    t.igual(pagas[0].mes,7,'e é a do mês cujo vencimento fica perto do pagamento');
  }

  console.log('\n\x1b[1mDesfazer não passa por cima do que veio depois\x1b[0m');
  {
    const d=base();
    d.saldoAtual=10;
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const vindas=[doBanco('t1','Padaria',-42.9,'DEBIT',{account_id:'a'})];
    const plano=c.planoDeSincronizacaoPierre(contas,vindas);
    const sinc=c.aplicarSincronizacaoPierre(plano);
    c.registrarImportacaoPierre({sinc,cartao:null,fixos:{criados:0,ids:[]}});
    t.valor(d.saldoAtual,1000,'a importação pôs o saldo do banco');

    /* a pessoa corrige o saldo à mão DEPOIS da importação */
    d.saldoAtual=1234.56;

    const feito=c.desfazerImportacaoPierre();
    t.valor(d.saldoAtual,1234.56,
      'desfazer NÃO derruba a correção feita depois',
      'o saldo voltava para o de antes da importação e a edição posterior sumia');
    t.verdadeiro(feito.saldoMexidoDepois,'e o resultado diz que preservou');
    t.igual(d.transacoes.length,0,'mas os lançamentos da importação saem do mesmo jeito');
  }

  console.log('\n\x1b[1mDesfazer não deixa fatura vazia nem carimbo solto\x1b[0m');
  {
    const d=base();
    /* um gasto que a pessoa digitou, e que o banco vai confirmar */
    d.transacoes=[{id:'meu',nome:'Padaria da esquina',valor:42.9,categoria:'Mercado',
      metodo:'debito',data:'2026-09-10'}];
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      connectorName:'Nubank',creditData:{creditLimit:5000,balanceDueDate:'2026-08-28'}};
    const faturas=[{accountId:'cc1',dueDate:'2026-08-28',totalAmount:500}];
    const tx=[{id:'c1',description:'Compra',amount:-300,type:'DEBIT',date:'2026-08-05',
      status:'POSTED',category:'Serviços',account_id:'cc1',account_type:'CREDIT',
      account_subtype:'CREDIT_CARD',credit_card_data:{billForecastDate:'2026-08'}},
      {id:'pg',description:'Pagamento de fatura',amount:-500,type:'CREDIT',
       date:'2026-09-02',status:'POSTED',operation_type:'PAGAMENTO',account_id:'cc1',
       account_type:'CREDIT',account_subtype:'CREDIT_CARD',
       category:'Pagamento de cartão de crédito'}];

    const plano=c.planoDeSincronizacaoPierre(contas,
      [doBanco('tx1','PADARIA DO ZE',-42.9,'DEBIT',{account_id:'a',date:'2026-09-11'})]);
    t.igual(plano.conciliadas.length,1,'o banco confirma o que a pessoa escreveu');
    const sinc=c.aplicarSincronizacaoPierre(plano);
    const doCartao=c.aplicarCartaoPierre(c.planoDoCartaoPierre([cartao],faturas,{},HOJE,tx));
    c.registrarImportacaoPierre({sinc,cartao:doCartao,fixos:{criados:0,ids:[]}});

    t.igual(d.transacoes[0].idExterno,'tx1','o lançamento dela foi carimbado');
    t.igual(d.faturas.length,1,'e a fatura foi criada');

    const feito=c.desfazerImportacaoPierre();
    t.igual(d.faturas.length,0,
      'a fatura criada sai inteira, sem deixar casca vazia',
      'as compras saíam DEPOIS de decidir quais faturas ficavam, e sobrava uma fatura de R$ 0,00');
    t.igual(d.transacoes[0].idExterno,undefined,
      'e o carimbo da conciliação é solto',
      'sem isso o lançamento ficaria para sempre como "já estava" e o gasto nunca mais seria trazido');
    t.igual(feito.carimbosSoltos,1,'o resultado conta quantos soltou');
    t.igual(d.transacoes.length,1,'e o lançamento da pessoa continua lá');
  }

  console.log('\n\x1b[1mConciliar não mistura carteira com conta\x1b[0m');
  {
    const d=base();
    d.transacoes=[{id:'vivo',nome:'Almoço',valor:35,categoria:'Mercado',
      metodo:'dinheiro',data:'2026-09-10'}];
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',1000,'Nubank')];

    const p=c.planoDeSincronizacaoPierre(contas,
      [doBanco('tx1','Restaurante',-35,'DEBIT',{account_id:'a',date:'2026-09-11'})]);
    t.igual(p.conciliadas.length,0,
      'gasto em dinheiro não concilia com gasto na conta',
      'são dois gastos de verdade: juntá-los some da carteira o que nunca saiu dela');
    t.igual(p.novas.length,1,'o do banco entra como novo');

    /* mas pix e débito saem da mesma bolsa */
    const d2=base();
    d2.transacoes=[{id:'meu',nome:'Restaurante',valor:35,categoria:'Mercado',
      metodo:'pix',data:'2026-09-10'}];
    const c2=criarAmbiente(d2,HOJE);
    const p2=c2.planoDeSincronizacaoPierre(contas,
      [doBanco('tx2','Restaurante',-35,'DEBIT',{account_id:'a',date:'2026-09-11'})]);
    t.igual(p2.conciliadas.length,1,
      'pix e débito conciliam: os dois saem da conta');
  }

  console.log('\n\x1b[1mEscolher o que sincroniza\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const contas=[conta('a','BANK',2000,'Nubank'),conta('b','BANK',500,'Inter')];
    contas[0].name='Nu Conta'; contas[1].name='Inter Conta';
    /* `account_name` na transacao e o nome do BANCO, nao o da conta: as duas
       contas do mesmo banco chegam com o mesmo texto. O vinculo e o id. */
    const vindas=[
      doBanco('t1','Do Nu',-100,'DEBIT',{account_id:'a',account_name:'Nubank'}),
      doBanco('t2','Do Inter',-50,'DEBIT',{account_id:'b',account_name:'Inter'}),
    ];

    /* sem escolher nada, tudo entra: e o que acontecia antes desta opcao */
    const tudo=c.planoDeSincronizacaoPierre(contas,vindas);
    t.igual(tudo.novas.length,2,'sem escolha, vem de todas as contas');
    t.valor(tudo.saldo,2500,'e o saldo soma todas');

    /* duas contas do MESMO banco: pelo nome elas seriam a mesma coisa */
    const doMesmoBanco=[conta('x','BANK',100,'Nubank'),conta('y','BANK',900,'Nubank')];
    const dasDuas=[
      doBanco('m1','Da corrente',-10,'DEBIT',{account_id:'x',account_name:'Nubank'}),
      doBanco('m2','Da poupança',-20,'DEBIT',{account_id:'y',account_name:'Nubank'}),
    ];
    const soUma=c.planoDeSincronizacaoPierre(doMesmoBanco,dasDuas,{contas:['y']});
    t.igual(soUma.novas.length,1,'duas contas do mesmo banco se separam pelo id');
    t.igual(soUma.novas[0].nome,'Da poupança','e é a escolhida que entra');
    t.valor(soUma.saldo,900,'com o saldo só dela');

    const soUmBanco=c.planoDeSincronizacaoPierre(contas,vindas,{contas:['a']});
    t.igual(soUmBanco.novas.length,1,'escolhendo uma conta, so os lancamentos dela entram');
    t.igual(soUmBanco.novas[0].nome,'Do Nu','e sao os certos');
    t.valor(soUmBanco.saldo,2000,'o saldo passa a ser so o dela');
    t.igual(soUmBanco.deOutrasContas.length,1,'o que ficou de fora e contado, nao some calado');

    const semLancamentos=c.planoDeSincronizacaoPierre(contas,vindas,{trazerLancamentos:false});
    t.igual(semLancamentos.novas.length,0,'dispensando lancamentos, nenhum entra');
    t.valor(semLancamentos.saldo,2500,'mas o saldo continua vindo');

    const semSaldo=c.planoDeSincronizacaoPierre(contas,vindas,{trazerSaldo:false});
    t.igual(semSaldo.novas.length,2,'dispensando o saldo, os lancamentos continuam');
    t.igual(semSaldo.trazerSaldo,false,'e o plano diz que o saldo nao vem');

    /* aplicar respeita o que o plano combinou, sem precisar repetir a escolha */
    const dd=base(); const cc=criarAmbiente(dd,HOJE);
    const plano=cc.planoDeSincronizacaoPierre(contas,vindas,{trazerSaldo:false});
    cc.aplicarSincronizacaoPierre(plano);
    t.valor(dd.saldoAtual,1000,'o saldo fica como estava');
    t.igual(dd.transacoes.length,2,'e os lancamentos entram');
  }

};
