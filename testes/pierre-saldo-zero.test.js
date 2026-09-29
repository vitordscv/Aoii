const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-28';
const base=()=>({saldoAtual:1000,transacoes:[],cartoes:[],faturas:[],gastosMensais:[],
  entradasExtras:[],comprasPlanejadas:[],metas:[],viagens:[],categorias:['Outros']});
const conta=(saldo,id='A')=>({id,type:'CREDIT',subtype:'CREDIT_CARD',name:id,
  balance:saldo,creditData:{creditLimit:2000}});

module.exports=function(t){
  console.log('\nSaldo zero explícito do cartão e proteção de dados manuais');
  const preparar=()=>{
    const d=base(),c=criarAmbiente(d,HOJE);
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([conta(500)],[],{},HOJE,[]));
    return {d,c,f:d.faturas[0],id:d.cartoes[0].id};
  };
  const importar=(c,saldo)=>c.aplicarCartaoPierre(
    c.planoDoCartaoPierre([conta(saldo)],[],{},HOJE,[]));
  for(const zero of [0,'0.00']){
    const {d,c,f,id}=preparar();
    importar(c,zero);
    t.valor(c.computeCartao(id).comprometido,0,'zero explícito retira o residual bancário anterior: '+JSON.stringify(zero));
    t.igual(f.pago,false,'saldo zero não inventa confirmação de pagamento');
    t.igual(d.faturas.length,1,'zero atualiza a mesma fatura');
    importar(c,zero);
    t.valor(f.valor,0,'repetir zero é idempotente');
  }
  for(const ausente of [undefined,null,'',' ',false,{},[],NaN,Infinity,'indisponível']){
    const {c,f}=preparar();
    importar(c,ausente);
    t.valor(f.valor,500,'ausência/valor inválido não equivale a zero: '+String(ausente));
  }
  {
    const {c,f,id}=preparar();
    f.gastos.push({id:'manual',nome:'Minha compra',valor:70,pago:false});
    const r=importar(c,0);
    t.valor(f.valor,0,'retira somente o residual importado');
    t.igual(f.gastos[0].id,'manual','preserva a compra manual');
    t.valor(c.computeCartao(id).comprometido,70,'compra manual continua na projeção');
    t.igual(r.estourando.length,1,'avisa quando os itens excedem o saldo bancário zero');
  }
  {
    const {c,f}=preparar();
    f.valor=650;
    const r=importar(c,0);
    t.valor(f.valor,650,'não apaga residual que a pessoa editou depois');
    t.igual(r.saldosZeradosPreservados,1,'informa que o saldo zero exige conferência');
  }
  {
    const d=base(),c=criarAmbiente(d,HOJE);
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([conta(0)],[],{},HOJE,[]));
    t.igual(d.faturas.length,0,'primeiro saldo zero não cria fatura vazia');
    d.faturas.push({id:'manual',ano:2026,mes:9,cartaoId:d.cartoes[0].id,valor:330,gastos:[],pago:false});
    const r=importar(c,0);
    t.valor(d.faturas[0].valor,330,'fatura sem comprovação de origem permanece intacta');
    t.igual(r.saldosZeradosPreservados,1,'avisa sobre residual sem comprovação, inclusive legado');
  }
  {
    const {d,c,f,id}=preparar();
    d.faturas.push({id:'futura',ano:2026,mes:10,cartaoId:id,valor:200,gastos:[],pago:false});
    d.cartoes.push({id:'outro',idExterno:'B',nome:'Outro',limite:1000});
    d.faturas.push({id:'outra',ano:2026,mes:9,cartaoId:'outro',valor:300,gastos:[],pago:false});
    importar(c,0);
    t.valor(f.valor,0,'zera apenas a fatura atual do cartão selecionado');
    t.valor(d.faturas[1].valor,200,'não altera fatura futura');
    t.valor(d.faturas[2].valor,300,'não altera outro cartão');
  }
  {
    const {d,c}=preparar();
    const normal=c.validateAndNormalizeData(JSON.parse(JSON.stringify(d)));
    t.igual(normal.ok,true,'backup com origem de saldo continua válido');
    t.valor(normal.data.faturas[0].pierreSaldoAplicado,500,'prova do residual sobrevive ao backup');
    const restaurado=criarAmbiente(normal.data,HOJE);
    importar(restaurado,0);
    t.valor(normal.data.faturas[0].valor,0,'zero funciona após restaurar backup');
  }
  for(const existente of [false,true]){
    const {d,c,f,id}=preparar();
    const b=c.aplicarCartaoPierre(c.planoDoCartaoPierre([conta(existente?200:0,'B')],[],{},HOJE,[]));
    t.igual(b.criados,1,'outro cartão existe para receber fatura');
    c.removerCartao(id);
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([conta(0,'B')],[],{},HOJE,[]));
    t.valor(d.faturas[0].valor,existente?700:500,'zero não apaga residual transferido/fundido de outro cartão');
  }
  for(const comando of ['salvarFatura','atualizarValorFatura']){
    const {c,f}=preparar();
    if(comando==='salvarFatura') c.salvarFatura({ano:f.ano,mes:f.mes,cartaoId:f.cartaoId,valor:500});
    else c.atualizarValorFatura(f.id,500);
    importar(c,0);
    t.valor(f.valor,500,'confirmação manual invalida a prova bancária: '+comando);
  }
  {
    const {d,c,f}=preparar();
    d.faturas.push({...f,id:'duplicada',valor:0,gastos:[]});
    const salvo=c.adotarDadosDeFora(JSON.parse(JSON.stringify(d)),'teste');
    const reaberto=criarAmbiente(salvo.data,HOJE);
    importar(reaberto,0);
    t.igual(salvo.data.faturas.length,1,'migração funde a duplicata');
    t.valor(salvo.data.faturas[0].valor,500,'fusão invalida prova mesmo quando o valor final coincide');
  }
  {
    const {c,f}=preparar();
    c.aplicarCartaoPierre(c.planoDoCartaoPierre([conta(0)],
      [{accountId:'A',dueDate:'2026-09-28',totalAmount:500}],{},HOJE,[]));
    t.valor(f.valor,500,'fatura detalhada pelo banco tem prioridade sobre saldo da conta');
    t.igual(f.pago,false,'saldo zero não quita fatura informada pelo banco');
  }
  {
    const {c,f,id}=preparar();
    f.gastos.push({id:'compra-bancaria',idExterno:'tx-banco',nome:'Compra',valor:500,pago:false});
    importar(c,500);
    importar(c,0);
    t.valor(c.computeCartao(id).comprometido,500,'saldo zero preserva compra detalhada sem prova de quitação');
    t.igual(f.gastos[0].pago,false,'não marca compra bancária como paga por suposição');
  }
};
