/* Sonda de fuso horário: roda num processo à parte, com TZ forçado, e imprime
   em JSON o que as três validações de data respondem.

   Precisa ser um processo separado porque o fuso do Node se fixa na partida —
   não dá pra trocar no meio da suíte. Quem chama é datas.test.js.

   Uso:  TZ=Pacific/Kiritimati node testes/fuso-sonda.js 2026-12-01 */
const {criarAmbiente}=require('./ambiente');

const alvo=process.argv[2]||'2026-12-01';
const cenario={saldoAtual:0,dinheiroVivo:0,tipoRenda:'diaria',rendaDiaria:100,diasTrabalho:[1,2,3,4,5],
  rendaMensal:{valor:0,diaDoMes:5},idioma:'pt',dataAlvo:'2026-12-31',
  gastosMensais:[],cartoes:[],faturas:[],transacoes:[],entradasExtras:[],comprasPlanejadas:[],
  metas:[],rendasRecorrentes:[],investimentos:[],viagens:[],orcamentos:{},diasNaoTrabalhados:[]};

const ctx=criarAmbiente(cenario,'2026-09-05');
process.stdout.write(JSON.stringify({
  tz:process.env.TZ||null,
  offset:new Date().getTimezoneOffset(),
  diaCalendarioValido:ctx.diaCalendarioValido(alvo),
  dataPlanejadaValida:ctx.dataPlanejadaValida(alvo)||null,
  atualizarDataAlvo:ctx.atualizarDataAlvo(alvo),
  folgaAceita:ctx.adicionarDiaNaoTrabalhado(alvo),
  /* a data impossível tem que continuar sendo recusada em qualquer fuso */
  impossivel:ctx.diaCalendarioValido('2026-02-30'),
}));
