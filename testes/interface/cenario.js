/* ── O cenário que a suíte de interface usa ───────────────────────────────

   Um app já configurado e com história: dois cartões, contas fixas, faturas
   com compras parceladas, metas, dívidas, viagem, investimento e lançamentos
   espalhados pelo mês. É propositalmente desconfortável — nome de cartão
   comprido, nome de gasto comprido, valores de quatro dígitos — porque é onde
   a interface quebra. Foi um nome de cartão comprido que escondeu o campo de
   valor da fatura por trás da etiqueta.

   É um texto de JavaScript, não um objeto: roda dentro da página, pelo CDP,
   escrevendo direto no localStorage antes de o app abrir. */
const CENARIO = `
  const d = {
    schemaVersion:1, saldoAtual:12345.67, dinheiroVivo:230.5,
    saldoAtualizadoEm:new Date().toISOString(), dinheiroVivoAtualizadoEm:new Date().toISOString(),
    dataAlvo:'2027-12-31', tipoRenda:'mensal', rendaDiaria:0, diasTrabalho:[1,2,3,4,5],
    rendaMensal:{valor:8750.4,diaDoMes:5},
    categorias:['Mercado','Transporte','Lazer','Saúde','Casa','Outros','Assinaturas e serviços digitais'],
    cartoes:[
      {id:'c1',nome:'Nubank Ultravioleta Mastercard Black',limite:35000,diaFechamento:28,diaVencimento:5},
      {id:'c2',nome:'Itaú',limite:8000,diaFechamento:10,diaVencimento:17}],
    gastosMensais:[
      {id:'g1',nome:'Aluguel do apartamento na Vila Madalena',valor:4200,diaDoMes:5,ativo:true,categoria:'Casa',pagoEm:[],cartao:false,cartaoId:null,inicioAno:null,inicioMes:null},
      {id:'g2',nome:'Internet',valor:129.9,diaDoMes:12,ativo:true,categoria:'Casa',pagoEm:[],cartao:false,cartaoId:null,inicioAno:null,inicioMes:null},
      {id:'g3',nome:'Streaming',valor:55.9,diaDoMes:20,ativo:true,categoria:'Assinaturas e serviços digitais',pagoEm:[],cartao:true,cartaoId:'c1',inicioAno:null,inicioMes:null}],
    transacoes:Array.from({length:24},(_,i)=>({
      id:'t'+i, nome: i%4===0 ? 'Jantar de aniversário no restaurante japonês' : 'Compra '+i,
      valor: i%5===0 ? 1899.99 : 37.5+i, categoria:['Mercado','Lazer','Outros','Saúde'][i%4],
      metodo:['pix','debito','dinheiro'][i%3],
      data:new Date(Date.now()-i*86400000).toISOString().slice(0,10),
      tags: i%6===0 ? ['reembolsável','trabalho'] : undefined,
      nota: i%7===0 ? 'Uma observação razoavelmente longa sobre este gasto' : undefined})),
    faturas:[
      {id:'f1',ano:2026,mes:9,valor:0,pago:false,cartaoId:'c1',gastos:[
        {id:'fg1',nome:'Notebook Dell XPS 15 polegadas (1/10)',valor:1250,pago:false,categoria:'Outros',parcelamentoId:'p1',dataCompra:'2026-09-02'},
        {id:'fg2',nome:'Mercado',valor:430.2,pago:false,categoria:'Mercado'}]},
      {id:'f2',ano:2026,mes:10,valor:0,pago:false,cartaoId:'c1',gastos:[
        {id:'fg3',nome:'Notebook Dell XPS 15 polegadas (2/10)',valor:1250,pago:false,categoria:'Outros',parcelamentoId:'p1'}]}],
    entradasExtras:[{id:'e1',nome:'Reembolso da viagem a trabalho para São Paulo',valor:1780,modo:'unica',feito:false,recebido:0,nota:''}],
    dividas:[{id:'dv1',nome:'Bicicleta',credor:'João',valor:2400,pago:600,modo:'aosPoucos',dataPrevista:'2027-03-01',quitado:false,nota:''}],
    comprasPlanejadas:[{id:'cp1',nome:'Cadeira ergonômica Herman Miller Aeron',valor:9800,parcelas:12,cartao:true,cartaoId:'c1',feito:false}],
    metas:[{id:'m1',nome:'Viagem para o Japão em 2027',valorAlvo:28000,valorGuardado:9400,aporteMensal:1200,dataAlvo:'2027-10-01'}],
    investimentos:[{id:'i1',nome:'HGLG11',tipo:'fii',valorInvestido:15200,descricao:'fundo de galpões logísticos',dividendos:[{id:'dd1',data:'2026-08-15',valor:118.4}]}],
    viagens:[{id:'v1',nome:'Japão 2027',orcamento:25000}],
    orcamentos:{Mercado:1500,Lazer:600},
    rendasRecorrentes:[{id:'r1',nome:'Salário · TechBrasil',valor:8750.4,diaDoMes:5,ativo:true,tipo:'salario'}],
    patrimonioHistorico:[], diasNaoTrabalhados:[], limiteCartao:0, diaVencimentoFatura:10,
    taxasManuais:{cdi:null,selic:null,atualizadoEm:null},
    fundoIlustrado:false, gastoDiario:true, reservaGuardado:5000, reservaMeses:3, reservaNaConta:true,
    tema:'onda', moeda:'BRL', onboardingCompleto:true, tourCompleto:true, idioma:'pt',
  };
  localStorage.setItem('financas-data', JSON.stringify(d));
  return 1;
`;

/* ── Um app modesto ───────────────────────────────────────────────────────

   Renda de 5.000, um cartão, poucas contas. Serve pra medir fluxo — lançar um
   gasto, marcar uma conta paga — sem o barulho do cenário grande. */
const SIMPLES = `
  const d={schemaVersion:1,saldoAtual:2000,dinheiroVivo:100,
    saldoAtualizadoEm:new Date().toISOString(),dinheiroVivoAtualizadoEm:new Date().toISOString(),
    dataAlvo:'2027-12-31',tipoRenda:'mensal',rendaDiaria:0,diasTrabalho:[1,2,3,4,5],
    rendaMensal:{valor:5000,diaDoMes:5},categorias:['Mercado','Transporte','Lazer','Saúde','Casa','Outros'],
    cartoes:[{id:'c1',nome:'Cartão',limite:5000,diaFechamento:20,diaVencimento:28}],
    gastosMensais:[],transacoes:[],faturas:[],entradasExtras:[],dividas:[],comprasPlanejadas:[],
    metas:[],investimentos:[],viagens:[],orcamentos:{},rendasRecorrentes:[],patrimonioHistorico:[],
    diasNaoTrabalhados:[],limiteCartao:0,diaVencimentoFatura:10,
    taxasManuais:{cdi:null,selic:null,atualizadoEm:null},fundoIlustrado:false,gastoDiario:true,
    reservaGuardado:0,reservaMeses:3,reservaNaConta:true,tema:'onda',moeda:'BRL',
    onboardingCompleto:true,tourCompleto:true,idioma:'pt'};
  localStorage.setItem('financas-data',JSON.stringify(d)); return 1;
`;

module.exports = { CENARIO, SIMPLES };
