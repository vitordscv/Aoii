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

  /* A taxa mensal é a equivalente da anual, e vale para os dois regimes.
     Antes o simples usava a proporcional (rAno/12), maior — e por isso ele
     aparecia rendendo mais que o composto em prazos curtos com aporte. */
  const rMes=Math.pow(1.12,1/12)-1;

  const umAno=ctx.jurosProjetados(1000,0,12,12);
  t.valor(umAno.composto,1120,'taxa mensal equivalente fecha 12% em um ano composto');
  t.valor(umAno.simples,1000*(1+rMes*12),'o simples usa a mesma taxa mensal, sem capitalizar');

  const doisAnos=ctx.jurosProjetados(1000,0,12,24);
  t.valor(doisAnos.simples,1000*(1+rMes*24),'juros simples mantêm a base original por dois anos');
  t.valor(doisAnos.composto,1254.4,'juros compostos acumulam rendimento no segundo ano');

  const comAporte=ctx.jurosProjetados(1000,100,12,1);
  t.valor(comAporte.investido,1100,'aporte do mês entra no total investido');
  t.valor(comAporte.simples,1000*(1+rMes)+100,'aporte feito no fim do mês ainda não rende no simples');
  t.valor(comAporte.composto,1000*(1+rMes)+100,'nem no composto — e no primeiro mês os dois empatam');

  /* O que a tela não pode voltar a dizer: que juros simples rendem mais.
     O caso que quebrava era justamente este, com aporte e prazo curto. */
  let inversoes=0, empates=0;
  for(const aporte of [0,100,500]){
    for(let n=1;n<=120;n++){
      const r=ctx.jurosProjetados(1000,aporte,12,n);
      if(r.composto<r.simples-1e-9) inversoes++;
      else if(Math.abs(r.composto-r.simples)<1e-9) empates++;
    }
  }
  t.igual(inversoes,0,'composto nunca fica atrás do simples, em prazo nenhum');
  t.igual(empates,3,'os dois só empatam no primeiro mês');
};
