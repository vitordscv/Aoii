/* Entrada x gasto, parcelamento, metas e o desfazer do Diário. */
const {criarAmbiente}=require('./ambiente');
const HOJE='2026-09-05';

const base=()=>({saldoAtual:1000,dinheiroVivo:0,tipoRenda:'mensal',rendaMensal:{valor:0,diaDoMes:20},
  rendaDiaria:0,diasTrabalho:[1,2,3,4,5],idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[],cartoes:[{id:'a',nome:'Nu',limite:2000,diaFechamento:10}],
  faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],metas:[],rendasRecorrentes:[],
  investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[],categorias:['Mercado','Outros']});

module.exports=function(t){

  console.log('\n\x1b[1mEntrada não pode contar como gasto\x1b[0m');
  const d=base();
  d.transacoes=[
    {id:'g1',nome:'Mercado',valor:200,categoria:'Mercado',metodo:'debito',data:'2026-09-02'},
    {id:'g2',nome:'Café',valor:30,categoria:'Outros',metodo:'dinheiro',data:'2026-09-05'},
    {id:'r1',nome:'Reembolso',valor:500,categoria:'Outros',metodo:'pix',data:'2026-09-03',tipo:'receita'},
    {id:'r2',nome:'Presente',valor:900,categoria:'Outros',metodo:'pix',data:'2026-09-05',tipo:'receita'}];
  const ctx=criarAmbiente(d,HOJE);

  t.valor(ctx.computeMonthSpend(2026,9),230,'gasto do mês soma só os gastos (200+30), não as entradas');
  t.valor(ctx.computeCategoryBreakdown().total,230,'gasto por categoria ignora entradas');
  t.valor(ctx.computeWeekSummary().gastoSemana,230,'últimos 7 dias ignora entradas E inclui o dia de hoje');
  t.valor(ctx.computeGastoMesPorCategoria()['Mercado'],200,'orçamento por categoria ignora entradas');
  t.valor(ctx.transacoesGasto().length,2,'só dois lançamentos são gasto de verdade');
  const insights=ctx.computeInsights();
  t.valor(insights[1]&&Number(String(insights[1].value).replace(/[^\d.]/g,'')),200,
    'o "maior gasto" é o Mercado de 200, não o Presente de 900');

  console.log('\n\x1b[1mDesfazer a remoção de um lançamento\x1b[0m');
  /* replica o que a tela faz: remover e depois desfazer */
  function ciclo(tipo){
    const dd=base();
    dd.transacoes=[{id:'x',nome:'t',valor:100,categoria:'Outros',metodo:'pix',data:'2026-09-04',tipo}];
    const c=criarAmbiente(dd,HOJE);
    const removida=c.removerTransacao('x');
    const depoisDeApagar=dd.saldoAtual;
    c.restaurarTransacao(removida.item,removida.indice);
    return {depoisDeApagar,depoisDeDesfazer:dd.saldoAtual};
  }
  const gasto=ciclo(undefined);
  t.valor(gasto.depoisDeApagar,1100,'apagar um gasto de 100 devolve o dinheiro');
  t.valor(gasto.depoisDeDesfazer,1000,'desfazer volta ao saldo original');
  const receita=ciclo('receita');
  t.valor(receita.depoisDeApagar,900,'apagar uma entrada de 100 tira o dinheiro');
  t.valor(receita.depoisDeDesfazer,1000,'desfazer volta ao saldo original (não desconta de novo)');

  console.log('\n\x1b[1mComandos do Diário mantêm item e saldo juntos\x1b[0m');
  const dc=base();
  const cc=criarAmbiente(dc,HOJE);
  const criado=cc.registrarMovimento({nome:'Mercado',valor:100,categoria:'Mercado',metodo:'pix',data:'2026-09-01',tags:['casa'],nota:'semana'});
  t.valor(dc.saldoAtual,900,'criar um gasto desconta o saldo');
  t.igual(criado.data,'2026-09-01','a data escolhida nasce junto com o lançamento');
  t.igual(criado.tags[0],'casa','metadados nascem no mesmo comando');
  cc.atualizarTransacao(criado.id,{nome:'Reembolso',valor:150,categoria:'Outros',metodo:'dinheiro',data:'2026-09-02',tipo:'receita',tags:[],nota:''});
  t.valor(dc.saldoAtual,1000,'editar estorna o efeito antigo na conta');
  t.valor(dc.dinheiroVivo,150,'e aplica o novo efeito no dinheiro vivo');
  t.igual(dc.transacoes[0].tipo,'receita','a edição também troca gasto por entrada');
  t.verdadeiro(Boolean(dc.saldoAtualizadoEm&&dc.dinheiroVivoAtualizadoEm),'as duas origens alteradas recebem data de atualização');
  const antes=dc.saldoAtual;
  t.igual(cc.registrarMovimento({nome:'Inválido',valor:-1,metodo:'pix'}),null,'valor inválido é recusado pelo comando');
  t.valor(dc.saldoAtual,antes,'comando recusado não altera o saldo');


  console.log('\n\x1b[1mRepetir último gasto ignora entradas\x1b[0m');
  const dadosRepetir=base();
  dadosRepetir.saldoAtual=1000;
  dadosRepetir.transacoes=[
    {id:'r1',nome:'Presente',valor:500,categoria:'Outros',metodo:'pix',data:'2026-09-05',tipo:'receita'},
    {id:'g1',nome:'Almoço',valor:40,categoria:'Outros',metodo:'pix',data:'2026-09-04',tags:['trabalho'],nota:'cliente'},
  ];
  const ctxRepetir=criarAmbiente(dadosRepetir,HOJE);
  const repetido=ctxRepetir.repetirUltimoGasto();
  t.igual(repetido.nome,'Almoço','uma entrada mais recente não é repetida como gasto');
  t.igual(repetido.tipo,undefined,'o lançamento repetido continua sendo gasto');
  t.valor(dadosRepetir.saldoAtual,960,'repetir desconta somente o valor do gasto');
  t.igual(repetido.data,HOJE,'o gasto repetido recebe a data de hoje');
  t.igual(repetido.tags[0],'trabalho','as tags são preservadas');
  t.igual(repetido.nota,'cliente','a nota é preservada');

  console.log('\n\x1b[1mComandos de renda recorrente são atômicos\x1b[0m');
  const dadosRenda=base();
  const ctxRenda=criarAmbiente(dadosRenda,HOJE);
  t.igual(ctxRenda.criarRendaRecorrente({tipo:'desconhecido',valor:100,diaDoMes:5}),null,'tipo desconhecido é recusado');
  t.igual(ctxRenda.criarRendaRecorrente({tipo:'clt',valor:-1,diaDoMes:5}),null,'valor inválido é recusado');
  t.igual(ctxRenda.criarRendaRecorrente({tipo:'clt',valor:100,diaDoMes:32}),null,'dia fora do mês é recusado');
  t.igual(dadosRenda.rendasRecorrentes.length,0,'comandos recusados não deixam item parcial');
  const renda=ctxRenda.criarRendaRecorrente({tipo:'clt',nome:'Salário',valor:2500,diaDoMes:5,ativo:true});
  t.igual(renda.tipo,'clt','tipo nasce junto com a renda');
  t.valor(ctxRenda.rendasRecorrentesEntre(new Date('2026-09-01T00:00:00'),new Date('2026-09-30T23:59:59')),2500,'renda criada entra na projeção');
  const valorAntes=renda.valor;
  t.igual(ctxRenda.atualizarRendaRecorrente(renda.id,{nome:'Alterado',valor:0}),null,'edição inválida é recusada antes de alterar');
  t.igual(renda.nome,'Salário','edição recusada não altera o nome');
  t.valor(renda.valor,valorAntes,'edição recusada não altera o valor');
  ctxRenda.atualizarRendaRecorrente(renda.id,{tipo:'freela',nome:'Projeto',valor:900,diaDoMes:20,ativo:false});
  t.igual(renda.tipo,'freela','edição válida troca o tipo');
  t.igual(renda.ativo,false,'renda pausada deixa de ficar ativa');
  t.valor(ctxRenda.rendasRecorrentesAtivas().length,0,'renda pausada sai dos cálculos');
  const rendaRemovida=ctxRenda.removerRendaRecorrente(renda.id);
  t.igual(dadosRenda.rendasRecorrentes.length,0,'renda é removida pelo comando');
  ctxRenda.restaurarRendaRecorrente(rendaRemovida.item,rendaRemovida.indice);
  t.igual(dadosRenda.rendasRecorrentes[0].id,renda.id,'desfazer restaura a renda na posição');

  console.log('\n\x1b[1mComandos de metas preservam o patrimônio\x1b[0m');
  const dadosMeta=base();
  const ctxMeta=criarAmbiente(dadosMeta,HOJE);
  t.igual(ctxMeta.criarMeta({nome:'',valorAlvo:1000}),null,'meta sem nome é recusada');
  t.igual(dadosMeta.metas.length,0,'criação recusada não deixa item parcial');
  const meta=ctxMeta.criarMeta({nome:'Viagem',valorAlvo:1000,aporteMensal:100,dataAlvo:'2027-01-31'});
  t.igual(meta.dataAlvo,'2027-01-31','prazo nasce junto com a meta');
  t.valor(meta.aporteMensal,100,'aporte mensal nasce junto com a meta');
  t.igual(meta.ultimoAporte,'2026-9','meta nova não recebe aporte automático duplicado no mesmo mês');
  const patrimonioMeta=ctxMeta.patrimonioCalculado();
  ctxMeta.atualizarMeta(meta.id,{valorGuardado:300});
  t.valor(dadosMeta.saldoAtual,700,'guardar dinheiro na meta retira o mesmo valor da conta');
  t.valor(ctxMeta.patrimonioCalculado(),patrimonioMeta,'guardar dinheiro não cria patrimônio');
  ctxMeta.atualizarMeta(meta.id,{valorGuardado:120});
  t.valor(dadosMeta.saldoAtual,880,'reduzir o guardado devolve a diferença para a conta');
  const nomeAntes=meta.nome;
  t.igual(ctxMeta.atualizarMeta(meta.id,{nome:'Mudou',valorGuardado:-1}),null,'edição inválida é recusada antes de alterar a meta');
  t.igual(meta.nome,nomeAntes,'edição recusada não altera outro campo');
  const metaRemovida=ctxMeta.removerMeta(meta.id);
  t.valor(dadosMeta.saldoAtual,1000,'excluir a meta devolve o valor guardado para a conta');
  t.igual(dadosMeta.metas.length,0,'a meta é removida');
  ctxMeta.restaurarMeta(metaRemovida.item,metaRemovida.indice);
  t.valor(dadosMeta.saldoAtual,880,'desfazer recoloca o dinheiro na meta');
  t.igual(dadosMeta.metas[0].id,meta.id,'desfazer restaura a meta na lista');

  console.log('\n\x1b[1mComandos de cartão preservam faturas e referências\x1b[0m');
  const dadosCartao=base();
  dadosCartao.cartoes=[
    {id:'a',nome:'Principal',limite:2000,diaFechamento:10,diaVencimento:17},
    {id:'b',nome:'Secundário',limite:1000,diaFechamento:5,diaVencimento:12},
  ];
  dadosCartao.faturas=[
    {id:'fa',ano:2026,mes:9,valor:100,pago:true,cartaoId:'a',gastos:[{id:'ga',nome:'A',valor:20,pago:true}]},
    {id:'fb',ano:2026,mes:9,valor:200,pago:false,cartaoId:'b',gastos:[{id:'gb',nome:'B',valor:30,pago:false}]},
    {id:'fb2',ano:2026,mes:10,valor:50,pago:false,cartaoId:'b',gastos:[]},
  ];
  dadosCartao.comprasPlanejadas=[{id:'cp',nome:'Compra',valor:500,cartao:true,parcelas:1,cartaoId:'b'}];
  const ctxCartao=criarAmbiente(dadosCartao,HOJE);
  t.igual(ctxCartao.criarCartao({nome:'',limite:500}),null,'cartão sem nome é recusado');
  t.igual(ctxCartao.criarCartao({nome:'Inválido',limite:-1}),null,'limite negativo é recusado');
  t.igual(ctxCartao.criarCartao({nome:'Inválido',limite:500,diaFechamento:32}),null,'dia fora do mês é recusado');
  t.igual(dadosCartao.cartoes.length,2,'criações recusadas não deixam cartão parcial');
  const novoCartao=ctxCartao.criarCartao({nome:'  Viagem  ',limite:800,diaFechamento:'8',diaVencimento:''});
  t.igual(novoCartao.nome,'Viagem','nome do cartão é normalizado');
  t.igual(novoCartao.diaFechamento,8,'dia válido é convertido em número');
  t.igual(novoCartao.diaVencimento,null,'dia opcional pode ficar vazio');
  const nomeAntesCartao=novoCartao.nome;
  t.igual(ctxCartao.atualizarCartao(novoCartao.id,{nome:'Mudou',limite:900,diaVencimento:0}),null,'edição inválida é recusada inteira');
  t.igual(novoCartao.nome,nomeAntesCartao,'edição recusada não altera outro campo');
  ctxCartao.atualizarCartao(novoCartao.id,{nome:'Viagens',limite:900,diaFechamento:9,diaVencimento:18});
  t.valor(novoCartao.limite,900,'edição válida atualiza o limite');

  const removidoCartao=ctxCartao.removerCartao('b');
  t.igual(removidoCartao.destinoId,'a','referências migram para o primeiro cartão restante');
  t.igual(dadosCartao.faturas.length,2,'faturas iguais são fundidas sem duplicar o mês');
  const setembro=dadosCartao.faturas.find(f=>f.ano===2026&&f.mes===9);
  t.valor(setembro.valor,300,'valores explícitos das faturas são preservados na fusão');
  t.igual(setembro.gastos.length,2,'gastos detalhados das duas faturas são preservados');
  t.igual(setembro.pago,false,'uma fatura pendente mantém a fatura combinada pendente');
  t.igual(dadosCartao.faturas.find(f=>f.mes===10).cartaoId,'a','fatura sem colisão também é reatribuída');
  t.igual(dadosCartao.comprasPlanejadas[0].cartaoId,'a','compra planejada é reatribuída');
  t.igual(ctxCartao.removerCartao('inexistente'),null,'id inexistente não altera os dados');

  const ultimo=base();
  ultimo.faturas=[{id:'f',ano:2026,mes:9,valor:80,pago:false,cartaoId:'a',gastos:[]}];
  ultimo.comprasPlanejadas=[{id:'c',nome:'Compra',valor:80,cartao:true,parcelas:1,cartaoId:'a'}];
  const ctxUltimo=criarAmbiente(ultimo,HOJE);
  ctxUltimo.removerCartao('a');
  t.igual(ultimo.cartoes.length,0,'último cartão pode ser removido');
  t.igual(ultimo.faturas[0].cartaoId,null,'fatura do último cartão é preservada sem referência');
  t.igual(ultimo.comprasPlanejadas[0].cartaoId,null,'compra planejada também é preservada sem referência');

  console.log('\n\x1b[1mComandos de fatura mantêm cabeçalho e gastos coerentes\x1b[0m');
  const dadosFatura=base();
  const ctxFatura=criarAmbiente(dadosFatura,HOJE);
  t.igual(ctxFatura.salvarFatura({ano:1800,mes:9,valor:100,cartaoId:'a'}),null,'ano inválido é recusado');
  t.igual(ctxFatura.salvarFatura({ano:2026,mes:13,valor:100,cartaoId:'a'}),null,'mês inválido é recusado');
  t.igual(ctxFatura.salvarFatura({ano:2026,mes:9,valor:-1,cartaoId:'a'}),null,'valor negativo é recusado');
  t.igual(ctxFatura.salvarFatura({ano:2026,mes:9,valor:100,cartaoId:'ausente'}),null,'cartão inexistente é recusado');
  t.igual(dadosFatura.faturas.length,0,'faturas recusadas não deixam item parcial');
  const fatura=ctxFatura.salvarFatura({ano:2026,mes:9,valor:250,cartaoId:'a'});
  fatura.gastos=[
    {id:'g1',nome:'Mercado',valor:80,pago:false,parcelamentoId:'p'},
    {id:'g2',nome:'Farmácia',valor:40,pago:false},
  ];
  const mesmoId=fatura.id;
  const atualizada=ctxFatura.salvarFatura({ano:2026,mes:9,valor:0,cartaoId:'a'});
  t.igual(atualizada.id,mesmoId,'salvar o mesmo mês atualiza a fatura existente');
  t.valor(atualizada.valor,0,'valor explícito zero limpa a fatura');
  t.igual(atualizada.gastos.length,2,'atualizar o cabeçalho preserva os gastos detalhados');
  t.igual(dadosFatura.faturas.length,1,'atualização não cria fatura duplicada');
  t.igual(ctxFatura.atualizarValorFatura(fatura.id,-10),null,'valor inválido não altera fatura existente');
  t.valor(fatura.valor,0,'fatura conserva o valor anterior após recusa');
  ctxFatura.atualizarValorFatura(fatura.id,180);
  t.valor(fatura.valor,180,'valor válido é atualizado');
  ctxFatura.definirFaturaPaga(fatura.id,true);
  t.igual(fatura.pago,true,'quitar marca a fatura como paga');
  t.verdadeiro(fatura.gastos.every(g=>g.pago),'quitar marca todos os gastos da fatura na mesma operação');
  ctxFatura.definirFaturaPaga(fatura.id,false);
  t.igual(fatura.pago,false,'fatura pode ser reaberta');
  t.verdadeiro(fatura.gastos.every(g=>g.pago),'reabrir não desfaz pagamentos individuais já registrados');

  const nomeGastoAntes=fatura.gastos[0].nome;
  t.igual(ctxFatura.atualizarGastoFatura(fatura.id,'g1',{nome:'Mudou',valor:-1}),null,'edição inválida do gasto é recusada inteira');
  t.igual(fatura.gastos[0].nome,nomeGastoAntes,'recusa não altera o nome do gasto');
  ctxFatura.atualizarGastoFatura(fatura.id,'g1',{nome:'Feira',valor:75,pago:false});
  t.igual(fatura.gastos[0].nome,'Feira','gasto aceita edição válida');
  t.valor(fatura.gastos[0].valor,75,'valor do gasto é atualizado');
  t.igual(fatura.gastos[0].pago,false,'pagamento individual é atualizado');
  t.igual(ctxFatura.removerGastoFatura(fatura.id,'inexistente'),null,'gasto inexistente não altera a fatura');
  t.igual(ctxFatura.removerParcelamento('p'),1,'parcelamento informa quantas parcelas removeu');
  t.igual(fatura.gastos.length,1,'parcelas são removidas e outros gastos permanecem');
  t.igual(ctxFatura.removerFaturas(['inexistente']).length,0,'remoção inexistente não altera a lista');
  t.igual(ctxFatura.removerFaturas([fatura.id]).length,1,'remoção devolve a fatura afetada');
  t.igual(dadosFatura.faturas.length,0,'fatura escolhida é removida');

  console.log('\n\x1b[1mComandos de gastos fixos validam o conjunto inteiro\x1b[0m');
  const dadosFixo=base();
  const ctxFixo=criarAmbiente(dadosFixo,HOJE);
  const camposFixo={nome:'Aluguel',valor:1200,diaDoMes:10,categoria:'Casa',ativo:true,inicioAno:2026,inicioMes:9};
  t.igual(ctxFixo.criarGastoFixo({...camposFixo,valor:0}),null,'gasto fixo sem valor é recusado');
  t.igual(ctxFixo.criarGastoFixo({...camposFixo,diaDoMes:32}),null,'dia inválido é recusado');
  t.igual(ctxFixo.criarGastoFixo({...camposFixo,inicioMes:13}),null,'início inválido é recusado');
  t.igual(dadosFixo.gastosMensais.length,0,'criações recusadas não deixam gasto parcial');
  const fixo=ctxFixo.criarGastoFixo(camposFixo);
  t.igual(fixo.nome,'Aluguel','gasto fixo válido é criado');
  t.verdadeiro(Boolean(fixo.criadoEm),'data de criação é registrada');
  const criadoEm=fixo.criadoEm;
  t.igual(ctxFixo.atualizarGastoFixo(fixo.id,{nome:'Condomínio',valor:-1}),null,'edição inválida é recusada inteira');
  t.igual(fixo.nome,'Aluguel','recusa conserva os demais campos');
  ctxFixo.atualizarGastoFixo(fixo.id,{nome:'Moradia',valor:1300,ativo:false});
  t.igual(fixo.nome,'Moradia','edição parcial válida preserva e atualiza campos');
  t.valor(fixo.valor,1300,'valor do gasto fixo é atualizado');
  t.igual(fixo.ativo,false,'gasto fixo pode ser pausado');
  t.igual(fixo.criadoEm,criadoEm,'edição preserva a data de criação');
  const fixoRemovido=ctxFixo.removerGastoFixo(fixo.id);
  t.igual(dadosFixo.gastosMensais.length,0,'remoção tira o gasto fixo');
  ctxFixo.restaurarGastoFixo(fixoRemovido.item,fixoRemovido.indice);
  t.igual(dadosFixo.gastosMensais[0].id,fixo.id,'desfazer restaura o gasto na posição');

  console.log('\n\x1b[1mComandos de investimentos preservam dividendos e histórico\x1b[0m');
  const dadosInvest=base();
  const ctxInvest=criarAmbiente(dadosInvest,HOJE);
  const camposInvest={tipo:'acoes',nome:'Empresa',descricao:'Longo prazo',valorInvestido:1000,percentCdi:null,
    dividendos:[{id:'div1',data:'2026-09-01',valor:12.5}]};
  t.igual(ctxInvest.criarInvestimento({...camposInvest,tipo:'inexistente'}),null,'tipo de investimento inválido é recusado');
  t.igual(ctxInvest.criarInvestimento({...camposInvest,nome:''}),null,'investimento de mercado sem nome é recusado');
  t.igual(ctxInvest.criarInvestimento({...camposInvest,valorInvestido:-1}),null,'valor negativo é recusado');
  t.igual(dadosInvest.investimentos.length,0,'criações recusadas não deixam investimento parcial');
  const invest=ctxInvest.criarInvestimento(camposInvest);
  t.igual(invest.dividendos.length,1,'dividendos válidos nascem junto com o investimento');
  const criadoEmInvest=invest.criadoEm;
  t.igual(ctxInvest.atualizarInvestimento(invest.id,{nome:'Mudou',dividendos:[{id:'div2',data:'2026-09-02',valor:0}]}),null,'dividendo inválido recusa a edição inteira');
  t.igual(invest.nome,'Empresa','recusa conserva o nome existente');
  ctxInvest.atualizarInvestimento(invest.id,{nome:'Empresa B',valorInvestido:1200});
  t.igual(invest.nome,'Empresa B','edição parcial válida atualiza o nome');
  t.valor(invest.valorInvestido,1200,'edição parcial válida atualiza o valor');
  t.igual(invest.dividendos.length,1,'edição parcial preserva dividendos');
  t.igual(invest.criadoEm,criadoEmInvest,'edição preserva a data de criação');
  const investRemovido=ctxInvest.removerInvestimento(invest.id);
  t.igual(dadosInvest.investimentos.length,0,'remoção tira o investimento');
  ctxInvest.restaurarInvestimento(investRemovido.item,investRemovido.indice);
  t.igual(dadosInvest.investimentos[0].id,invest.id,'desfazer restaura o investimento na posição');

  console.log('\n\x1b[1mParcelamento fecha a soma\x1b[0m');
  [[100,3],[10,3],[0.05,3],[1234.56,7],[99.99,2]].forEach(([valor,n])=>{
    const dd=base();
    const c=criarAmbiente(dd,HOJE);
    c.lancarParcelamento('Teste',valor,n,2026,9,'Outros','a');
    const parcelas=dd.faturas.flatMap(f=>f.gastos).filter(g=>/Teste/.test(g.nome));
    const soma=parcelas.reduce((s,g)=>s+g.valor,0);
    t.valor(soma,valor,'R$ '+valor+' em '+n+'x soma exatamente R$ '+valor);
    t.igual(parcelas.length,n,'gera '+n+' parcelas');
    t.verdadeiro(parcelas.every(g=>Math.round(g.valor*100)===g.valor*100||Math.abs(g.valor*100-Math.round(g.valor*100))<1e-6),
      'parcelas de '+valor+' em '+n+'x têm no máximo 2 casas',parcelas.map(g=>g.valor).join(','));
  });

  console.log('\n\x1b[1mAporte automático de meta move dinheiro de verdade\x1b[0m');
  const dm=base();
  dm.metas=[{id:'m',nome:'Viagem',valorAlvo:1000,valorGuardado:400,aporteMensal:250,ultimoAporte:'2026-8'}];
  const cm=criarAmbiente(dm,HOJE);
  const patrimonioAntes=cm.patrimonioCalculado();
  const mudou=cm.aplicarAportesAutomaticos();
  t.verdadeiro(mudou,'o aporte do mês é aplicado quando o mês virou');
  t.valor(dm.saldoAtual,750,'o valor sai da conta');
  t.valor(dm.metas[0].valorGuardado,650,'e entra na meta');
  t.valor(cm.patrimonioCalculado(),patrimonioAntes,'patrimônio não cresce sozinho');
  t.verdadeiro(!cm.aplicarAportesAutomaticos(),'não aplica duas vezes no mesmo mês');

  /* teto: não passa do alvo */
  const dm2=base();
  dm2.metas=[{id:'m',nome:'Quase lá',valorAlvo:1000,valorGuardado:900,aporteMensal:250,ultimoAporte:'2026-8'}];
  const cm2=criarAmbiente(dm2,HOJE);
  cm2.aplicarAportesAutomaticos();
  t.valor(dm2.metas[0].valorGuardado,1000,'o aporte para no alvo da meta');
  t.valor(dm2.saldoAtual,900,'e só o que entrou de fato sai da conta (100, não 250)');

  console.log('\n\x1b[1mReserva de emergência: na conta ou guardada à parte\x1b[0m');
  {
    const naConta=base(); naConta.reservaGuardado=2000; naConta.reservaNaConta=true;
    const c1=criarAmbiente(naConta,HOJE);
    t.valor(c1.reservaContaNoPatrimonio(),0,'"na conta": não entra de novo no patrimônio');
    t.valor(c1.patrimonioCalculado(),1000,'patrimônio = só o saldo (a reserva já está dentro dele)');

    const fora=base(); fora.reservaGuardado=2000; fora.reservaNaConta=false;
    const c2=criarAmbiente(fora,HOJE);
    t.valor(c2.reservaContaNoPatrimonio(),2000,'"guardada à parte": entra somada');
    t.valor(c2.patrimonioCalculado(),3000,'patrimônio = saldo + reserva');

    /* quem já usava o app e nunca respondeu não pode ver o número mudar */
    const antigo=base(); antigo.reservaGuardado=2000; delete antigo.reservaNaConta;
    const c3=criarAmbiente(antigo,HOJE);
    t.valor(c3.patrimonioCalculado(),1000,'sem resposta ainda, vale "na conta" — patrimônio não muda sozinho');

    /* a reserva não interfere em quem guarda em metas */
    const misto=base(); misto.reservaGuardado=500; misto.reservaNaConta=false;
    misto.metas=[{id:'m',nome:'Viagem',valorAlvo:5000,valorGuardado:800,aporteMensal:0}];
    misto.dinheiroVivo=200;
    t.valor(criarAmbiente(misto,HOJE).patrimonioCalculado(),2500,
      'saldo 1000 + vivo 200 + meta 800 + reserva 500');
  }

  console.log('\n\x1b[1mMédia da fatura para a reserva de emergência\x1b[0m');
  const dr=base();
  dr.gastosMensais=[{id:'g',nome:'Aluguel',valor:1000,diaDoMes:10,ativo:true,categoria:'Casa'}];
  dr.cartoes=[{id:'a',nome:'A',limite:0},{id:'b',nome:'B',limite:0}];
  /* dois cartões por mês: a média tem que ser POR MÊS, não por fatura */
  dr.faturas=[
    {id:'1',mes:6,ano:2026,valor:100,pago:true,gastos:[],cartaoId:'a'},
    {id:'2',mes:6,ano:2026,valor:100,pago:true,gastos:[],cartaoId:'b'},
    {id:'3',mes:7,ano:2026,valor:200,pago:true,gastos:[],cartaoId:'a'},
    {id:'4',mes:7,ano:2026,valor:200,pago:true,gastos:[],cartaoId:'b'},
    {id:'5',mes:8,ano:2026,valor:300,pago:true,gastos:[],cartaoId:'a'},
    {id:'6',mes:8,ano:2026,valor:300,pago:true,gastos:[],cartaoId:'b'}];
  const cr=criarAmbiente(dr,HOJE);
  /* meses fechados: jun 200, jul 400, ago 600 → média 400; + aluguel 1000 */
  t.valor(cr.custoMensalEssencial(),1400,'média usa os 3 últimos MESES somando os cartões de cada um');
};
