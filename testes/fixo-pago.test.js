/* Conta fixa paga antes do dia do vencimento.

   O app já parava de contar uma conta fixa depois do dia dela — pagar no dia
   sempre funcionou. O furo era pagar ANTES: o dia não chegou, então o app
   seguia descontando dinheiro que já tinha saído da conta.

   Marcar como paga passa a valer o mesmo que o dia ter passado. É por MÊS,
   não por conta: a internet de setembro estar paga não diz nada sobre a de
   outubro. */
const {criarAmbiente}=require('./ambiente');

/* dia 15 de setembro: a internet (dia 20) ainda não venceu, o aluguel (dia 5) já */
const HOJE='2026-09-15';

const base=()=>({saldoAtual:3000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:0,diaDoMes:1},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[
    {id:'net',nome:'Internet',valor:120,diaDoMes:20,categoria:'Casa',ativo:true,pagoEm:[]},
    {id:'alu',nome:'Aluguel',valor:900,diaDoMes:5,categoria:'Casa',ativo:true,pagoEm:[]},
  ],
  cartoes:[],faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],
  dividas:[],metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],
  orcamentos:{},diasNaoTrabalhados:[],categorias:['Casa','Outros']});

module.exports=function(t){

  console.log('\n\x1b[1mConta fixa: marcar como paga\x1b[0m');
  const d=base();
  const c=criarAmbiente(d,HOJE);
  const net=()=>d.gastosMensais.find(g=>g.id==='net');

  t.igual(c.gastoFixoPagoEm(net(),2026,9),false,'começa como não paga');

  t.igual(!!c.definirGastoFixoPago('net',2026,9,true),true,'marca');
  t.igual(c.gastoFixoPagoEm(net(),2026,9),true,'e fica marcada');
  t.igual(c.gastoFixoPagoEm(net(),2026,10),false,'outubro segue por pagar — é por mês, não por conta');
  t.igual(c.gastoFixoPagoEm(net(),2025,9),false,'setembro do ano passado também não');

  c.definirGastoFixoPago('net',2026,9,true);
  t.igual(net().pagoEm.length,1,'marcar duas vezes não duplica o mês');

  c.definirGastoFixoPago('net',2026,9,false);
  t.igual(c.gastoFixoPagoEm(net(),2026,9),false,'desmarcar volta atrás');
  t.igual(net().pagoEm.length,0,'e não deixa lixo na lista');

  t.igual(c.definirGastoFixoPago('nao-existe',2026,9,true),null,'id inexistente é recusado');
  t.igual(c.definirGastoFixoPago('net',2026,13,true),null,'mês fora de 1..12 é recusado');
  t.igual(c.definirGastoFixoPago('net',2026,9,'sim'),null,'valor que não é sim/não é recusado');

  /* a lista sobe pra nuvem em toda gravação: não pode crescer pra sempre */
  const p=base(); const cp=criarAmbiente(p,HOJE);
  for(let ano=2020;ano<2026;ano++) for(let mes=1;mes<=12;mes++) cp.definirGastoFixoPago('net',ano,mes,true);
  const lista=p.gastosMensais.find(g=>g.id==='net').pagoEm;
  t.igual(lista.length,24,'a lista para em 24 meses');
  t.igual(lista.includes('2025-12'),true,'guarda os mais recentes');
  t.igual(lista.includes('2020-1'),false,'e larga os mais antigos');

  console.log('\n\x1b[1mO que muda na conta, e o que não muda\x1b[0m');

  /* A cota do dia soma o que ainda vai vencer. A internet vence dia 20, hoje é
     15: ela conta. Marcada como paga, para de contar — o dinheiro já saiu. */
  const semPagar=criarAmbiente(base(),HOJE).computeDailyBudget();

  const dp=base();
  const cd=criarAmbiente(dp,HOJE);
  cd.definirGastoFixoPago('net',2026,9,true);
  const pagando=cd.computeDailyBudget();

  t.igual(pagando.disponivel>semPagar.disponivel,true,
    'marcar como paga libera o que estava sendo cobrado duas vezes');
  t.valor(pagando.disponivel-semPagar.disponivel,120,'exatamente o valor da conta');

  /* o aluguel venceu dia 5, antes de hoje: já não era contado, então marcar
     não muda nada — é a prova de que a regra é "o que falta vencer" */
  const da=base(); const ca=criarAmbiente(da,HOJE);
  const antes=ca.computeDailyBudget().disponivel;
  ca.definirGastoFixoPago('alu',2026,9,true);
  t.valor(ca.computeDailyBudget().disponivel,antes,
    'conta que já venceu não muda nada ao ser marcada');

  /* gastosMensaisCusto quer dizer "o que ainda falta sair neste mês" — já era
     0 pras contas cujo dia passou. Marcar como paga faz a conta paga antes do
     dia entrar nessa mesma regra. */
  const dm=base(); const cm=criarAmbiente(dm,HOJE);
  const faltaAntes=cm.monthMetrics({ano:2026,mes:9,valor:0,pago:true,gastos:[]}).gastosMensaisCusto;
  t.valor(faltaAntes,120,"antes: só a internet falta sair (o aluguel do dia 5 já passou)");
  cm.definirGastoFixoPago("net",2026,9,true);
  t.valor(cm.monthMetrics({ano:2026,mes:9,valor:0,pago:true,gastos:[]}).gastosMensaisCusto,0,
    "depois: não falta mais nada sair neste mês");

  console.log('\n\x1b[1mpagoEm vindo de fora\x1b[0m');
  const V=e=>criarAmbiente({},HOJE).validateAndNormalizeData(e);
  const backup=(pagoEm)=>({saldoAtual:0,dinheiroVivo:0,tipoRenda:'mensal',
    rendaMensal:{valor:0,diaDoMes:5},cartoes:[],transacoes:[],faturas:[],
    entradasExtras:[],comprasPlanejadas:[],metas:[],viagens:[],
    gastosMensais:[{id:'g1',nome:'Internet',valor:120,diaDoMes:20,pagoEm}]});

  t.igual(V(backup(['2026-9','2026-8'])).data.gastosMensais[0].pagoEm.length,2,'lista de meses atravessa');
  t.igual(Array.isArray(V(backup('2026-9')).data.gastosMensais[0].pagoEm),true,'texto solto vira lista vazia');
  t.igual(Array.isArray(V(backup(null)).data.gastosMensais[0].pagoEm),true,'ausente vira lista vazia');

  /* quem veio de antes do campo não tem pagoEm nenhum */
  const semCampo=V({saldoAtual:0,dinheiroVivo:0,tipoRenda:'mensal',
    rendaMensal:{valor:0,diaDoMes:5},cartoes:[],transacoes:[],faturas:[],
    entradasExtras:[],comprasPlanejadas:[],metas:[],viagens:[],
    gastosMensais:[{id:'g1',nome:'Internet',valor:120,diaDoMes:20}]});
  t.igual(Array.isArray(semCampo.data.gastosMensais[0].pagoEm),true,
    'backup antigo ganha a lista vazia na migração');

  console.log('\n\x1b[1mPendente: uma pergunta, uma resposta\x1b[0m');

  /* Três lugares perguntavam "esta conta ainda vai sair?" com critérios
     diferentes: o cálculo do mês, o aviso de vencimento e a caixinha da
     lista. Agora todos passam por gastoFixoPendenteEm(). */
  const dd=base(); const cd2=criarAmbiente(dd,HOJE);
  const net2=()=>dd.gastosMensais.find(g=>g.id==="net");
  const alu2=()=>dd.gastosMensais.find(g=>g.id==="alu");

  t.igual(cd2.gastoFixoPendenteEm(net2(),2026,9),true,"internet vence dia 20, hoje é 15: pendente");
  t.igual(cd2.gastoFixoPendenteEm(alu2(),2026,9),false,"aluguel venceu dia 5: já não é pendente");

  cd2.definirGastoFixoPago("net",2026,9,true);
  t.igual(cd2.gastoFixoPendenteEm(net2(),2026,9),false,"marcada como paga deixa de ser pendente");

  /* o que a tela desenha tem que bater com o que a conta usa */
  const detalhe=cd2.monthMetrics({ano:2026,mes:9,valor:0,pago:true,gastos:[]}).gastosMensaisDetalhe;
  t.igual(detalhe.find(x=>x.nome==="Internet").pago,true,"o mês concorda: internet não sai mais");
  t.igual(detalhe.find(x=>x.nome==="Aluguel").pago,true,"e o aluguel também não, porque já venceu");

  /* conta pausada não é pendente: não vai sair de jeito nenhum */
  const dp2=base(); const cp2=criarAmbiente(dp2,HOJE);
  dp2.gastosMensais.find(g=>g.id==="net").ativo=false;
  t.igual(cp2.gastoFixoPendenteEm(dp2.gastosMensais.find(g=>g.id==="net"),2026,9),false,
    "conta pausada não conta como pendente");

  /* mês futuro: nada venceu ainda, tudo pendente */
  const cf=criarAmbiente(base(),HOJE);
  const futuro=cf.monthMetrics({ano:2026,mes:11,valor:0,pago:true,gastos:[]});
  t.valor(futuro.gastosMensaisCusto,1020,"num mês futuro as duas contas ainda vão sair");

  console.log(String.fromCharCode(10)+String.fromCharCode(27)+"[1mConta fixa cobrada no cartão"+String.fromCharCode(27)+"[0m");

  /* O dinheiro não sai da conta no dia: entra na fatura e sai com ela. Como
     o app pede a fatura, e a fatura já inclui a assinatura, contar as duas
     coisas era contar o mesmo real duas vezes. */
  const comFatura=(gastoFixo)=>{
    const d=base();
    d.faturas=[{id:"f1",ano:2026,mes:9,valor:100,pago:false,gastos:[],cartaoId:"a"}];
    d.gastosMensais=gastoFixo?[gastoFixo]:[];
    const c=criarAmbiente(d,HOJE);
    return c.monthMetrics({ano:2026,mes:9,valor:100,pago:false,gastos:[],cartaoId:"a"});
  };
  const naConta={id:"s",nome:"Streaming",valor:100,diaDoMes:20,categoria:"Casa",ativo:true,pagoEm:[],cartao:false};
  const noCartao={id:"s",nome:"Streaming",valor:100,diaDoMes:20,categoria:"Casa",ativo:true,pagoEm:[],cartao:true,cartaoId:"a"};

  t.valor(comFatura(null).despesas,100,"só a fatura: R$ 100");
  t.valor(comFatura(naConta).despesas,200,"conta debitada da conta soma à fatura — são gastos diferentes");
  t.valor(comFatura(noCartao).despesas,100,"conta do cartão NÃO soma: ela já está dentro da fatura");

  const dc=base(); dc.gastosMensais=[noCartao];
  const cc=criarAmbiente(dc,HOJE);
  t.igual(cc.gastoFixoPendenteEm(dc.gastosMensais[0],2026,9),false,
    "conta de cartão nunca está pendente na conta — quem vence é a fatura");

  /* e o campo só sobrevive se a referência existir */
  const comCartao=(g)=>({saldoAtual:0,dinheiroVivo:0,tipoRenda:"mensal",
    rendaMensal:{valor:0,diaDoMes:5},cartoes:[{id:"a",nome:"Nu",limite:100}],
    transacoes:[],faturas:[],entradasExtras:[],comprasPlanejadas:[],metas:[],viagens:[],
    gastosMensais:[g]});
  const ok=V(comCartao({id:"g",nome:"X",valor:10,diaDoMes:5,cartao:true,cartaoId:"a"}));
  t.igual(ok.data.gastosMensais[0].cartaoId,"a","cartão existente atravessa");
  /* os dois passos fazem coisas diferentes, e é de propósito: o validador
     anula referência que não existe (é o que o tipo ref faz), e a migração
     é quem decide o substituto. Testar só o primeiro esconde metade. */
  const solto=V(comCartao({id:"g",nome:"X",valor:10,diaDoMes:5,cartao:true,cartaoId:"nao-existe"}));
  t.igual(solto.data.gastosMensais[0].cartaoId,null,"validação sozinha anula o cartão que não existe");
  const inteiro=criarAmbiente({},HOJE).adotarDadosDeFora(comCartao({id:"g",nome:"X",valor:10,diaDoMes:5,cartao:true,cartaoId:"nao-existe"}),"teste");
  t.igual(inteiro.data.gastosMensais[0].cartaoId,"a","o caminho inteiro cai no primeiro cartão, como as compras");
};
