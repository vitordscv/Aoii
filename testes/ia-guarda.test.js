/* A resposta da IA só pode citar número que veio do app.

   Os casos de "barra" são respostas reais de teste (dados fictícios) que um
   modelo deu com toda a confiança: juros e rendimento inventados, média por
   dia tirada de um total que não sustenta média. Os casos de "passa" são o
   que uma boa resposta faz: repete os números dados e soma ou subtrai dois. */
const {criarAmbiente}=require('./ambiente');

module.exports=function(t){
  console.log('\n\x1b[1mIA: conferência dos números da resposta\x1b[0m');
  const ctx=criarAmbiente({idioma:'pt'},'2026-11-17');
  const fonte='Livre até o fim do mês: R$ 910,00. Fone R$ 300,00. Monitor R$ 1.100,00. '+
    'Fatura em aberto R$ 3.500,00. Empréstimo: falta R$ 450,00. Cartão 1: 70% do limite usado. '+
    'Gasto R$ 2.700,00 este mês vs R$ 2.250,00 no mês passado (20%). Reserva cobre 0.7 mês(es).';
  const passa=(r,msg)=>{ const v=ctx.verificarRespostaIA(r,fonte); t.verdadeiro(v.ok,msg,'barrou '+JSON.stringify(v.suspeitos)); };
  const barra=(r,esperado,msg)=>{ const v=ctx.verificarRespostaIA(r,fonte); t.verdadeiro(!v.ok&&v.suspeitos.includes(esperado),msg,'veio '+JSON.stringify(v)); };

  passa('Sim, cabe: o livre é R$ 910,00.','número repetido dos dados passa');
  passa('Comprando o fone, sobram R$ 610,00.','diferença de dois valores enviados passa (910 − 300)');
  passa('No cartão, a fatura iria de R$ 3.500,00 para R$ 4.600,00.','soma de dois valores enviados passa (3.500 + 1.100)');
  passa('Ao todo você deve R$ 3.950,00.','soma da dívida com a fatura passa');
  passa('Seu gasto subiu R$ 450,00, ou 20%.','percentual que está nos dados passa');
  passa('Você usa 70% do limite e a reserva cobre 0,7 mês.','decimal escrito com vírgula bate com o ponto dos dados');
  passa('You have $910.00 left this month.','formato americano bate com o brasileiro');
  passa('Il vous reste 3'+String.fromCharCode(0x202f)+'500,00 € de facture.','milhar com espaço fino (francês) é reconhecido');
  passa('Em 11 meses você completa a meta, no dia 5 de 2027.','inteiro solto (prazo, dia, ano) não é conferido');
  passa('Faltam R$ 1.100 para o monitor.','valor sem centavos bate com o valor com centavos');

  barra('O cartão cobra cerca de 300% ao ano.','300%','percentual inventado é barrado, mesmo existindo R$ 300 nos dados');
  barra('O Tesouro Selic rende ~13,5% ao ano.','13,5%','rendimento que não está nos dados é barrado');
  barra('Você gasta em média R$ 54 por dia.','R$ 54','média por dia (divisão) é barrada');
  barra('Daria para juntar R$ 9.999,00 até o fim do ano.','R$ 9.999,00','valor que não vem de nenhuma conta simples é barrado');
  barra('Juntando tudo, sobram R$ 1.510,00 e o resto R$ 2.000,00.','R$ 2.000,00','conta em três passos não é aceita no escuro');

  /* "mil" multiplica: o número vem arredondado e é conferido como tal */
  passa('A fatura está em uns R$ 3,5 mil.','"3,5 mil" bate com R$ 3.500,00');
  passa('Você tem uns 2 mil de gasto este mês.','"2 mil" arredondado de R$ 2.250,00 passa');
  barra('Seu cartão tem R$ 32 mil livres.','R$ 32 mil','"32 mil" sem nada perto nos dados é barrado');
  /* somas só entre valores de dinheiro: dia, ano e contagem não justificam valor */
  const comDatas='Aluguel R$ 1.200,00 (dia 10). Internet R$ 100,00 (dia 15). Ano 2027, 3 meses.';
  t.verdadeiro(!ctx.verificarRespostaIA('Sobram R$ 25.',comDatas).ok,'dia do mês somado com outro dia não justifica R$ 25');
  t.verdadeiro(ctx.verificarRespostaIA('Os dois somam R$ 1.300,00.',comDatas).ok,'soma de dois valores de dinheiro continua valendo');

  const v=ctx.verificarRespostaIA('R$ 54 e R$ 54 de novo, e 13,5%',fonte);
  t.igual(v.suspeitos.length,2,'cada número barrado aparece uma vez só');
  t.verdadeiro(ctx.verificarRespostaIA('Sem números aqui, só uma opinião calma.',fonte).ok,'resposta sem número passa');

  /* estimativa geral declarada com ≈ (preço de mercado, taxa típica): a
     pessoa vê o sinal e a regra manda dizer que não é dado dela */
  passa('Um iPhone novo custa ≈R$ 8.000 hoje, como estimativa geral.','estimativa marcada com ≈ passa');
  passa('O rotativo do cartão costuma passar de ≈400% ao ano.','percentual geral marcado com ≈ passa');
  barra('O rotativo do cartão costuma passar de ~400% ao ano.','400%','"~" não vale como marca de estimativa');
  barra('Um iPhone custa R$ 8.000 e seu livre é ≈R$ 910,00.','R$ 8.000','o ≈ vale só para o número colado nele');

  console.log('\n\x1b[1mIA: contas que a pessoa pede\x1b[0m');
  /* Antes desta rodada, "20+20+20+7 quanto dá?" recebia uma recusa: a regra
     de não inventar número barrava até a conta que a própria pessoa
     escreveu. Agora o app resolve a conta e o modelo só repete. */
  const conta=q=>ctx.contasDaPergunta(q).map(c=>c.resultado);
  t.igual(JSON.stringify(conta('20+20+20+7 quanto dá?')),'[67]','soma solta é resolvida pelo app');
  t.igual(JSON.stringify(conta('quanto é 1.200 / 4?')),'[300]','divisão com milhar brasileiro');
  t.igual(JSON.stringify(conta('(1.500,50 + 300) x 2')),'[3601]','parênteses e "x" como vezes');
  t.igual(JSON.stringify(conta('2 + 3 * 4')),'[14]','multiplicação antes da soma');
  t.igual(JSON.stringify(conta('quanto é 10% de 3.500?')),'[350]','percentual de um valor');
  t.igual(JSON.stringify(conta('vence dia 17/11 e o outro 05/12/2026')),'[]','data não vira divisão');
  t.igual(JSON.stringify(conta('planos de 2026 - 2027')),'[]','intervalo de anos não vira subtração');
  t.igual(JSON.stringify(conta('dá pra comprar algo de 300?')),'[]','pergunta sem conta não inventa conta');
  t.igual(ctx.avaliarConta('10 / 0'),null,'divisão por zero não devolve número');
  const pergunta='Se eu guardar R$ 500 por mês, em 12 meses junto quanto?';
  const comPergunta=fonte+' Pergunta do usuário: '+pergunta;
  t.verdadeiro(ctx.verificarRespostaIA('Em 12 meses você junta R$ 6.000,00.',comPergunta,pergunta).ok,
    'valor da pergunta vezes a contagem da pergunta passa (500 × 12)');
  t.verdadeiro(ctx.verificarRespostaIA('Seriam 4 parcelas de R$ 875,00.',fonte+' em 4 parcelas','em 4 parcelas').ok,
    'valor dos dados dividido em parcelas passa (3.500 ÷ 4)');
  t.verdadeiro(!ctx.verificarRespostaIA('Em 12 meses você junta R$ 7.300,00.',comPergunta,pergunta).ok,
    'resultado errado da mesma conta continua barrado');

  console.log('\n\x1b[1mIA: fatos já calculados\x1b[0m');
  const dados={idioma:'pt',moeda:'BRL',saldoAtual:2400,transacoes:[],gastosMensais:[],faturas:[{id:'f1',mes:11,ano:2026,valor:3500,pago:false,gastos:[]}],
    orcamentos:{Mercado:800,Lazer:500},
    metas:[{id:'m1',nome:'Viagem',valorAlvo:3000,valorGuardado:800,aporteMensal:200},{id:'m2',nome:'Bike',valorAlvo:500,valorGuardado:500}],
    comprasPlanejadas:[{id:'c1',nome:'Fone',valor:300,feito:false},{id:'c2',nome:'Monitor',valor:1100,feito:false,cartao:true}],
    dividas:[{id:'d1',nome:'Empréstimo',valor:900,pago:450,quitado:false}],reservaGuardado:1000,reservaMeses:3,categorias:['Mercado','Lazer','Outros']};
  const amb=criarAmbiente(dados,'2026-11-17');
  /* nomes de categoria passam pela tradução na tela; aqui o rótulo é o próprio nome */
  amb.categoriaLabel=c=>c;
  amb.computeWeekSummary=()=>({gastoSemana:0,livreAteFimDoMes:910,diasRestantes:13});
  amb.computeCategoryBreakdown=()=>({entries:[['Mercado',900],['Lazer',400]]});
  amb.computeMonthSpend=(a,m)=>m===11?2700:2250;
  amb.custoMensalEssencial=()=>1380;
  /* o Intl separa "R$" do valor com espaço inquebrável; aqui vira espaço comum */
  const fatos=amb.fatosCalculadosParaIA().replace(/[^\S\n]/g,' ');
  const tem=(trecho,msg)=>t.verdadeiro(fatos.includes(trecho),msg,'fatos:\n'+fatos);
  tem('Livre até o fim do mês: R$ 910,00.','livre do mês entra nos fatos');
  tem('Fone (R$ 300,00): cabe no livre do mês e sobram R$ 610,00','compra que cabe diz quanto sobra');
  tem('Monitor (R$ 1.100,00): não cabe no livre do mês, faltam R$ 190,00; está marcada para o cartão','compra que não cabe diz quanto falta e que é no cartão');
  tem('Meta Viagem: faltam R$ 2.200,00; só com o aporte automático de R$ 200,00/mês, 11 meses','meta diz quanto falta e em quantos meses');
  tem('Meta Bike: já completa.','meta completa é dita como completa');
  tem('Teto de Mercado: estourado em R$ 100,00 (R$ 900,00 de R$ 800,00).','teto estourado diz por quanto');
  tem('Teto de Lazer: dentro, restam R$ 100,00.','teto dentro diz quanto resta');
  tem('Gasto do mês contra o anterior: subiu R$ 450,00.','variação do mês em reais');
  tem('Reserva de emergência: faltam R$ 3.140,00 para o alvo.','quanto falta para a reserva');
  tem('Dívidas com pessoas R$ 450,00 + faturas pendentes R$ 3.500,00 = R$ 3.950,00.','soma de dívidas e faturas');
  t.verdadeiro(!/undefined|NaN/.test(fatos),'nenhum fato sai com undefined ou NaN',fatos);
};
