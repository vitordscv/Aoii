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

    const p=c.planoDoCartaoPierre([cartao],faturas,parcelas,HOJE);
    const acha=(ano,mes)=>p.faturas.find(f=>f.ano===ano&&f.mes===mes);

    t.igual(acha(2026,8).origem,'banco','mês fechado usa o número do banco');
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
  }

  console.log('\n\x1b[1mFatura de mês que já passou entra paga\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const cartao={id:'cc1',name:'gold',type:'CREDIT',subtype:'CREDIT_CARD',
      balance:'520.38',connectorName:'Nubank',creditData:{creditLimit:700,balanceDueDate:'2026-08-28'}};
    /* seis meses fechados, como veio da conta real */
    const faturas=[3,4,5,6,7,8].map(m=>({accountId:'cc1',
      dueDate:'2026-0'+m+'-28',totalAmount:600+m*50}));
    const p=c.planoDoCartaoPierre([cartao],faturas,{},HOJE);
    c.aplicarCartaoPierre(p);

    const emAberto=d.faturas.filter(f=>!f.pago);
    t.igual(emAberto.length,1,'só o mês corrente fica em aberto');

    /* Este é o teste que faltava. Sem o "pago", computeCartao() somava as seis
       faturas fechadas como dívida viva: R$ 5.314 comprometidos num limite de
       R$ 700, e disponível negativo em R$ 4.614. */
    const uso=c.computeCartao(d.cartoes[0].id);
    t.valor(uso.comprometido,520.38,'o comprometido é só a fatura aberta');
    t.valor(uso.disponivel,179.62,'e sobra limite de verdade, não número negativo absurdo');
    t.verdadeiro(uso.disponivel>0,'o limite disponível não fica negativo por causa do histórico');
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
