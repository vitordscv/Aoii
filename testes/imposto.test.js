/* O imposto do Carnê-Leão: do recebimento ao DARF.

   É a parte do app que produz um número que a pessoa vai digitar na Receita e
   responder por ele. Três coisas aqui erram caro e erram calado:

   - calcular um mês antigo com a tabela de outro ano;
   - contar o mesmo dinheiro duas vezes, porque a renda fixa é derivada E o
     recebimento foi registrado à mão;
   - imposto abaixo do mínimo virando DARF de R$ 3,00 que ninguém paga, ou
     sumindo em vez de acumular. */
const {criarAmbiente}=require('./ambiente');

/* 2026-09-17: o relógio dos testes. Datas de vencimento dependem dele. */
const HOJE='2026-09-17';

const base=()=>({saldoAtual:1000,dinheiroVivo:0,tipoRenda:'mensal',
  rendaMensal:{valor:0,diaDoMes:5},rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
  idioma:'pt',moeda:'BRL',dataAlvo:'2026-12-31',
  categorias:['Mercado','Transporte','Lazer','Saúde','Casa','Outros'],
  gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],
  comprasPlanejadas:[],dividas:[],metas:[],rendasRecorrentes:[],
  investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[],
  irFontes:[],impostoTabelas:[],impostoDarfs:[],
  impostoDeducoes:{dependentes:0,pensao:0,inss:0}});

/* um recebimento já marcado como tributável */
const receb=(id,dia,valor,fonteId)=>({
  id,nome:'Recebimento',valor,categoria:'Outros',metodo:'pix',
  data:dia,tipo:'receita',ir:true,irFonteId:fonteId||null});

module.exports=function(t){

  console.log('\n\x1b[1mA tabela progressiva, faixa por faixa\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);
    /* sem dedução nenhuma o bruto ainda perde o desconto simplificado de
       607,20 — então o bruto do teste é a base MAIS isso, pra cair na faixa
       que se quer medir */
    const impostoDe=bruto=>{
      const d=base();
      d.transacoes=[receb('t1','2026-03-10',bruto)];
      return criarAmbiente(d,HOJE).calcularIRMes(2026,3);
    };

    /* base 2.000 → isento. 2000+607,20 de bruto */
    t.valor(impostoDe(2607.20).imposto,0,'base na primeira faixa não paga nada');

    /* base 2.500 → 7,5% − 182,16 = 5,34 */
    const f2=impostoDe(3107.20);
    t.valor(f2.base,2500,'a base desconta o simplificado');
    t.valor(f2.impostoDaTabela,5.34,'segunda faixa: 7,5% menos 182,16');

    /* base 3.000 → 15% − 394,16 = 55,84 */
    t.valor(impostoDe(3607.20).impostoDaTabela,55.84,'terceira faixa');

    /* base 4.000 → 22,5% − 675,49 = 224,51 */
    t.valor(impostoDe(4607.20).impostoDaTabela,224.51,'quarta faixa');

    /* base 6.000 → 27,5% − 896,00 = 754,00 */
    t.valor(impostoDe(6607.20).impostoDaTabela,754,'quinta faixa, a que não tem teto');

    t.igual(c.faixaIR(2428.80,c.tabelaIRDoAno(2026)).indice,0,'o teto da faixa pertence a ela');
    t.igual(c.faixaIR(2428.81,c.tabelaIRDoAno(2026)).indice,1,'um centavo acima já é a próxima');
  }

  console.log('\n\x1b[1mA redução de 2026 incide sobre o BRUTO, não sobre a base\x1b[0m');
  {
    const comBruto=bruto=>{
      const d=base();
      d.transacoes=[receb('t1','2026-03-10',bruto)];
      return criarAmbiente(d,HOJE).calcularIRMes(2026,3);
    };

    t.valor(comBruto(5000).imposto,0,'bruto até 5.000 não paga nada');
    t.verdadeiro(comBruto(5000).impostoDaTabela>0,
      'e a tabela cobrava: quem zera é a redução',
      'se a tabela já dessem zero, o teste não mediria a redução');

    /* bruto 6.000: tabela sobre base 5.392,80 → 27,5% − 896 = 587,02
       redução = 978,62 − 0,133145×6000 = 179,75 → imposto 407,27 */
    const seis=comBruto(6000);
    t.valor(seis.impostoDaTabela,587.02,'tabela sobre a base');
    t.valor(seis.reducao,179.75,'redução calculada sobre o bruto');
    t.valor(seis.imposto,407.27,'e o imposto é a diferença');

    t.valor(comBruto(7400).reducao,0,'acima de 7.350 não há redução');

    /* A fórmula da redução foi desenhada pra encostar no imposto em 5.000 —
       medido: aos 5.000 exatos, imposto 312,89 e redução 312,90. Sem dedução
       nenhuma ela quase nunca passa do imposto, e é aí que está a armadilha:
       a redução vem do BRUTO, o imposto vem da BASE, e dedução derruba a base
       sem derrubar o bruto. Com dependentes a redução passa o imposto — e sem
       o teto o app diria que a Receita deve dinheiro a você. */
    const d=base();
    d.transacoes=[receb('t1','2026-03-10',5200)];
    d.impostoDeducoes={dependentes:1,pensao:500,inss:300};
    const c=criarAmbiente(d,HOJE);
    const calc=c.calcularIRMes(2026,3);
    t.valor(calc.impostoDaTabela,271.85,'o imposto da tabela, já com as deduções');
    t.verdadeiro(calc.reducao<=calc.impostoDaTabela,
      'a redução para no próprio imposto',
      'a fórmula crua daria 286,27 — mais que o imposto');
    t.valor(calc.imposto,0,'e o imposto fica em zero, nunca negativo');
    t.verdadeiro(calc.imposto>=0,'nenhum caminho leva a imposto negativo');
  }

  console.log('\n\x1b[1mDesconto simplificado OU deduções — nunca os dois\x1b[0m');
  {
    const d=base();
    d.transacoes=[receb('t1','2026-03-10',6000)];
    d.impostoDeducoes={dependentes:1,pensao:0,inss:0};
    const c=criarAmbiente(d,HOJE);

    /* 1 dependente = 189,59, menor que o simplificado de 607,20 */
    const comUm=c.calcularIRMes(2026,3);
    t.valor(comUm.deducoes.usado,607.20,'uma dedução menor perde pro simplificado');
    t.verdadeiro(comUm.deducoes.usouSimplificado,'e o plano diz qual foi usado');

    d.impostoDeducoes={dependentes:4,pensao:0,inss:0};
    const comQuatro=c.calcularIRMes(2026,3);
    t.valor(comQuatro.deducoes.usado,758.36,'quatro dependentes passam o simplificado');
    t.verdadeiro(!comQuatro.deducoes.usouSimplificado,'e aí valem as deduções');

    d.impostoDeducoes={dependentes:1,pensao:500,inss:300};
    const comTudo=c.calcularIRMes(2026,3);
    t.valor(comTudo.deducoes.usado,989.59,'dependente + pensão + INSS somam entre si');
    t.valor(comTudo.base,5010.41,'e a base é o bruto menos isso',
      'somar o simplificado junto daria base menor e imposto a menos');
  }

  console.log('\n\x1b[1mRenda fixa derivada, e o registro que vence a derivada\x1b[0m');
  {
    const d=base();
    d.irFontes=[{id:'f1',nome:'Financeiro pizzaria',tipo:'mensal',valorPadrao:3000}];
    d.rendasRecorrentes=[{id:'r1',tipo:'pj',nome:'Financeiro pizzaria',valor:3000,
      diaDoMes:10,ativo:true,irPadrao:true,irFonteId:'f1'}];
    const c=criarAmbiente(d,HOJE);

    const so=c.recebimentosTributaveisIR(2026,3);
    t.igual(so.length,1,'a renda fixa entra sozinha, sem ninguém registrar nada');
    t.igual(so[0].origem,'derivado','marcada como derivada');
    t.igual(so[0].data,'2026-03-10','na data do dia do mês');
    t.valor(c.calcularIRMes(2026,3).bruto,3000,'e soma no bruto do mês');

    /* nada foi gravado no Diário: era o risco de "renda fixa automática" */
    t.igual(d.transacoes.length,0,'e NADA foi lançado no Diário',
      'lançar criaria saldo que talvez não entrou, e a projeção iria atrás');
    t.valor(d.saldoAtual,1000,'nem o saldo se mexeu');

    /* agora a pessoa registra o recebimento de verdade, da mesma fonte */
    d.transacoes=[receb('t1','2026-03-12',3200,'f1')];
    const comRegistro=c.recebimentosTributaveisIR(2026,3);
    t.igual(comRegistro.length,1,'registrada a mesma fonte, a derivada sai de cena');
    t.igual(comRegistro[0].origem,'registrado','fica a registrada');
    t.valor(c.calcularIRMes(2026,3).bruto,3200,'e o bruto é o que entrou de verdade',
      'as duas juntas contariam 6.200 e dobrariam o imposto');

    /* outro mês continua derivando */
    t.igual(c.recebimentosTributaveisIR(2026,4)[0].origem,'derivado',
      'o mês seguinte, sem registro, volta a derivar');

    /* renda pausada não deriva */
    d.rendasRecorrentes[0].ativo=false;
    t.igual(c.recebimentosTributaveisIR(2026,5).length,0,'renda pausada não deriva nada');
  }

  console.log('\n\x1b[1mCada mês usa a tabela do ano dele\x1b[0m');
  {
    const d=base();
    d.transacoes=[receb('a','2025-05-10',6000),receb('b','2026-05-10',6000)];
    /* uma tabela inventada para 2025: faixa única de 10%, sem redução */
    d.impostoTabelas=[{ano:2025,anoVigencia:2025,descontoSimplificado:0,
      dependente:0,darfMinimo:10,
      faixas:[{ate:null,aliquota:0.10,deduzir:0}],
      reducao:{isentoAte:0,limite:0,base:0,fator:0}}];
    const c=criarAmbiente(d,HOJE);

    t.valor(c.calcularIRMes(2025,5).imposto,600,'2025 usa a tabela de 2025');
    t.igual(c.calcularIRMes(2025,5).anoDaTabela,2025,'e diz qual tabela usou');
    t.valor(c.calcularIRMes(2026,5).imposto,407.27,'2026 segue na tabela de 2026',
      'uma tabela só recalcularia o ano antigo com número que nunca foi devido');

    /* restaurar o padrão apaga a tabela do ano, não grava o padrão em cima */
    t.verdadeiro(c.restaurarTabelaIR(2025),'restaurar devolve verdadeiro');
    t.igual(d.impostoTabelas.length,0,'e a lista fica sem aquele ano');
  }

  console.log('\n\x1b[1mA tabela editada à mão, e o que é recusado\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    const boa={anoVigencia:2027,descontoSimplificado:700,dependente:200,darfMinimo:10,
      faixas:[{ate:3000,aliquota:0,deduzir:0},{ate:null,aliquota:0.2,deduzir:100}],
      reducao:{isentoAte:5000,limite:7000,base:900,fator:0.12}};

    t.verdadeiro(!!c.salvarTabelaIR(2027,boa),'tabela coerente é salva');
    t.igual(d.impostoTabelas.length,1,'e entra na lista');
    t.valor(c.tabelaIRDoAno(2027).descontoSimplificado,700,'e passa a valer pro ano dela');

    /* faixa fora de ordem: faixaIR() pararia na errada e a alíquota sairia
       menor do que a devida, sem ninguém notar */
    const foraDeOrdem=JSON.parse(JSON.stringify(boa));
    foraDeOrdem.faixas=[{ate:5000,aliquota:0,deduzir:0},{ate:3000,aliquota:0.2,deduzir:0},
      {ate:null,aliquota:0.3,deduzir:0}];
    t.igual(c.salvarTabelaIR(2028,foraDeOrdem),null,'faixa fora de ordem é recusada');

    /* A última faixa é SEMPRE aberta, mesmo que se digite um teto nela: quem
       ganhasse acima do último teto não cairia em faixa nenhuma e sairia sem
       imposto. Em vez de recusar a tabela por isso, o teto da última é
       ignorado — e a tela mostra aquele campo desabilitado, dizendo
       "sem teto". */
    const comTetoNaUltima=JSON.parse(JSON.stringify(boa));
    comTetoNaUltima.faixas=[{ate:3000,aliquota:0,deduzir:0},{ate:9000,aliquota:0.2,deduzir:0}];
    const salvaComTeto=c.salvarTabelaIR(2029,comTetoNaUltima);
    t.verdadeiro(!!salvaComTeto,'teto digitado na última faixa não recusa a tabela');
    t.igual(salvaComTeto.faixas[salvaComTeto.faixas.length-1].ate,null,
      'ele é ignorado: a última continua aberta',
      'com teto na última, quem ganha acima dele não cairia em faixa nenhuma');

    const negativa=JSON.parse(JSON.stringify(boa));
    negativa.descontoSimplificado=-10;
    t.igual(c.salvarTabelaIR(2028,negativa),null,'número negativo é recusado');

    const semFaixa=JSON.parse(JSON.stringify(boa));
    semFaixa.faixas=[];
    t.igual(c.salvarTabelaIR(2028,semFaixa),null,'tabela sem faixa nenhuma é recusada');

    const anoAbsurdo=JSON.parse(JSON.stringify(boa));
    anoAbsurdo.anoVigencia=1800;
    t.igual(c.salvarTabelaIR(1800,anoAbsurdo),null,'ano fora de escala é recusado');

    t.igual(d.impostoTabelas.length,2,'nenhuma recusa gravou nada',
      'tabela de imposto meio salva é pior que tabela não salva');
  }

  console.log('\n\x1b[1mDARF: abaixo do mínimo acumula, não desaparece\x1b[0m');
  {
    const d=base();
    /* A janela em que o imposto existe mas não chega a R$ 10 é estreita, e
       descobri-la foi o próprio teste me corrigindo: com a redução de 2026,
       bruto até 5.000 não paga NADA, então "três meses pequenos" de 2.650 dão
       imposto zero e nem chegam ao DARF. Medido, sem dedução nenhuma:
       imposto = 0,358145 × bruto − 1.790,73, zero em 5.000 e R$ 10 em 5.027,90.
       Daí os valores abaixo — 3,58 + 5,37 = 8,95, que acumula, e o terceiro
       mês fecha. */
    d.transacoes=[receb('a','2026-02-10',5010),receb('b','2026-03-10',5015),
                  receb('c','2026-04-10',5020)];
    const c=criarAmbiente(d,HOJE);
    t.valor(c.calcularIRMes(2026,2).imposto,3.58,'fevereiro dá imposto, mas de centavos');

    const fev=c.darfIR(2026,2);
    t.igual(fev.estado,'acumula','imposto abaixo de R$ 10 não vira DARF');
    t.valor(fev.valor,0,'e não se paga nada em fevereiro');

    const mar=c.darfIR(2026,3);
    t.igual(mar.estado,'acumula','março também fica abaixo');
    t.valor(mar.acumulado,c.calcularIRMes(2026,2).imposto+c.calcularIRMes(2026,3).imposto,
      'mas o acumulado soma os dois');

    const abr=c.darfIR(2026,4);
    t.igual(abr.estado,'pagar','em abril o acumulado passa do mínimo');
    t.valor(abr.acumulado,16.11,'3,58 + 5,37 + 7,16');
    t.igual(abr.acumuladoDe.join(','),'2,3,4','e o DARF diz de que meses ele vem');
    t.valor(abr.valor,abr.acumulado,'o valor a pagar é o acumulado inteiro');

    /* depois de fechar, o acúmulo zera */
    const mai=c.darfIR(2026,5);
    t.valor(mai.acumulado,0,'o mês seguinte começa do zero');
    t.igual(mai.estado,'nada','e mês sem recebimento não tem estado nenhum');
  }

  console.log('\n\x1b[1mO vencimento é dia útil, e feriado empurra\x1b[0m');
  {
    const c=criarAmbiente(base(),HOJE);

    /* 31/12 nunca é dia útil: é feriado em lugar nenhum da lei, mas 1/1 é, e
       31/12/2026 é quinta — o que faz dele dia útil de verdade */
    t.igual(c.isoDate(c.ultimoDiaUtilDoMes(2026,1)),'2026-01-30',
      '31/01/2026 é sábado: cai pra sexta');

    /* 30/04/2027 é sexta, mas 1/5 é feriado e não interfere no mês de abril */
    t.igual(c.isoDate(c.ultimoDiaUtilDoMes(2027,4)),'2027-04-30','30/04/2027 é sexta útil');

    /* o Natal de 2026 é sexta, então o último dia útil de dezembro é 31, quinta */
    t.igual(c.isoDate(c.ultimoDiaUtilDoMes(2026,12)),'2026-12-31','31/12/2026 é quinta útil');

    /* 2025: 31/12 é quarta, mas é o teste de que feriado conta — 25/12/2025 é
       quinta e não é o último dia do mês, então o que vale é o fim de semana */
    t.igual(c.isoDate(c.ultimoDiaUtilDoMes(2026,5)),'2026-05-29','31/05/2026 é domingo: cai pra sexta');

    /* Páscoa, de onde saem Carnaval, Sexta-feira Santa e Corpus Christi */
    t.igual(c.isoDate(c.domingoDePascoa(2026)),'2026-04-05','a Páscoa de 2026');
    const feriados2026=c.feriadosNacionais(2026);
    t.verdadeiro(feriados2026.has('2026-04-03'),'Sexta-feira Santa entra');
    t.verdadeiro(feriados2026.has('2026-02-17'),'Carnaval entra');
    t.verdadeiro(feriados2026.has('2026-06-04'),'Corpus Christi entra');
    t.verdadeiro(feriados2026.has('2026-09-07'),'e os fixos também');

    /* o vencimento do DARF é o mês SEGUINTE ao recebimento */
    t.igual(c.isoDate(c.ultimoDiaUtilDoMesSeguinte(2026,12)),'2027-01-29',
      'dezembro vence em janeiro do ano seguinte',
      'e os feriados aí são os do ano novo, não os do ano que fechou');
  }

  console.log('\n\x1b[1mPagar é marca da pessoa, e o ano soma o que falta\x1b[0m');
  {
    const d=base();
    d.transacoes=[receb('a','2026-03-10',6000),receb('b','2026-04-10',6000)];
    const c=criarAmbiente(d,HOJE);

    const antes=c.resumoAnualIR(2026);
    t.valor(antes.bruto,12000,'o ano soma o que entrou');
    t.valor(antes.imposto,814.54,'e o imposto dos dois meses');
    t.valor(antes.pago,0,'nada pago ainda');
    t.igual(antes.pendentes.length,2,'dois meses pendentes');
    /* o relógio do teste é 17/09/2026: o DARF de março venceu em 30/04 e o de
       abril em 29/05 — os dois já passaram. Eu esperava um; errei a conta e o
       teste acusou, que é o serviço dele. */
    t.igual(antes.vencidos.length,2,'e os dois já venceram');

    c.marcarDarfIRPago(2026,3,true);
    const depois=c.resumoAnualIR(2026);
    t.valor(depois.pago,407.27,'marcado, o pago sobe');
    t.valor(depois.aPagar,407.27,'e o que falta cai');
    t.igual(depois.pendentes.length,1,'sobra um pendente');
    t.igual(depois.vencidos.length,1,'e o de abril continua vencido');

    /* desmarcar apaga o registro: "pago" é só da pessoa, e tem que dar pra
       desfazer sem deixar lixo */
    c.marcarDarfIRPago(2026,3,false);
    t.igual(d.impostoDarfs.length,0,'desmarcar não deixa registro para trás');
    t.valor(c.resumoAnualIR(2026).pago,0,'e o pago volta a zero');
  }

  console.log('\n\x1b[1mO aviso de ano, e a confirmação que copia a tabela\x1b[0m');
  {
    const d=base();
    const c=criarAmbiente(d,HOJE);
    t.igual(c.anoVigenciaIR(),2026,'sem nada salvo, vale o ano do padrão embutido');

    t.igual(c.confirmarAnoVigenciaIR(2026),null,'confirmar o ano que já vale não faz nada');

    const nova=c.confirmarAnoVigenciaIR(2027);
    t.verdadeiro(!!nova,'confirmar um ano novo cria a tabela dele');
    t.igual(c.anoVigenciaIR(),2027,'e o aviso para de aparecer');
    t.valor(c.tabelaIRDoAno(2027).descontoSimplificado,607.20,'com os mesmos números');
    t.valor(c.tabelaIRDoAno(2026).descontoSimplificado,607.20,
      'e 2026 continua calculável',
      'mover o carimbo em vez de copiar deixaria o ano antigo sem tabela');
  }

  console.log('\n\x1b[1mA diária em um toque, e o texto que vai pro Carnê-Leão\x1b[0m');
  {
    const d=base();
    d.irFontes=[{id:'f1',nome:'Diária presencial',tipo:'diaria',valorPadrao:250}];
    const c=criarAmbiente(d,HOJE);

    const mov=c.registrarDiariaIR('f1');
    t.verdadeiro(!!mov,'a diária é lançada');
    t.valor(mov.valor,250,'com o valor padrão da fonte');
    t.igual(mov.tipo,'receita','como receita');
    t.verdadeiro(mov.ir===true,'já marcada para o IR');
    t.igual(mov.irFonteId,'f1','e com a fonte junto');
    /* diária é dinheiro que entrou na mão: esta SIM mexe no saldo */
    t.valor(d.saldoAtual,1250,'e o saldo sobe, porque o dinheiro entrou de verdade');

    t.igual(c.registrarDiariaIR('nao-existe'),null,'fonte inexistente não lança nada');

    /* o texto copiado: data e valor, que é o que o programa pede */
    const d2=base();
    d2.irFontes=[{id:'f1',nome:'Diária presencial',tipo:'diaria',valorPadrao:250}];
    d2.transacoes=[receb('a','2026-03-05',250,'f1'),receb('b','2026-03-12',250,'f1')];
    const c2=criarAmbiente(d2,HOJE);
    const texto=c2.textoCarneLeaoIR(2026,3);
    t.verdadeiro(/03\/2026/.test(texto),'o texto diz o mês');
    t.verdadeiro(/05\/03\/2026\t250,00/.test(texto),'cada recebimento sai com data e valor');
    t.verdadeiro(/500,00/.test(texto),'e o total do mês');
    t.verdadeiro(!/[Ee]stimativa/.test(texto),
      'sem o aviso de estimativa no texto',
      'isto vai pra um formulário: aviso ali só dá trabalho de apagar');
  }

  console.log('\n\x1b[1mRecebimento sem marca não é tributável\x1b[0m');
  {
    const d=base();
    d.transacoes=[
      {id:'a',nome:'Presente',valor:5000,categoria:'Outros',metodo:'pix',
       data:'2026-03-10',tipo:'receita'},
      {id:'b',nome:'Mercado',valor:200,categoria:'Mercado',metodo:'debito',
       data:'2026-03-11'},
    ];
    const c=criarAmbiente(d,HOJE);
    t.igual(c.recebimentosTributaveisIR(2026,3).length,0,
      'receita sem a marca fica de fora, e gasto também');
    t.valor(c.calcularIRMes(2026,3).imposto,0,'então não há imposto');
  }
};
