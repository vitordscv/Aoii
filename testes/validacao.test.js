/* A fronteira de confiança: tudo que entra de fora passa por
   validateAndNormalizeData() antes de virar `data`.

   Estes testes são adversariais de propósito. Não descrevem o backup que o app
   gera — descrevem o backup que alguém escreveria à mão pra tentar entrar. */
const {criarAmbiente}=require('./ambiente');

const HOJE='2026-09-05';
const ctx=()=>criarAmbiente({},HOJE);

/* backup mínimo que passa */
const base=(extra)=>Object.assign({
  saldoAtual:1000, dinheiroVivo:0, tipoRenda:'mensal',
  rendaMensal:{valor:3000,diaDoMes:5},
  cartoes:[{id:'c1',nome:'Nubank',limite:2000}],
  transacoes:[], faturas:[], entradasExtras:[], comprasPlanejadas:[],
  metas:[], gastosMensais:[], viagens:[],
},extra||{});

module.exports=function(t){
  const c=ctx();
  const V=(entrada,opcoes)=>c.validateAndNormalizeData(entrada,opcoes);

  console.log('\n\x1b[1mValidação: o que não entra\x1b[0m');

  t.igual(V(null).ok,false,'null não é backup');
  t.igual(V([1,2,3]).ok,false,'array não é backup');
  t.igual(V('{"saldoAtual":1}').ok,false,'texto não é backup (o parse é de quem chama)');
  t.igual(V(42).ok,false,'número não é backup');

  t.igual(V(base(),{bytes:6*1024*1024}).ok,false,'arquivo acima de 5 MB é recusado antes de ser lido');

  /* aninhamento fundo: o clássico pra estourar a pilha na travessia */
  let fundo={}; let p=fundo;
  for(let i=0;i<40;i++){ p.n={}; p=p.n; }
  t.igual(V(base({transacoes:[fundo]})).ok,false,'estrutura aninhada demais é recusada');

  t.igual(V(base({schemaVersion:99})).ok,false,
    'backup de uma versão futura do app é recusado em vez de lido pela metade');
  t.igual(V(base({schemaVersion:1})).ok,true,'a versão atual passa');
  t.igual(V(base()).data.schemaVersion,c.SCHEMA_VERSAO,'backup sem versão sai com a versão atual');

  console.log('\n\x1b[1mValidação: prototype pollution\x1b[0m');

  /* JSON.parse cria __proto__ como propriedade comum; o perigo é copiar */
  const veneno=JSON.parse('{"saldoAtual":1,"__proto__":{"invadido":true},'+
    '"orcamentos":{"__proto__":{"invadido":true},"constructor":{"x":1},"Mercado":100}}');
  const r=V(veneno);
  t.igual(r.ok,true,'o backup envenenado é aceito (limpo), não derruba o app');
  t.igual({}.invadido,undefined,'Object.prototype não foi tocado');
  t.igual(Object.prototype.invadido,undefined,'nem por dentro do mapa de orçamentos');
  t.igual(r.data.orcamentos.Mercado,100,'o que era legítimo no mesmo objeto sobreviveu');
  t.igual(Object.keys(r.data.orcamentos).join(','),'Mercado','só a chave legítima ficou');

  console.log('\n\x1b[1mValidação: ids\x1b[0m');

  const comIdSujo=V(base({
    cartoes:[{id:'" onmouseover=alert(1) x="',nome:'Nubank'}],
    faturas:[{id:'f1',ano:2026,mes:9,valor:100,cartaoId:'" onmouseover=alert(1) x="'}],
  })).data;
  const idNovo=comIdSujo.cartoes[0].id;
  t.verdadeiro(/^[A-Za-z0-9:_-]{1,64}$/.test(idNovo),
    'id que sairia de um atributo HTML é trocado','ficou: '+JSON.stringify(idNovo));
  t.igual(comIdSujo.faturas[0].cartaoId,idNovo,
    'a fatura continua apontando pro mesmo cartão depois da troca');

  const comIdLimpo=V(base({
    cartoes:[{id:'c1',nome:'Nubank'}],
    faturas:[{id:'f1',ano:2026,mes:9,valor:100,cartaoId:'c1'}],
  })).data;
  t.igual(comIdLimpo.cartoes[0].id,'c1','id em formato aceitável é preservado');
  t.igual(comIdLimpo.faturas[0].cartaoId,'c1','e a referência também');

  const orfa=V(base({
    cartoes:[{id:'c1',nome:'Nubank'}],
    faturas:[{id:'f1',ano:2026,mes:9,valor:100,cartaoId:'nao-existe'}],
  })).data;
  t.igual(orfa.faturas[0].cartaoId,null,'referência pra cartão que não existe vira nula');

  /* parcelas do mesmo parcelamento precisam continuar juntas */
  const parc=V(base({
    faturas:[
      {id:'f1',ano:2026,mes:9,valor:100,gastos:[{id:'g1',nome:'TV 1/2',valor:50,parcelamentoId:'<x>'}]},
      {id:'f2',ano:2026,mes:10,valor:100,gastos:[{id:'g2',nome:'TV 2/2',valor:50,parcelamentoId:'<x>'}]},
    ],
  })).data;
  const p1=parc.faturas[0].gastos[0].parcelamentoId;
  const p2=parc.faturas[1].gastos[0].parcelamentoId;
  t.verdadeiro(/^[A-Za-z0-9:_-]{1,64}$/.test(p1),'marca de parcelamento suja é trocada');
  t.igual(p1,p2,'as duas parcelas continuam com a MESMA marca depois da troca');

  console.log('\n\x1b[1mValidação: texto e número\x1b[0m');

  const xss='<img src=x onerror=alert(1)>';
  const comXss=V(base({transacoes:[{id:'t1',nome:xss,valor:10,data:'2026-09-01'}]})).data;
  t.igual(comXss.transacoes[0].nome,xss,
    'texto perigoso continua sendo texto — quem escapa é a hora de desenhar, não a validação');

  const gigante='a'.repeat(5000);
  const cortado=V(base({transacoes:[{id:'t1',nome:gigante,valor:10,data:'2026-09-01'}]})).data;
  t.igual(cortado.transacoes[0].nome.length,200,'nome é cortado no limite do esquema');

  const numeros=V(base({
    saldoAtual:'1.234,56',
    dinheiroVivo:'abc',
    limiteCartao:1e30,
    reservaGuardado:-50,
  })).data;
  t.valor(numeros.saldoAtual,1234.56,'"1.234,56" vira 1234,56 e não 1.234');
  t.valor(numeros.dinheiroVivo,0,'texto que não é número cai no padrão');
  t.valor(numeros.limiteCartao,0,'número fora de escala cai no padrão');
  t.valor(numeros.reservaGuardado,0,'valor abaixo do mínimo é preso no mínimo');

  const semNumero=JSON.parse('{"saldoAtual":null,"dinheiroVivo":null}');
  semNumero.saldoAtual=NaN; semNumero.dinheiroVivo=Infinity;
  const limpos=V(Object.assign(base(),semNumero)).data;
  t.valor(limpos.saldoAtual,0,'NaN não vira saldo');
  t.valor(limpos.dinheiroVivo,0,'Infinity não vira saldo');

  console.log('\n\x1b[1mValidação: campos e opções\x1b[0m');

  const estranho=V(base({
    campoQueNaoExiste:'x',
    transacoes:[{id:'t1',nome:'a',valor:1,data:'2026-09-01',campoIntruso:'y'}],
  }));
  t.igual(estranho.data.campoQueNaoExiste,undefined,'campo desconhecido na raiz é descartado');
  t.igual(estranho.data.transacoes[0].campoIntruso,undefined,'e dentro do item também');
  t.verdadeiro(estranho.descartados.length>=2,'os descartes são relatados',
    'veio: '+JSON.stringify(estranho.descartados));

  const enums=V(base({
    tema:'javascript:alert(1)',
    idioma:'xx',
    transacoes:[{id:'t1',nome:'a',valor:1,data:'2026-09-01',metodo:'boleto'}],
    entradasExtras:[{id:'e1',nome:'x',valor:10,modo:'qualquer'}],
  })).data;
  t.igual(enums.tema,'onda','tema fora da lista cai no padrão');
  t.igual(enums.idioma,'pt','idioma fora da lista cai no português');
  t.igual(enums.transacoes[0].metodo,'debito','método fora da lista cai no padrão');
  /* `modo` não tem padrão no esquema: quem decide é a migração, que precisa
     poder ler o interruptor `aosPoucos` do formato antigo */
  t.igual(enums.entradasExtras[0].modo,null,'modo de entrada fora da lista vira nulo na validação');
  t.igual(c.adotarDadosDeFora(base({entradasExtras:[{id:'e1',nome:'x',valor:10,modo:'qualquer'}]}),'arquivo')
           .data.entradasExtras[0].modo,'unica','e o caminho completo o resolve pra "unica"');

  const datas=V(base({
    transacoes:[
      {id:'t1',nome:'a',valor:1,data:'2026-13-45'},
      {id:'t2',nome:'b',valor:1,data:'javascript:alert(1)'},
      {id:'t3',nome:'c',valor:1,data:'2026-09-01'},
    ],
    diasNaoTrabalhados:['2026-09-07','nao-e-data','2026-09-08'],
  })).data;
  t.igual(datas.transacoes[0].data,null,'data impossível vira nula');
  t.igual(datas.transacoes[1].data,null,'texto no lugar de data vira nulo');
  t.igual(datas.transacoes[2].data,'2026-09-01','data boa passa');
  t.igual(datas.diasNaoTrabalhados.join(','),'2026-09-07,2026-09-08','a lista de folgas só aceita datas');

  console.log('\n\x1b[1mValidação: volume\x1b[0m');

  const muitas=[];
  for(let i=0;i<25000;i++) muitas.push({id:'t'+i,nome:'x',valor:1,data:'2026-09-01'});
  const cortada=V(base({transacoes:muitas}));
  t.igual(cortada.data.transacoes.length,c.LIMITES.itens,
    'lista acima do teto é cortada, não recusada — o resto do backup se aproveita');
  t.verdadeiro(cortada.problemas.some(p=>p.includes('cortada')),'e o corte é relatado');

  console.log('\n\x1b[1mValidação: o caminho completo\x1b[0m');

  /* adotarDadosDeFora = validar e só então migrar. Formato antigo tem que
     atravessar as duas etapas inteiro. */
  const antigo=c.adotarDadosDeFora({
    saldoAtual:500,
    internet:{nome:'Vivo',valor:99.9,diaDoMes:12},
    entradasExtras:[{id:'e1',nome:'Geovane',valor:1200,aosPoucos:true,dataPrevista:'2027-01-31'}],
  },'arquivo');
  t.igual(antigo.ok,true,'backup do formato antigo é aceito');
  t.igual(antigo.data.gastosMensais.length,1,'o campo `internet` virou um gasto fixo');
  t.igual(antigo.data.gastosMensais[0].nome,'Vivo','com o nome que tinha');
  t.valor(antigo.data.gastosMensais[0].valor,99.9,'e o valor');
  t.igual(antigo.data.entradasExtras[0].modo,'aosPoucos','o interruptor `aosPoucos` virou `modo`');
  t.igual(antigo.data.entradasExtras[0].aosPoucos,undefined,'e o campo antigo sumiu');
  t.valor(antigo.data.entradasExtras[0].recebido,0,'`recebido` nasce zerado');

  /* o que é legítimo atravessa sem perder nada */
  const real=base({
    saldoAtual:1083.23,
    transacoes:[{id:'t1',nome:'Mercado',valor:150.5,categoria:'Mercado',metodo:'debito',data:'2026-09-01'}],
    entradasExtras:[{id:'e1',nome:'Guilherme',valor:1200,recebido:850,modo:'semPrevisao',feito:false}],
    metas:[{id:'m1',nome:'Viagem',valorAlvo:5000,valorGuardado:1200,aporteMensal:100}],
  });
  const ida=c.adotarDadosDeFora(real,'arquivo');
  t.igual(ida.ok,true,'backup legítimo é aceito');
  t.igual(ida.problemas.length,0,'sem ressalvas','veio: '+JSON.stringify(ida.problemas));
  t.valor(ida.data.saldoAtual,1083.23,'saldo intacto');
  t.valor(ida.data.transacoes[0].valor,150.5,'valor da transação intacto');
  t.igual(ida.data.entradasExtras[0].modo,'semPrevisao','modo da entrada intacto');
  t.valor(ida.data.entradasExtras[0].recebido,850,'quanto já foi recebido intacto');
  t.valor(ida.data.metas[0].valorGuardado,1200,'meta intacta');

  /* passar duas vezes não muda nada — é o que garante que ler do localStorage
     a cada abertura não corrói os dados aos poucos */
  const volta=c.adotarDadosDeFora(JSON.parse(JSON.stringify(ida.data)),'local');
  t.igual(JSON.stringify(volta.data),JSON.stringify(ida.data),
    'validar de novo o que já foi validado não muda nada (sem erosão a cada abertura)');
};
