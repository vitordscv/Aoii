/* Somente cenarios ficticios em memoria: a evidencia de pagamento precisa
   confirmar estado, cartao e data antes de quitar uma fatura fechada. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-28';
const base=()=>({cartoes:[],faturas:[],transacoes:[],gastosMensais:[]});
const cartao=()=>({id:'cartao-ficticio',name:'Cartao de teste',type:'CREDIT',
  subtype:'CREDIT_CARD',balance:'0.00',connectorName:'Banco ficticio',
  creditData:{creditLimit:2000,balanceDueDate:'2026-08-28'}});
const fatura=()=>({accountId:'cartao-ficticio',dueDate:'2026-08-28',totalAmount:500});
const pagamento=()=>({id:'pagamento-ficticio',description:'Pagamento de fatura',
  amount:-500,type:'CREDIT',date:'2026-09-02',status:'POSTED',
  operation_type:'PAGAMENTO',account_id:'cartao-ficticio',
  account_type:'CREDIT',account_subtype:'CREDIT_CARD',
  category:'Pagamento de cartao de credito'});

module.exports=function(t){
  console.log('\n\x1b[1mFatura paga exige evidencia confirmada do mesmo cartao\x1b[0m');

  const validos=[
    ['pagamento POSTED com conta, valor e dia compativeis',{},{}],
    ['campos alternativos preservam o vinculo da conta',
      {account_id:undefined,accountId:'cartao-ficticio',
       operation_type:undefined,operationType:'PAGAMENTO'},{}],
    ['data com horario continua comparada pelo dia',
      {date:'2026-09-02T09:15:00Z'},{dueDate:'2026-08-28T00:00:00Z'}],
    ['limite anterior da janela de pagamento',{date:'2026-08-16'},{}],
    ['limite posterior da janela de pagamento',{date:'2026-10-12'},{}],
  ];
  for(const [nome,mudancaPg,mudancaFatura] of validos){
    const c=criarAmbiente(base(),HOJE);
    const p=c.planoDoCartaoPierre([cartao()],
      [Object.assign(fatura(),mudancaFatura)],{},HOJE,
      [Object.assign(pagamento(),mudancaPg)]);
    t.igual(p.faturas.length,1,nome+': uma fatura reconhecida');
    t.igual(p.faturas[0]&&p.faturas[0].pago,true,nome+': quitacao confirmada');
  }

  const invalidos=[
    ['pagamento pendente',{status:'PENDING'},{}],
    ['pagamento agendado',{status:'SCHEDULED'},{}],
    ['status ausente',{status:undefined},{}],
    ['status vazio',{status:''},{}],
    ['status desconhecido',{status:'DESCONHECIDO'},{}],
    ['conta do pagamento ausente',{account_id:undefined},{}],
    ['conta do pagamento vazia',{account_id:''},{}],
    ['conta do pagamento so com espacos',{account_id:'   '},{}],
    ['pagamento de outro cartao',{account_id:'outro-cartao-ficticio'},{}],
    ['conta da fatura ausente',{}, {accountId:undefined}],
    ['as duas contas vazias',{account_id:''},{accountId:''}],
    ['as duas contas so com espacos',{account_id:'   '},{accountId:'   '}],
    ['dia do pagamento ausente',{date:undefined},{}],
    ['dia do pagamento vazio',{date:''},{}],
    ['dia do pagamento malformado',{date:'data-invalida'},{}],
    ['dia do pagamento inexistente',{date:'2026-09-31'},{}],
    ['vencimento incompleto',{}, {dueDate:'2026-08'}],
    ['vencimento malformado',{}, {dueDate:'2026-08-invalido'}],
    ['vencimento inexistente',{}, {dueDate:'2026-08-32'}],
    ['pagamento anterior a janela',{date:'2026-08-15'},{}],
    ['pagamento posterior a janela',{date:'2026-10-13'},{}],
  ];
  for(const [nome,mudancaPg,mudancaFatura] of invalidos){
    const c=criarAmbiente(base(),HOJE);
    const p=c.planoDoCartaoPierre([cartao()],
      [Object.assign(fatura(),mudancaFatura)],{},HOJE,
      [Object.assign(pagamento(),mudancaPg)]);
    t.igual(p.faturas.length,0,nome+': nao inventa quitacao');
    t.igual(p.faturasSemPagamento.length,1,nome+': fatura fica sem prova de pagamento');
  }

  const c=criarAmbiente(base(),HOJE);
  for(const vencimento of [undefined,'','data-invalida','2026-08-32']){
    const pagamentos=c.pagamentosDeFaturaPierre([pagamento()]);
    t.igual(c.pagamentoConfere(pagamentos,500,'cartao-ficticio',vencimento),false,
      'vencimento invalido nao confirma pagamento: '+String(vencimento));
    t.igual(pagamentos[0].usado,false,'e nao consome a evidencia valida');
  }
};
