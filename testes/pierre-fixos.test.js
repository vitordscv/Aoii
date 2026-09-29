/* Regressões com contas fictícias: a assinatura mantém a origem até virar
   gasto fixo, mesmo quando o cartão só nasce ao confirmar a importação. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-12';
const base=()=>({saldoAtual:0,dinheiroVivo:0,idioma:'pt',moeda:'BRL',
  categorias:['Outros','Assinaturas'],gastosMensais:[],cartoes:[],faturas:[],transacoes:[]});
const cartao=(id,idExterno)=>({id,idExterno,nome:'Cartão '+id,limite:1000,
  diaFechamento:20,diaVencimento:28});
const cobranca=(conta,mes,extra)=>Object.assign({
  id:conta+'-'+mes,description:'Serviço mensal',amount:-30,type:'DEBIT',
  date:'2026-'+mes+'-05',status:'POSTED',category:'Serviços',
  account_id:conta,account_name:'Banco fictício',
  account_type:'CREDIT',account_subtype:'CREDIT_CARD',
},extra||{});
const meses=(conta,extra)=>['07','08'].map(m=>cobranca(conta,m,extra));

module.exports=function(t){
  console.log('\n\x1b[1mFixos do Pierre preservam conta e cartão de origem\x1b[0m');
  {
    const d=base();
    d.cartoes=[cartao('local-a','cc-a'),cartao('local-b','cc-b')];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre([...meses('cc-a'),...meses('cc-b')],HOJE);
    t.igual(sug.length,2,'a mesma descrição em dois cartões gera duas sugestões independentes');
    const a=sug.find(g=>g.contaExterna==='cc-a');
    const b=sug.find(g=>g.contaExterna==='cc-b');
    t.igual(a&&a.cartaoId,'local-a','a sugestão do primeiro cartão aponta para sua origem');
    t.igual(b&&b.cartaoId,'local-b','a sugestão do segundo cartão não herda o primeiro');
    const feito=c.aplicarGastosFixosPierre(sug,HOJE);
    t.igual(feito.criados,2,'as duas sugestões escolhidas viram gastos fixos');
    t.igual(d.gastosMensais.filter(g=>g.cartaoId==='local-b').length,1,
      'a assinatura do segundo cartão entra na projeção dele');
  }
  {
    const c=criarAmbiente(base(),HOJE);
    const historico=[...meses('banco-a',{account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'}),
      ...meses('banco-b',{account_type:'BANK',account_subtype:'CHECKING_ACCOUNT',description:'Outro serviço'})];
    const sug=c.sugerirGastosFixosPierre(historico,HOJE,{contas:['banco-b'],definidas:true});
    t.igual(sug.length,1,'a sugestão da conta desmarcada fica de fora');
    t.igual(sug[0]&&sug[0].contaExterna,'banco-b','a conta escolhida permanece na sugestão');
    t.igual(c.sugerirGastosFixosPierre(historico,HOJE,{contas:[],definidas:true}).length,0,
      'desmarcar todas as contas também dispensa todas as sugestões');
    t.igual(c.sugerirGastosFixosPierre(historico,HOJE,{contas:[],definidas:false}).length,2,
      'quem ainda não escolheu contas continua vendo as duas');
  }
  {
    const c=criarAmbiente(base(),HOJE);
    const sug=c.sugerirGastosFixosPierre([cobranca('cc-a','07'),cobranca('cc-b','08')],HOJE);
    t.igual(sug.length,0,'uma cobrança em cada cartão não inventa recorrência entre contas');
  }
  {
    const d=base();
    d.cartoes=[cartao('primeiro','cc-antigo')];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre(meses('cc-novo'),HOJE);
    const plano=c.planoDoCartaoPierre([{id:'cc-novo',name:'Novo',connectorName:'Banco fictício',
      type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      creditData:{creditLimit:1000,balanceDueDate:'2026-09-28'}}],[],{},HOJE,[]);
    c.aplicarCartaoPierre(plano);
    const feito=c.aplicarGastosFixosPierre(sug,HOJE);
    const novo=d.cartoes.find(k=>k.idExterno==='cc-novo');
    t.igual(feito.criados,1,'a assinatura é criada depois do cartão da mesma importação');
    t.igual(d.gastosMensais[0]&&d.gastosMensais[0].cartaoId,novo&&novo.id,
      'o cartão novo recebe a assinatura e o primeiro cartão fica fora');
  }
  {
    const d=base();
    d.cartoes=[cartao('primeiro','cc-antigo')];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre(meses('cc-ausente'),HOJE);
    const feito=c.aplicarGastosFixosPierre(sug,HOJE);
    t.igual(feito.criados,0,'sem o cartão de origem, nenhum gasto fixo é criado no primeiro cartão');
    t.igual(d.gastosMensais.length,0,'uma origem não resolvida não entra na projeção');
    t.igual(c.aplicarGastosFixosPierre([{nome:'Sem origem',valor:30,diaDoMes:5,
      categoria:'Outros',cartao:true,cartaoId:'primeiro'}],HOJE).criados,0,
    'um cartão local sem vínculo com a origem não é prova suficiente');
  }
  {
    const d=base();
    d.cartoes=[cartao('local-a','cc-a'),cartao('local-b','cc-b')];
    d.gastosMensais=[{id:'existente',nome:'Serviço mensal',cartao:true,cartaoId:'local-a'}];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre([...meses('cc-a'),...meses('cc-b')],HOJE);
    t.igual(sug.length,1,'o fixo de um cartão não oculta o que ainda falta no outro');
    t.igual(sug[0]&&sug[0].cartaoId,'local-b','só o gasto ainda não cadastrado é sugerido');
  }
  {
    const d=base();
    d.cartoes=[cartao('local-a','cc-a')];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre(meses('cc-a',{
      account_type:undefined,account_subtype:undefined,
    }),HOJE);
    c.aplicarGastosFixosPierre(sug,HOJE);
    t.igual(d.gastosMensais[0]&&d.gastosMensais[0].cartaoId,'local-a',
      'a conta vinculada a cartão local continua no crédito mesmo sem tipo no extrato');
  }
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const contas=[{id:'cc-novo',name:'Novo',connectorName:'Banco fictício',
      type:'CREDIT',subtype:'CREDIT_CARD',balance:'0.00',
      creditData:{creditLimit:1000,balanceDueDate:'2026-09-28'}}];
    const historico=meses('cc-novo',{account_type:undefined,account_subtype:undefined});
    const sug=c.sugerirGastosFixosPierre(historico,HOJE,{contasConhecidas:contas});
    t.igual(sug[0]&&sug[0].cartao,true,
      'a lista de contas identifica o crédito antes de criar o cartão local');
    c.aplicarCartaoPierre(c.planoDoCartaoPierre(contas,[],{},HOJE,[]));
    c.aplicarGastosFixosPierre(sug,HOJE);
    t.igual(d.gastosMensais[0]&&d.gastosMensais[0].cartaoId,d.cartoes[0].id,
      'a assinatura sem tipo no extrato acompanha o cartão criado na importação');
    t.igual(c.sugerirGastosFixosPierre(historico,HOJE,{
      contasConhecidas:contas,contas:[],definidas:true,
    }).length,0,'reconhecer o cartão pelas contas não ignora a seleção vazia');
  }
  {
    const d=base();
    d.cartoes=[cartao('duplicado-a','cc-repetido'),cartao('duplicado-b','cc-repetido')];
    const c=criarAmbiente(d,HOJE);
    const sug=c.sugerirGastosFixosPierre(meses('cc-repetido'),HOJE);
    t.igual(sug[0]&&sug[0].cartaoId,null,'ID externo duplicado não escolhe um cartão arbitrário');
    const feito=c.aplicarGastosFixosPierre(sug,HOJE);
    t.igual(feito.criados,0,'vínculo duplicado não cria gasto fixo');
    t.igual(feito.semCartao,1,'a recusa do vínculo ambíguo é informada');
  }
};
