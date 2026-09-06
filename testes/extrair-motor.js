/* Extrai as funções de cálculo de dentro do index.html.
   O app é um arquivo único empacotado: a página real vive como string JSON
   dentro de <script type="__bundler/template">. Aqui a gente desempacota,
   recorta as funções pelo nome (contando chaves) e devolve o código pra
   ser executado em cima de dados de teste. */
const fs=require('fs');
const path=require('path');
const BS=String.fromCharCode(92);

function lerAppInterno(arquivo){
  const bruto=fs.readFileSync(arquivo,'utf8');
  const linhas=bruto.split('\n');
  const i=linhas.findIndex(l=>l.trim().startsWith('"<!DOCTYPE html>'));
  if(i<0) throw new Error('não achei o template empacotado dentro de '+arquivo);
  return JSON.parse(linhas[i]);
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

module.exports={montarMotor,lerAppInterno,recortar,FUNCOES,
  CAMINHO_PADRAO:path.join(__dirname,'..','index.html')};
