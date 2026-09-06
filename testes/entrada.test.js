/* Leitura de número digitado.
   Os campos de dinheiro são <input type="text" inputmode="decimal">, então
   chega "1.234,56" no teclado brasileiro, "1234,56" ou "1234.56". */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';

const minimo=idioma=>({saldoAtual:0,dinheiroVivo:0,tipoRenda:'mensal',rendaMensal:{valor:0,diaDoMes:5},
  idioma,dataAlvo:'2026-12-31',gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],
  comprasPlanejadas:[],metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[]});

module.exports=function(t){
  console.log('\n\x1b[1mLeitura de número digitado (português)\x1b[0m');
  const pt=criarAmbiente(minimo('pt'),HOJE).parseNum;

  [['1234,56',1234.56,'vírgula é decimal'],
   ['1.234,56',1234.56,'ponto de milhar + vírgula decimal'],
   ['12.345.678,90',12345678.9,'vários pontos de milhar'],
   ['5.400',5400,'só ponto com 3 dígitos depois é milhar em português'],
   ['5400',5400,'número puro'],
   ['33.34',33.34,'ponto com 2 dígitos é decimal (valor vindo do próprio app)'],
   ['19.9',19.9,'ponto com 1 dígito é decimal'],
   ['0.125',0.125,'zero na frente nunca é grupo de milhar'],
   ['1234.567',1234.567,'4 dígitos antes do ponto: decimal'],
   ['1.234.567',1234567,'dois pontos de milhar, sem decimal'],
   ['-50,5',-50.5,'negativo'],
   ['R$ 1.234,56',1234.56,'símbolo de moeda e espaço são ignorados'],
   ['1,234.56',1234.56,'formato inglês: o último separador é o decimal'],
   ['0,50',0.5,'centavos'],
   ['.5',0.5,'começando com separador'],
   [',5',0.5,'começando com vírgula'],
   ['0',0,'zero'],
  ].forEach(([entrada,esperado,msg])=>t.valor(pt(entrada),esperado,'"'+entrada+'" → '+esperado+'  ('+msg+')'));

  t.naoNumero(pt(''),'texto vazio devolve NaN (as validações do app dependem disso)');
  t.naoNumero(pt('abc'),'texto sem número devolve NaN');
  t.valor(pt(42),42,'número já pronto passa direto');

  console.log('\n\x1b[1mLeitura de número digitado (inglês)\x1b[0m');
  const en=criarAmbiente(minimo('en'),HOJE).parseNum;
  [['5.400',5.4,'em inglês o ponto é decimal'],
   ['5,400',5400,'em inglês a vírgula é de milhar'],
   ['1,234.56',1234.56,'milhar + decimal'],
   ['1234.56',1234.56,'decimal simples'],
  ].forEach(([entrada,esperado,msg])=>t.valor(en(entrada),esperado,'"'+entrada+'" → '+esperado+'  ('+msg+')'));
};
