/* Só objetos fictícios em memória: o desfazer deve preservar edições posteriores. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-12';
const copiar=x=>JSON.parse(JSON.stringify(x));

function importar(opcoes={}){
  const c=criarAmbiente({},HOJE);
  const d=c.defaultData();
  c.data=d;
  const sinc=c.aplicarSincronizacaoPierre({novas:[
    {id:'tx-ficticia',idExterno:'banco-ficticio',nome:'Compra fictícia',valor:30,
      categoria:'Outros',metodo:'debito',data:'2026-09-10'},
  ],contasDeBanco:1,saldo:100,conciliadas:[]});
  const cartao=c.aplicarCartaoPierre({cartoes:[{idExterno:'cartao-ficticio',
    nome:'Cartão fictício',limite:500,diaVencimento:20,diaFechamento:10}],
  faturas:opcoes.semFatura?[]:[{ano:2026,mes:9,valor:90,pago:false,
    cartaoExterno:'cartao-ficticio',origem:'saldo',compras:[
      {idExterno:'compra-ficticia',nome:'Compra no cartão',valor:40,categoria:'Outros',dataCompra:'2026-09-10'},
    ]}]});
  const fixos=c.aplicarGastosFixosPierre([{nome:'Assinatura fictícia',valor:20,
    diaDoMes:5,categoria:'Outros',cartao:true,cartaoId:d.cartoes[0].id,
    contaExterna:'cartao-ficticio'}],HOJE);
  c.registrarImportacaoPierre({sinc,cartao,fixos});
  return {c,d};
}

module.exports=function(t){
  console.log('\nDesfazer Pierre preserva alterações posteriores');
  {
    const {c,d}=importar();
    d.transacoes[0].nome='Nome corrigido';
    d.transacoes[0].valor=37;
    const resumo=c.resumoDaUltimaImportacaoPierre();
    t.igual(resumo.lancamentos,0,'a prévia não promete apagar o lançamento editado');
    const feito=c.desfazerImportacaoPierre();
    t.igual(d.transacoes.length,1,'o lançamento importado e editado permanece');
    t.valor(d.transacoes[0]&&d.transacoes[0].valor,37,'o valor corrigido permanece');
    t.igual(feito.lancamentosGuardados,1,'o desfazer informa a preservação do lançamento');
  }
  {
    const {c,d}=importar();
    const id=d.faturas[0].id;
    d.faturas[0].gastos[0].nota='Observação posterior';
    d.gastosMensais[0].pagoEm=['2026-9'];
    const feito=c.desfazerImportacaoPierre();
    const f=d.faturas.find(x=>x.id===id);
    t.igual(f&&f.gastos.length,1,'a compra importada com nota posterior permanece');
    t.igual(d.gastosMensais.length,1,'a conta fixa com pagamento posterior permanece');
    t.igual(feito.gastosGuardados,1,'informa a compra preservada');
    t.igual(feito.gastosFixosGuardados,1,'informa a conta fixa preservada');
  }
  {
    const {c,d}=importar({semFatura:true});
    c.desfazerImportacaoPierre();
    t.igual(d.gastosMensais.length,0,'a conta fixa intocada sai primeiro');
    t.igual(d.cartoes.length,0,'o cartão sem dependências sai na mesma operação');
  }
  {
    const {c,d}=importar();
    d.cartoes[0].nome='Nome escolhido depois';
    d.faturas[0].valor=72;
    d.faturas[0].pago=true;
    c.desfazerImportacaoPierre();
    t.igual(d.cartoes[0]&&d.cartoes[0].nome,'Nome escolhido depois','o cartão editado permanece');
    t.valor(d.faturas[0]&&d.faturas[0].valor,72,'o valor posterior da fatura nova permanece');
    t.igual(d.faturas[0]&&d.faturas[0].pago,true,'o pagamento posterior da fatura nova permanece');
    t.igual(d.faturas[0]&&d.faturas[0].gastos.length,1,'a fatura editada mantém suas compras');
  }
  {
    const {c,d}=importar({semFatura:true});
    d.comprasPlanejadas.push({id:'planejada-ficticia',nome:'Compra futura',valor:60,
      cartao:true,cartaoId:d.cartoes[0].id});
    c.desfazerImportacaoPierre();
    t.igual(d.cartoes.length,1,'o cartão necessário a uma compra planejada permanece');
  }
  {
    const {c,d}=importar();
    d.pierreUltimaImportacao.aplicados=null;
    d.transacoes[0].valor=66;
    const feito=c.desfazerImportacaoPierre();
    t.igual(d.transacoes.length,1,'importação antiga sem prova não apaga lançamento');
    t.igual(d.faturas.length,1,'importação antiga sem prova não apaga fatura');
    t.igual(d.gastosMensais.length,1,'importação antiga sem prova não apaga conta fixa');
    t.igual(d.cartoes.length,1,'importação antiga sem prova não apaga cartão');
    t.igual(feito.lancamentosGuardados,1,'legado retido aparece na contagem');
  }
  {
    const {c,d}=importar();
    const salvo=c.adotarDadosDeFora(copiar(d),'teste');
    t.igual(salvo.ok,true,'o backup fictício é aceito');
    const reaberto=criarAmbiente(salvo.data,HOJE);
    const feito=reaberto.desfazerImportacaoPierre();
    t.igual(feito.lancamentos,1,'a prova do lançamento intocado sobrevive à validação e migração');
    t.igual(feito.gastosTirados,1,'a prova da compra intocada sobrevive à validação e migração');
    t.igual(feito.gastosFixos,1,'a prova do fixo intocado sobrevive à validação e migração');
    t.igual(reaberto.data.faturas.length,0,'a fatura intocada sai depois de reabrir');
    t.igual(reaberto.data.cartoes.length,0,'o cartão intocado sai depois de reabrir');
  }
  {
    const {c,d}=importar();
    const salvo=c.adotarDadosDeFora(copiar(d),'teste');
    const reaberto=criarAmbiente(salvo.data,HOJE);
    reaberto.data.transacoes[0].categoria='Casa';
    reaberto.desfazerImportacaoPierre();
    t.igual(reaberto.data.transacoes[0]&&reaberto.data.transacoes[0].categoria,'Casa',
      'a prova persistida protege edição feita depois de reabrir');
  }
  {
    const {c,d}=importar();
    d.saldoAtualizadoEm='2026-09-13T10:00:00.000Z';
    const resumo=c.resumoDaUltimaImportacaoPierre();
    t.igual(resumo.saldoVolta,null,'a prévia preserva saldo confirmado depois, mesmo com valor igual');
    c.desfazerImportacaoPierre();
    t.valor(d.saldoAtual,100,'a confirmação posterior do saldo permanece');
  }
  {
    const c=criarAmbiente({},HOJE),d=c.defaultData();
    c.data=d;
    d.cartoes=[{id:'cartao-local',idExterno:'cartao-ficticio',nome:'Cartão',limite:500}];
    d.faturas=[{id:'fatura-local',cartaoId:'cartao-local',ano:2026,mes:9,
      valor:100,pago:false,gastos:[]}];
    const cartao=c.aplicarCartaoPierre({cartoes:[{idExterno:'cartao-ficticio',nome:'Cartão',limite:500}],
      faturas:[{ano:2026,mes:9,valor:100,pago:false,cartaoExterno:'cartao-ficticio',origem:'saldo',
        compras:[{idExterno:'item-ficticio',nome:'Detalhe',valor:40,categoria:'Outros'},
          {idExterno:'item-irmao',nome:'Outro detalhe',valor:30,categoria:'Outros'}]}]});
    c.registrarImportacaoPierre({cartao});
    d.faturas[0].gastos[0].valor=45;
    const resumo=c.resumoDaUltimaImportacaoPierre();
    t.igual(resumo.faturasRestauradas,0,'a prévia preserva o residual da fatura com detalhe editado');
    c.desfazerImportacaoPierre();
    t.valor(d.faturas[0].valor,30,'o total antigo não se soma ao detalhe importado que foi editado');
    t.valor(d.faturas[0].gastos[0].valor,45,'o detalhe corrigido permanece na fatura existente');
    t.igual(d.faturas[0].gastos.length,2,'a fatura preservada mantém também os itens que compõem seu total');
    t.valor(c.computeCartao('cartao-local').comprometido,105,'não apaga parte do total da fatura que precisa de conferência');
  }
  {
    const {c,d}=importar({semFatura:true});
    const meu={id:'manual-ficticia',nome:'Manual',valor:50,categoria:'Outros',
      metodo:'debito',data:'2026-09-10'};
    d.transacoes.push(meu);
    const sinc=c.aplicarSincronizacaoPierre({novas:[],contasDeBanco:0,conciliadas:[
      {meuId:meu.id,doBanco:{idExterno:'confirmacao-ficticia'}},
    ]});
    c.registrarImportacaoPierre({sinc});
    meu.idExterno='confirmacao-posterior';
    const feito=c.desfazerImportacaoPierre();
    t.igual(meu.idExterno,'confirmacao-posterior','uma conciliação posterior não perde seu vínculo');
    t.igual(feito.carimbosGuardados,1,'a conciliação posterior preservada é informada');
  }
  for(const editarDepois of [false,true]){
    const c=criarAmbiente({},HOJE),d=c.defaultData(); c.data=d;
    d.cartoes=[{id:'cartao-local',idExterno:'cartao-ficticio',nome:'Cartão',limite:500}];
    d.faturas=[{id:'fatura-local',cartaoId:'cartao-local',ano:2026,mes:9,
      valor:100,pago:false,gastos:[
        {id:'manual-aberta',nome:'Compra manual',valor:70,pago:false,categoria:'Outros'},
        {id:'manual-paga',nome:'Já paga',valor:20,pago:true,categoria:'Outros'},
      ]}];
    const cartao=c.aplicarCartaoPierre({cartoes:[{idExterno:'cartao-ficticio',nome:'Cartão',limite:500}],
      faturas:[{ano:2026,mes:9,valor:190,pago:true,cartaoExterno:'cartao-ficticio',origem:'banco-paga'}]});
    c.registrarImportacaoPierre({cartao});
    const salvo=c.adotarDadosDeFora(copiar(d),'teste');
    const reaberto=criarAmbiente(salvo.data,HOJE),f=salvo.data.faturas[0];
    if(editarDepois) f.gastos[0].nota='Edição posterior';
    reaberto.desfazerImportacaoPierre();
    if(editarDepois){
      t.igual(f.gastos[0].nota,'Edição posterior','desfazer preserva edição em compra manual da fatura quitada');
      t.igual(f.pago,true,'pagamento permanece para conferência quando sua compra mudou depois');
    }else{
      t.igual(f.gastos[0].pago,false,'compra manual volta ao estado não pago após reabrir e desfazer');
      t.igual(f.gastos[1].pago,true,'compra que já estava paga antes permanece paga');
      t.valor(reaberto.computeCartao('cartao-local').comprometido,170,'desfazer após reabrir recupera o comprometimento correto');
    }
  }
};

if(require.main===module){
  const assert=require('assert/strict');
  let falhas=0,passou=0;
  const verificar=(fn,m)=>{try{fn();passou++;}catch(e){falhas++;console.error(m+': '+e.message);}};
  module.exports({igual:(a,b,m)=>verificar(()=>assert.equal(a,b),m),
    valor:(a,b,m)=>verificar(()=>assert.ok(typeof a==='number'&&Math.abs(a-b)<0.005),m),
    verdadeiro:(a,m)=>verificar(()=>assert.ok(a),m)});
  console.log(passou+' passaram; '+falhas+' falharam.');
  process.exitCode=falhas?1:0;
}
