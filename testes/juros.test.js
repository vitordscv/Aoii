/* Fórmulas da calculadora de juros. */
const {criarAmbiente}=require('./ambiente');

module.exports=function(t){
  console.log('\n\x1b[1mCalculadora de juros\x1b[0m');
  const ctx=criarAmbiente({idioma:'pt',taxasManuais:{}},'2026-09-09');

  t.verdadeiro(ctx.atualizarTaxasManuais({cdi:12.5,selic:10.75},'2026-09-09T12:00:00.000Z'),
    'aceita taxas anuais válidas');
  t.igual(ctx.taxaAnualDisponivel('cdi'),12.5,'retorna a taxa CDI disponível');
  t.igual(ctx.data.taxasManuais.atualizadoEm,'2026-09-09T12:00:00.000Z','registra a atualização das taxas');
  t.igual(ctx.atualizarTaxasManuais({cdi:-1,selic:11}),false,
    'rejeita uma atualização com taxa negativa');
  t.igual(ctx.data.taxasManuais.selic,10.75,'não altera parcialmente as taxas inválidas');

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
