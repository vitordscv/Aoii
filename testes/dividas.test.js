/* Dívidas: dinheiro que já se deve, pago em valores e datas que a pessoa
   não controla.

   A regra que estes testes protegem é uma só: dívida é o espelho da entrada
   extra com o sinal trocado. Onde uma soma na projeção, a outra subtrai; e
   nenhuma das duas pode escorregar pra dentro da outra lista. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';

const base=()=>({saldoAtual:1000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:0,diaDoMes:20},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[],cartoes:[{id:'a',nome:'Nu',limite:2000,diaFechamento:10}],
  faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],dividas:[],
  metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],orcamentos:{},
  diasNaoTrabalhados:[],categorias:['Mercado','Outros']});

module.exports=function(t){

  console.log('\n\x1b[1mDívida: criar, pagar, quitar\x1b[0m');
  const d=base();
  const c=criarAmbiente(d,HOJE);

  const dv=c.criarPlanejado('divida',{nome:'Bicicleta do Rafa',credor:'Rafa',valor:1200});
  t.igual(!!dv,true,'dívida é criada');
  t.igual(d.dividas.length,1,'e mora em data.dividas');
  t.igual(d.entradasExtras.length,0,'não vaza pra entradas extras');
  t.igual(d.comprasPlanejadas.length,0,'nem pra compras planejadas');
  t.igual(dv.pago,0,'começa sem nada pago');
  t.igual(dv.credor,'Rafa','guarda a quem se deve');
  t.igual(dv.modo,'semPrevisao',
    'sem combinado é o padrão: quem empresta a um conhecido raramente marca data');
  t.valor(c.restanteDivida(dv),1200,'falta o total inteiro');

  /* pagamento em valor aleatório — que é o ponto da funcionalidade */
  const p1=c.registrarPagamentoDivida(dv.id,137.50);
  t.igual(!!p1,true,'aceita um valor quebrado');
  t.valor(p1.pago,137.50,'paga exatamente o que foi pedido');
  t.valor(c.restanteDivida(dv),1062.50,'o restante cai');
  t.igual(dv.quitado,false,'ainda não quitou');

  /* e tem que aparecer no Diário como gasto: se a dívida encolhesse sozinha,
     o saldo não mexeria e a previsão ficaria otimista */
  const gasto=d.transacoes[0];
  t.igual(!!gasto,true,'o pagamento vira lançamento no Diário');
  t.igual(gasto.tipo,undefined,'lançado como gasto, não como receita');
  t.valor(gasto.valor,137.50,'com o valor pago');
  t.valor(d.saldoAtual,862.50,'e o saldo da conta desce');

  c.registrarPagamentoDivida(dv.id,62.50);
  t.valor(dv.pago,200,'pagamentos se acumulam');

  /* pagar mais do que falta não pode virar crédito */
  const sobra=c.registrarPagamentoDivida(dv.id,5000);
  t.valor(sobra.pago,1000,'pagamento maior que o saldo devedor é aparado');
  t.valor(c.restanteDivida(dv),0,'não sobra dívida negativa');
  t.igual(dv.quitado,true,'quitou sozinha ao zerar');
  t.igual(dv.quitadoEm,HOJE,'com a data de hoje');
  t.igual(c.registrarPagamentoDivida(dv.id,10),null,'dívida quitada não aceita mais pagamento');

  t.igual(c.registrarPagamentoDivida(dv.id,-5),null,'valor negativo é recusado');
  t.igual(c.registrarPagamentoDivida('nao-existe',10),null,'id inexistente é recusado');

  console.log('\n\x1b[1mDívida na projeção: o espelho da entrada extra\x1b[0m');

  /* mesmo valor, mesma data, um de cada lado: a soma tem que se anular */
  const d2=base();
  d2.entradasExtras=[{id:'e',nome:'Reembolso',valor:600,recebido:0,modo:'unica',dataPrevista:'2026-11-10',feito:false}];
  d2.dividas=[{id:'v',nome:'Empréstimo',credor:'Ana',valor:600,pago:0,modo:'unica',dataPrevista:'2026-11-10',quitado:false}];
  const c2=criarAmbiente(d2,HOJE);
  t.valor(c2.computeTotals().projetado,1000,
    'entrada e dívida de mesmo valor e mesma data se anulam na projeção');

  const so=base();
  so.dividas=[{id:'v',nome:'Empréstimo',credor:'Ana',valor:600,pago:0,modo:'unica',dataPrevista:'2026-11-10',quitado:false}];
  const cso=criarAmbiente(so,HOJE);
  t.valor(cso.computeTotals().projetado,400,'sozinha, a dívida desce a projeção');
  t.valor(cso.computeTotals().dividasPendentes,600,'e aparece no total pendente');

  /* o que já foi pago não pode ser cobrado de novo na projeção */
  const parcial=base();
  parcial.dividas=[{id:'v',nome:'Empréstimo',valor:600,pago:250,modo:'unica',dataPrevista:'2026-11-10',quitado:false}];
  const cp=criarAmbiente(parcial,HOJE);
  t.valor(cp.computeTotals().projetado,650,'só o que falta desce a projeção');
  t.valor(cp.computeTotals().dividasPendentes,350,'o pendente é o que falta, não o total');

  /* sem previsão: vale, mas não promete mês nenhum */
  const sp=base();
  sp.dividas=[{id:'v',nome:'Empréstimo',valor:600,pago:0,modo:'semPrevisao',dataPrevista:null,quitado:false}];
  const csp=criarAmbiente(sp,HOJE);
  const tsp=csp.computeTotals();
  t.valor(tsp.projetado,1000,'dívida sem previsão fica fora da projeção');
  t.valor(tsp.dividasPendentes,600,'mas continua contada como pendente');
  t.valor(tsp.dividasSemPrevisao,600,'e é declarada como fora da projeção');
  t.valor(tsp.dividasNaProjecao,0,'nada dela entra na linha do tempo');

  /* aos poucos: espalha até o mês escolhido, igual à entrada extra */
  const ap=base();
  ap.dividas=[{id:'v',nome:'Empréstimo',valor:900,pago:0,modo:'aosPoucos',dataPrevista:'2026-11-30',quitado:false}];
  const cap=criarAmbiente(ap,HOJE);
  const pts=cap.buildTimeline().filter(p=>p.k>=cap.chaveMes(2026,9)&&p.k<=cap.chaveMes(2026,11));
  t.igual(pts.length,3,'set, out e nov entram na linha do tempo');
  t.valor(pts[0].dividas,300,'setembro leva um terço');
  t.valor(pts[2].dividas,300,'novembro leva o último terço');
  t.valor(cap.computeTotals().projetado,100,'no fim, os 900 saíram');

  /* quitada some da conta */
  const q=base();
  q.dividas=[{id:'v',nome:'Empréstimo',valor:600,pago:600,modo:'unica',dataPrevista:'2026-11-10',quitado:true,quitadoEm:'2026-09-01'}];
  const cq=criarAmbiente(q,HOJE);
  t.valor(cq.computeTotals().projetado,1000,'dívida quitada não desce mais nada');
  t.valor(cq.computeTotals().dividasPendentes,0,'nem conta como pendente');

  console.log('\n\x1b[1mDívida: editar, remover, desfazer\x1b[0m');
  const d3=base();
  const c3=criarAmbiente(d3,HOJE);
  const x=c3.criarPlanejado('divida',{nome:'TV do Léo',credor:'Léo',valor:800,modo:'unica',dataPrevista:'2026-10-20'});

  t.igual(c3.atualizarPlanejado('divida',x.id,{valor:850}).valor,850,'o total é editável');
  t.igual(c3.atualizarPlanejado('divida',x.id,{modo:'aosPoucos'}).modo,'aosPoucos','o modo é editável');
  t.igual(c3.atualizarPlanejado('divida',x.id,{modo:'inventado'}),null,'modo fora da lista é recusado');
  t.igual(c3.atualizarPlanejado('divida',x.id,{pago:9999}),null,'pago acima do total é recusado');
  t.igual(c3.atualizarPlanejado('divida',x.id,{dataPrevista:'30/10/2026'}),null,'data em outro formato é recusada');

  /* a caixa de marcar usa `quitado`, não `feito`: a tabela de tipos existe
     justamente pra esse nome não escorregar */
  const marcada=c3.definirPlanejadoFeito('divida',x.id,true);
  t.igual(marcada.quitado,true,'marcar como paga escreve em quitado');
  t.igual(marcada.feito,undefined,'e não inventa um campo feito');
  t.igual(marcada.quitadoEm,HOJE,'com a data de hoje');
  c3.definirPlanejadoFeito('divida',x.id,false);
  t.igual(d3.dividas[0].quitado,false,'desmarcar volta atrás');
  t.igual(d3.dividas[0].quitadoEm,null,'e limpa a data');

  const rem=c3.removerPlanejado('divida',x.id);
  t.igual(d3.dividas.length,0,'remover tira da lista');
  c3.restaurarPlanejado('divida',rem.item,rem.indice);
  t.igual(d3.dividas.length,1,'desfazer devolve');
  t.igual(d3.dividas[0].id,x.id,'a mesma dívida, no mesmo lugar');

  /* tipo desconhecido não pode cair numa lista qualquer por descuido */
  t.igual(c3.criarPlanejado('emprestimo',{nome:'x',valor:1}),null,'tipo que não existe não cria nada');
  t.igual(c3.removerPlanejado('emprestimo','id'),null,'nem remove');
  t.igual(c3.definirPlanejadoFeito('emprestimo','id',true),null,'nem marca');

  console.log('\n\x1b[1mDívida vinda de fora\x1b[0m');
  const V=e=>criarAmbiente({},HOJE).validateAndNormalizeData(e);
  const backup=(dividas)=>({saldoAtual:0,dinheiroVivo:0,tipoRenda:'mensal',
    rendaMensal:{valor:0,diaDoMes:5},cartoes:[],transacoes:[],faturas:[],
    entradasExtras:[],comprasPlanejadas:[],dividas,metas:[],gastosMensais:[],viagens:[]});

  const r=V(backup([{id:'v1',nome:'Empréstimo',credor:'Ana',valor:'1.200,50',pago:'200',modo:'unica',dataPrevista:'2026-11-10',quitado:false}]));
  t.igual(r.ok,true,'backup com dívida é aceito');
  t.valor(r.data.dividas[0].valor,1200.50,'valor no formato brasileiro é lido');
  t.valor(r.data.dividas[0].pago,200,'o pago também');

  const ruim=V(backup([{id:'v1',nome:'x',valor:100,pago:-50,modo:'qualquer',quitado:'talvez'}]));
  t.valor(ruim.data.dividas[0].pago,0,'pago negativo vira 0');
  t.igual(ruim.data.dividas[0].modo,'semPrevisao','modo fora da lista cai no padrão');
  t.igual(ruim.data.dividas[0].quitado,false,'quitado que não é sim/não vira falso');

  const intruso=V(backup([{id:'v1',nome:'x',valor:100,recebido:999,cartao:true,link:'https://x.com'}]));
  t.igual(intruso.data.dividas[0].recebido,undefined,'campo de entrada extra não entra na dívida');
  t.igual(intruso.data.dividas[0].cartao,undefined,'nem campo de compra planejada');
  t.igual(intruso.data.dividas[0].link,undefined,'nem o link, que é só da compra');
};
