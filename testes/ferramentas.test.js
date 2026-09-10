/* A calculadora e o conversor de moedas do topo.

   As duas são "acessórios", e é exatamente por isso que precisam de teste: um
   acessório errado não derruba o app, ele só devolve um número errado — e um
   número errado num app de dinheiro é pior do que uma tela quebrada, porque
   ninguém desconfia dele.

   A calculadora não usa eval(). O que existe no lugar é uma gramática de vinte
   linhas, e o que a segura é a lista de casos aqui embaixo: precedência,
   parênteses, negativo, por cento, e — principalmente — o que ela deve
   RECUSAR. Uma expressão pela metade tem que virar NaN e não um chute. */
const {criarAmbiente}=require('./ambiente');

module.exports=function(t){
  console.log('\n\x1b[1mCalculadora\x1b[0m');
  const ctx=criarAmbiente({idioma:'pt'},'2026-09-10');
  const av=(e,sep)=>ctx.avaliarExpressao(e,sep||',');

  t.valor(av('2+3'),5,'soma');
  t.valor(av('10−4'),6,'subtração com o menos de verdade (−, não hífen)');
  t.valor(av('10-4'),6,'e com o hífen do teclado também');
  t.valor(av('7×6'),42,'multiplicação');
  t.valor(av('9÷2'),4.5,'divisão');

  /* A conta que separa uma calculadora de uma fila de operações: sem
     precedência, 2+3×4 dá 20, e a pessoa só descobre isso no extrato. */
  t.valor(av('2+3×4'),14,'multiplicação vem antes da soma');
  t.valor(av('(2+3)×4'),20,'parêntese muda a ordem');
  t.valor(av('2×(3+(4−1))'),12,'parênteses aninhados');

  t.valor(av('1234,56÷3'),411.52,'vírgula decimal no idioma português');
  t.valor(av('1234.56÷3','.'),411.52,'ponto decimal onde o idioma usa ponto');
  t.valor(av('1234,56÷3'),ctx.avaliarExpressao('1234.56÷3',','),
    'o ponto é aceito mesmo quando o separador é a vírgula');

  t.valor(av('−5+8'),3,'negativo no começo');
  t.valor(av('3×−2'),-6,'negativo depois de operador');

  /* % é sufixo e vale "dividido por cem". 250×10% = 25 é a pergunta que se faz
     numa conta de dinheiro; a outra convenção (50+10% = 55) muda de sentido
     conforme o operador anterior. */
  t.valor(av('10%'),0.1,'por cento divide por cem');
  t.valor(av('250×10%'),25,'250 vezes 10% dá 25');
  t.valor(av('(200+50)×10%'),25,'por cento depois de parêntese');

  t.naoNumero(av(''),'expressão vazia não é zero');
  t.naoNumero(av('2+'),'conta pela metade não vira número');
  t.naoNumero(av('(2+3'),'parêntese que não fecha');
  t.naoNumero(av('2+3)'),'parêntese que não abre');
  t.naoNumero(av('5÷0'),'divisão por zero não vira Infinity na tela');
  t.naoNumero(av('2++3'),'operador repetido');
  t.naoNumero(av('abc'),'texto que não é conta');
  t.naoNumero(av('2+3;alert(1)'),'nada que sobre depois da conta é executado');

  /* O filtro de digitação: o que ele impede nunca chega a virar expressão. */
  t.igual(ctx.calcAceita('','+',','),false,'não começa por operador');
  t.igual(ctx.calcAceita('5','+',','),true,'operador depois de número');
  t.igual(ctx.calcAceita('5+','×',','),false,'dois operadores seguidos');
  t.igual(ctx.calcAceita('5,5',',',','),false,'dois separadores no mesmo número');
  t.igual(ctx.calcAceita('5,5+3',',',','),true,'mas o número seguinte pode ter o seu');
  t.igual(ctx.calcAceita('','%',','),false,'por cento precisa de algo antes');

  console.log('\n\x1b[1mConversor de moedas\x1b[0m');
  const tabela={base:'BRL',data:'2026-09-10',taxas:{USD:0.2,EUR:0.16,GBP:0.125},buscadoEm:Date.now()};

  t.valor(ctx.taxaEntre('BRL','USD',tabela),0.2,'da base para outra moeda');
  t.valor(ctx.taxaEntre('USD','BRL',tabela),5,'e a volta é o inverso');
  t.igual(ctx.taxaEntre('BRL','BRL',tabela),1,'a base para ela mesma');
  t.igual(ctx.taxaEntre('USD','USD',tabela),1,'qualquer moeda para ela mesma');

  /* O par que não passa pela base: USD→EUR é 0,16/0,2. Fazer isso em dois
     saltos (USD→BRL→EUR) daria o mesmo número, mas arredondando duas vezes. */
  t.valor(ctx.taxaEntre('USD','EUR',tabela),0.8,'entre duas moedas que não são a base');
  t.valor(ctx.converterMoeda(250,'USD','EUR',tabela),200,'converte pelo caminho de uma divisão só');
  t.valor(ctx.converterMoeda(100,'BRL','USD',tabela),20,'converte da base');

  t.igual(ctx.taxaEntre('BRL','JPY',tabela),null,'moeda que a tabela não cobre');
  t.igual(ctx.converterMoeda(100,'BRL','JPY',tabela),null,'e a conversão devolve nada, não zero');
  t.igual(ctx.converterMoeda(100,'BRL','USD',null),null,'sem tabela não há conversão');
  t.igual(ctx.converterMoeda(NaN,'BRL','USD',tabela),null,'valor que não é número');

  t.igual(ctx.moedasDaTabela(tabela).join(','),'BRL,EUR,GBP,USD',
    'a lista inclui a base e vem em ordem');
  t.igual(ctx.moedasDaTabela(null).length,0,'sem tabela, lista vazia');

  /* A validação é a fronteira: tabela vinda da rede que não passa aqui não
     chega a ser guardada, e a tela diz que não tem cotação em vez de dizer
     que 1 real vale zero dólar. */
  t.igual(ctx.tabelaDeCambioValida(tabela),true,'tabela boa passa');
  t.igual(ctx.tabelaDeCambioValida(null),false,'nada não passa');
  t.igual(ctx.tabelaDeCambioValida({base:'BRL',data:'2026-09-10',taxas:{}}),false,
    'tabela sem nenhuma cotação não passa');
  t.igual(ctx.tabelaDeCambioValida({base:'brl',data:'2026-09-10',taxas:{USD:0.2}}),false,
    'base fora do formato de três letras maiúsculas');
  t.igual(ctx.tabelaDeCambioValida({base:'BRL',data:'10/09/2026',taxas:{USD:0.2}}),false,
    'data fora do formato ISO');
  t.igual(ctx.tabelaDeCambioValida({base:'BRL',data:'2026-09-10',taxas:{USD:0}}),false,
    'cotação zerada não é cotação');
  t.igual(ctx.tabelaDeCambioValida({base:'BRL',data:'2026-09-10',taxas:{USD:-1}}),false,
    'cotação negativa não é cotação');
};
