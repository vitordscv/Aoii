/* Fórmulas da calculadora de juros. */
const {criarAmbiente}=require('./ambiente');

module.exports=function(t){
  console.log('\n\x1b[1mCalculadora de juros\x1b[0m');
  const ctx=criarAmbiente({idioma:'pt',taxasManuais:{}},'2026-09-09');

  const semTaxa=ctx.jurosProjetados(1000,100,0,12);
  t.valor(semTaxa.investido,2200,'total investido soma principal e doze aportes');
  t.valor(semTaxa.simples,2200,'taxa zero não cria rendimento simples');
  t.valor(semTaxa.composto,2200,'taxa zero não cria rendimento composto');

  const umAno=ctx.jurosProjetados(1000,0,12,12);
  t.valor(umAno.simples,1120,'12% ao ano rende 12% em um ano no cálculo simples');
  t.valor(umAno.composto,1120,'taxa mensal equivalente fecha 12% em um ano composto');

  const doisAnos=ctx.jurosProjetados(1000,0,12,24);
  t.valor(doisAnos.simples,1240,'juros simples mantêm a base original por dois anos');
  t.valor(doisAnos.composto,1254.4,'juros compostos acumulam rendimento no segundo ano');
  t.verdadeiro(doisAnos.composto>doisAnos.simples,
    'composto supera simples quando há mais de um período anual');

  const comAporte=ctx.jurosProjetados(1000,100,12,1);
  t.valor(comAporte.investido,1100,'aporte do mês entra no total investido');
  t.valor(comAporte.simples,1110,'aporte feito no fim do mês ainda não rende no cálculo simples');
  t.valor(comAporte.composto,1000*Math.pow(1.12,1/12)+100,
    'aporte feito no fim do mês ainda não rende no cálculo composto');
};
