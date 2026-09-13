/* Extrai as funções de cálculo de dentro do HTML publicado.
   O alvo é dist/index.html, gerado por scripts/build.js a partir de src/.
   Aqui a gente lê o documento, recorta as funções pelo nome (contando chaves)
   e devolve o código pra ser executado em cima de dados de teste.

   Os testes rodam contra o ARQUIVO PUBLICADO de propósito: é ele que chega no
   navegador. Se o build quebrar a concatenação, a suíte percebe. */
const fs=require('fs');
const path=require('path');
const BS=String.fromCharCode(92);

/* Até o commit 6556d20 o app era empacotado: a página real vinha como string
   JSON dentro de <script type="__bundler/template">. Aceita os dois formatos
   pra dar pra rodar a mesma suíte contra uma versão antiga e comparar. */
function lerAppInterno(arquivo){
  const bruto=fs.readFileSync(arquivo,'utf8');
  const linhas=bruto.split('\n');
  const i=linhas.findIndex(l=>l.trim().startsWith('"<!DOCTYPE html>'));
  return i<0 ? bruto : JSON.parse(linhas[i]);
}
function estaEmpacotado(arquivo){
  return fs.readFileSync(arquivo,'utf8').split('\n')
    .some(l=>l.trim().startsWith('"<!DOCTYPE html>'));
}

/* onde a função começa, seja ela `function x(` ou `async function x(` */
function inicioDaFuncao(src,nome,de){
  const a=src.indexOf('\nfunction '+nome+'(',de||0);
  const b=src.indexOf('\nasync function '+nome+'(',de||0);
  if(a<0) return b;
  if(b<0) return a;
  return Math.min(a,b);
}

function recortar(src,nome){
  const i=inicioDaFuncao(src,nome);
  if(i<0) throw new Error('função não encontrada: '+nome);
  let k=src.indexOf('{',i), profundidade=0, str=null;
  for(;k<src.length;k++){
    const c=src[k], anterior=src[k-1];
    if(str){ if(c===str&&anterior!==BS) str=null; continue; }
    if(c==='"'||c==="'"||c==='`'){ str=c; continue; }
    if(c==='{') profundidade++;
    else if(c==='}'){ profundidade--; if(profundidade===0){ k++; break; } }
  }
  return src.slice(i+1,k)+'\n';
}

/* Recorta um trecho inteiro, do começo de `marcaInicio` até o fim da função
   `ateFimDe`. Serve pra módulos que são mais const do que função — o esquema de
   validação, por exemplo, onde recortar nome por nome daria uma lista enorme e
   frágil. */
function recortarBloco(src,marcaInicio,ateFimDe){
  const i=src.indexOf(marcaInicio);
  if(i<0) throw new Error('não achei o início do bloco: '+marcaInicio);
  const j=inicioDaFuncao(src,ateFimDe,i);
  if(j<0) throw new Error('não achei o fim do bloco: '+ateFimDe);
  const corpo=recortar(src.slice(j),ateFimDe);
  return src.slice(i,j)+'\n'+corpo;
}

/* blocos inteiros: [marca de início, função que fecha o bloco] */
const BLOCOS=[
  ['const SCHEMA_VERSAO','validateAndNormalizeData'], // data/schema.js + data/validation.js
  ['const IDIOMAS_SUPORTADOS','etiquetasDoNavegador'], // core/preferences.js: as tabelas de idioma/moeda e quem lê
  ['const LISTAS_PLANEJADAS','listaPlanejada'], // core/planned.js: o const e a busca
  ['const CRIPTO_FORMATO','decifrarDaNuvem'],     // storage/encryption.js
  ['const sync = {','migrarParaCifrado'],         // storage/sync-ciclo.js
];

/* `const` no topo de um script vive no escopo léxico do contexto, não vira
   propriedade dele — então o teste não enxerga. Estas são copiadas na mão. */
const EXPORTAR=['SCHEMA_VERSAO','LIMITES','ESQUEMA','CRIPTO_VOLTAS','CRIPTO_FORMATO','sync'];

/* funções puras de cálculo — a parte do app que os testes cobrem */
const FUNCOES=[
  'parseNum','parseNumOpcional','localeAtual','formatadorDeMoeda','formatBRL','formatValorSemMoeda','startOfDay','today','isoDate','dataNoMes','metaDaysRemaining','metaMonthsRemaining',
  'definirIdioma','definirMoeda','definirTema','definirPreferenciaBooleana','definirTipoRenda','atualizarRendaDiaria','atualizarRendaMensal','atualizarSaldoConta','atualizarDinheiroVivo','configurarPerfilFinanceiro','atualizarDataAlvo','atualizarReserva',
  'adicionarCategoria','removerCategoria','emojiDeCategoriaValido','definirEmojiDeCategoria',
  'categoriaEhPadrao','renomearCategoria','criarViagem','removerViagem',
  'defaultTargetValue','getTargetDate','definirDiasTrabalho','diaCalendarioValido','adicionarDiaNaoTrabalhado','removerDiaNaoTrabalhado','daysBetweenInclusive','remainingWorkDaysUntil',
  'remainingInternetCountUntil','monthMetrics','faturasPorMes','mesMetrics','camposFatura','salvarFatura','atualizarValorFatura',
  'definirFaturaPaga','removerFaturas','atualizarGastoFatura','removerGastoFatura','removerParcelamento','chaveMes','restanteEntrada','restanteDivida','fatiasAosPoucos',
  'transacoesGasto','buildTimeline','_buildTimeline','saldoPrevistoEm',
  'computeTotals','computeCartao','camposCartao','criarCartao','atualizarCartao','removerCartao','nextMonth','ensureFatura','lancarParcelamento','gastoDaViagem',
  'dataPlanejadaValida','camposPlanejados','criarPlanejado','atualizarPlanejado','removerPlanejado','restaurarPlanejado','registrarRecebimentoEntrada','registrarPagamentoDivida','definirPlanejadoFeito',
  'aplicarEfeitoTransacao','registrarMovimento','registrarTransacao','registrarReceita','repetirUltimoGasto',
  'dataAlvoMetaValida','moverSaldoParaMeta','criarMeta','atualizarMeta','removerMeta','restaurarMeta',
  'atualizarTransacao','removerTransacao','restaurarTransacao','gastoFixoAtivoEm',
  'gastoFixoPagoEm','gastoFixoPendenteEm','definirGastoFixoPago','camposGastoFixo','criarGastoFixo','atualizarGastoFixo','removerGastoFixo','restaurarGastoFixo',
  'rendasRecorrentesAtivas','rendasRecorrentesEntre','camposRendaRecorrente','criarRendaRecorrente','atualizarRendaRecorrente',
  'removerRendaRecorrente','restaurarRendaRecorrente','computeCategoryBreakdown','vencimentoDaFatura','computeCategoryDetalhe','computeCategoryPrevMonth',
  'computeGastoMesPorCategoria','definirOrcamento','computeMonthSpend','computeWeekSummary','computeDailyBudget',
  'temDadoParaSaude','computeSaudeFinanceira',
  'getTrajectoryPoints','suggestPurchaseTiming','sobraMensalMedia','rendaMediaMensal','taxaAnualDisponivel','atualizarTaxasManuais','jurosProjetados',
  'custoMensalEssencial','reservaContaNoPatrimonio','patrimonioCalculado',
  'TIPOS_INVEST','tipoInvest','camposInvestimento','criarInvestimento','atualizarInvestimento','removerInvestimento','restaurarInvestimento',
  'aplicarAportesAutomaticos','computeReceitasMesDetalhe',
  'semAcento','categoriaDoPierre','ehEntradaNoPierre','ehDeCartao','transacaoDoPierre',
  'saldoDoPierre','planoDeSincronizacaoPierre','aplicarSincronizacaoPierre',
  'numeroDoPierre','contaEhBanco','nomeDaContaPierre','aindaNaoCaiu',
  'diaDoIso','anoMesDoIso','contaEhCartao','cartaoDoPierre','parcelasAbertasDoPierre',
  'planoDoCartaoPierre','aplicarCartaoPierre','sugerirGastosFixosPierre',
  'aplicarGastosFixosPierre','assinaturaDoGasto','ehParcelaDoPierre',
  'cartaoDaCompraParcelada','pagamentosDeFaturaPierre','pagamentoConfere',
  'novasAindaInexistentes','registrarImportacaoPierre',
  'resumoDaUltimaImportacaoPierre','desfazerImportacaoPierre',
  'uid','defaultData','migrateData','adotarDadosDeFora',
  'getSyncCode','setSyncCode','sufixoDeHomologacao','emHomologacao','chamarRpc','nuvemLer','nuvemGravar',
  'empurrarParaNuvem','conteudoFinanceiroParaConflito','consultarSincronizacao','chaveSenhaDispensada','senhaFoiDispensada','marcarSenhaDispensada','limparSenhaDispensada','computeInsights','invalidarTimeline',
  'avaliarExpressao','calcAceita',
  'taxaEntre','converterMoeda','moedasDaTabela','tabelaDeCambioValida'
];

function montarMotor(arquivo){
  const src=lerAppInterno(arquivo);
  const meses=/const MONTH_NAMES\s*=\s*\[[^\]]*\]/.exec(src);
  const abrev=/const MONTH_ABBR\s*=\s*\[[^\]]*\]/.exec(src);
  const cats=/const CATEGORIAS_DEFAULT\s*=\s*\[[^\]]*\]/.exec(src);
  const tiposRenda=/const TIPOS_RENDA\s*=\s*\[[\s\S]*?\n\];/.exec(src);
  /* os símbolos de moeda: formatBRL() os consulta antes de cair no Intl */
  const moedas=/const CURRENCY_INFO\s*=\s*\{[\s\S]*?\n\};/.exec(src);
  /* o De-Para das categorias do Pierre: categoriaDoPierre() consulta */
  const catsPierre=/const PIERRE_CATEGORIAS\s*=\s*\{[\s\S]*?\n\};/.exec(src);
  /* o que NAO e gasto fixo: sugerirGastosFixosPierre() consulta */
  const naoEhFixo=/const PIERRE_NAO_EH_FIXO\s*=\s*\/[^\n]*\/;/.exec(src);
  let codigo=(meses?meses[0]+';\n':'')+(abrev?abrev[0]+';\n':'')+(cats?cats[0]+';\n':'')+
    (tiposRenda?tiposRenda[0]+'\n':'')+(moedas?moedas[0]+'\n':'')+
    (catsPierre?catsPierre[0]+'\n':'')+(naoEhFixo?naoEhFixo[0]+'\n':'');
  /* Endereço FALSO de propósito. O transporte precisa dessas constantes pra
     existir, mas nenhum teste pode encostar no projeto real nem por acidente —
     com um host inválido, um fetch que escapasse do dublê falha na hora em vez
     de bater na produção. */
  codigo+="const SUPABASE_URL='https://projeto-de-teste.invalido';\n";
  codigo+="const SUPABASE_ANON_KEY='chave-de-teste-sem-valor';\n";
  codigo+='let _tlMemo=new Map();\n';
  /* o cache do formatador de moeda, como o _tlMemo acima: mora no topo do
     módulo e não vem junto com a função quando ela é recortada */
  codigo+='let _fmtMoeda=null, _fmtMoedaChave="";\n';
  BLOCOS.forEach(([ini,fim])=>{ codigo+=recortarBloco(src,ini,fim)+'\n'; });
  FUNCOES.forEach(n=>{
    if(n==='invalidarTimeline'){ codigo+='function invalidarTimeline(){ _tlMemo.clear(); }\n'; return; }
    codigo+=recortar(src,n)+'\n';
  });
  EXPORTAR.forEach(n=>{ codigo+='try{ globalThis.'+n+'='+n+'; }catch(e){}\n'; });
  return codigo;
}

module.exports={montarMotor,lerAppInterno,estaEmpacotado,recortar,FUNCOES,
  CAMINHO_PADRAO:path.join(__dirname,'..','dist','index.html')};
