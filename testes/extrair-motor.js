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

function recortar(src,nome){
  const i=src.indexOf('\nfunction '+nome+'(');
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

/* funções puras de cálculo — a parte do app que os testes cobrem */
const FUNCOES=[
  'parseNum','startOfDay','today','isoDate','dataNoMes','metaDaysRemaining','metaMonthsRemaining',
  'defaultTargetValue','getTargetDate','daysBetweenInclusive','remainingWorkDaysUntil',
  'remainingInternetCountUntil','monthMetrics','faturasPorMes','mesMetrics','chaveMes','restanteEntrada','fatiasAosPoucos',
  'transacoesGasto','buildTimeline','_buildTimeline','saldoPrevistoEm',
  'computeTotals','computeCartao','nextMonth','ensureFatura','lancarParcelamento',
  'registrarTransacao','registrarReceita','removerTransacao','gastoFixoAtivoEm',
  'rendasRecorrentesAtivas','rendasRecorrentesEntre','computeCategoryBreakdown',
  'computeGastoMesPorCategoria','computeMonthSpend','computeWeekSummary','computeDailyBudget',
  'getTrajectoryPoints','suggestPurchaseTiming','sobraMensalMedia','rendaMediaMensal',
  'custoMensalEssencial','reservaContaNoPatrimonio','patrimonioCalculado',
  'aplicarAportesAutomaticos','computeReceitasMesDetalhe',
  'computeInsights','invalidarTimeline'
];

function montarMotor(arquivo){
  const src=lerAppInterno(arquivo);
  const meses=/const MONTH_NAMES\s*=\s*\[[^\]]*\]/.exec(src);
  const abrev=/const MONTH_ABBR\s*=\s*\[[^\]]*\]/.exec(src);
  const cats=/const CATEGORIAS_DEFAULT\s*=\s*\[[^\]]*\]/.exec(src);
  let codigo=(meses?meses[0]+';\n':'')+(abrev?abrev[0]+';\n':'')+(cats?cats[0]+';\n':'');
  codigo+='let _tlMemo=new Map();\n';
  FUNCOES.forEach(n=>{
    if(n==='invalidarTimeline'){ codigo+='function invalidarTimeline(){ _tlMemo.clear(); }\n'; return; }
    codigo+=recortar(src,n)+'\n';
  });
  return codigo;
}

module.exports={montarMotor,lerAppInterno,estaEmpacotado,recortar,FUNCOES,
  CAMINHO_PADRAO:path.join(__dirname,'..','dist','index.html')};
