/* ── prazo de metas ── */
function metaDaysRemaining(dataAlvo){
  const target=new Date(dataAlvo+'T23:59:59');
  if(isNaN(target)) return null;
  return Math.ceil((target-today())/86400000);
}
function metaMonthsRemaining(dataAlvo){
  const days=metaDaysRemaining(dataAlvo);
  if(days===null) return null;
  if(days<=0) return 0;
  return Math.max(1,Math.ceil(days/30));
}

/* ─── data target ─── */

/* 31 de dezembro é uma data-alvo boa porque todo mundo entende "até o fim do
   ano" — menos em novembro e dezembro, quando ela deixa de ser uma previsão.
   Quem instalava o app em 20 de dezembro abria numa previsão de onze dias, e
   em 31 de dezembro numa de zero: o número grande do hero virava o saldo de
   hoje e a premissa do app ("isto é uma previsão") não se sustentava logo na
   primeira tela. Com menos de um trimestre pela frente, o alvo passa a ser o
   dezembro seguinte — continua sendo "o fim do ano", só que o próximo. */
function defaultTargetValue(){
  const HORIZONTE_MINIMO_DIAS=90;   // um trimestre: o menor prazo em que a projeção ainda diz algo
  const t=today();
  const diasAteODezembroDesteAno=Math.round((new Date(t.getFullYear(),11,31)-t)/86400000);
  const ano=diasAteODezembroDesteAno>=HORIZONTE_MINIMO_DIAS?t.getFullYear():t.getFullYear()+1;
  return `${ano}-12-31`;
}
function getTargetDate(){
  if(data&&data.dataAlvo){ const d=new Date(data.dataAlvo+'T23:59:59'); if(!isNaN(d)) return d; }
  const t=today(); return new Date(t.getFullYear(),11,31,23,59,59);
}

function definirDiasTrabalho(dias){
  if(!Array.isArray(dias)) return null;
  const unicos=[...new Set(dias)];
  if(unicos.some(dia=>!Number.isInteger(dia)||dia<0||dia>6)) return null;
  data.diasTrabalho=unicos.sort((a,b)=>a-b);
  return data.diasTrabalho;
}
/* A volta pelo texto confere que a data EXISTE: "2026-02-30" vira 2 de março
   e deixa de bater com o que foi digitado. A comparação tem que ser com
   isoDate(), que lê o dia no fuso local — toISOString() lê em UTC e, em
   UTC+13/+14 (Nova Zelândia no horário de verão, Kiribati), devolvia o dia
   anterior e recusava toda data boa. Ver o aviso em money.js. */
function diaCalendarioValido(valor){
  if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const dataTeste=new Date(valor+'T12:00:00');
  return !isNaN(dataTeste)&&isoDate(dataTeste)===valor;
}
function adicionarDiaNaoTrabalhado(valor){
  if(!diaCalendarioValido(valor)) return false;
  if(!data.diasNaoTrabalhados) data.diasNaoTrabalhados=[];
  if(data.diasNaoTrabalhados.includes(valor)) return false;
  data.diasNaoTrabalhados.push(valor);
  return true;
}
function diasDePeriodo(inicio,fim){
  if(!diaCalendarioValido(inicio)||!diaCalendarioValido(fim)||inicio>fim) return [];
  const dia=new Date(inicio+'T12:00:00'),ultimo=new Date(fim+'T12:00:00');
  if((ultimo-dia)/86400000>366) return [];
  const dias=[];
  while(dia<=ultimo){dias.push(isoDate(dia));dia.setDate(dia.getDate()+1);}
  return dias;
}
function removerDiaNaoTrabalhado(valor){
  if(!data.diasNaoTrabalhados||!data.diasNaoTrabalhados.includes(valor)) return false;
  data.diasNaoTrabalhados=data.diasNaoTrabalhados.filter(dia=>dia!==valor);
  return true;
}

/* ─── work day calculations ─── */

function daysBetweenInclusive(start,end,weekdaySet,skipSet=new Set()){
  if(start>end) return 0;
  let count=0, d=new Date(start);
  while(d<=end){
    if(weekdaySet.has(d.getDay())&&!skipSet.has(isoDate(d))) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

function remainingWorkDaysUntil(diasTrabalho,target){
  const t=today();
  if(t>target) return 0;
  const skip=new Set(data.diasNaoTrabalhados||[]);
  return daysBetweenInclusive(t,target,new Set(diasTrabalho),skip);
}

function remainingInternetCountUntil(diaDoMes,target){
  const t=today(); let count=0, year=t.getFullYear(), month=t.getMonth();
  for(let i=0;i<72;i++){
    const d=dataNoMes(year,month+1,diaDoMes);
    if(d>target) break;
    if(d>t) count++;
    month++; if(month>11){month=0;year++;}
  }
  return count;
}

function monthMetrics(fatura){
  const {ano,mes}=fatura;
  const monthStart=new Date(ano,mes-1,1), monthEnd=new Date(ano,mes,0);
  const t=today();
  const effStart=t>monthStart?t:monthStart;

  let renda=0;
  if(data.tipoRenda==='diaria'){
    let workCount=0;
    if(effStart<=monthEnd){
      const skip=new Set(data.diasNaoTrabalhados||[]);
      workCount=daysBetweenInclusive(effStart,monthEnd,new Set(data.diasTrabalho),skip);
    }
    renda=workCount*data.rendaDiaria;
  }else if(data.tipoRenda==='mensal'){
    const rmDate=dataNoMes(ano,mes,data.rendaMensal.diaDoMes);
    renda=rmDate>t?data.rendaMensal.valor:0;
  }
  if(effStart<=monthEnd){
    // mês corrente: só o que ainda vai cair (d>hoje); meses futuros: todas as ocorrências
    const iniRR=t>monthStart?t:new Date(ano,mes-1,0);
    renda+=rendasRecorrentesEntre(iniRR,monthEnd);
  }

  const faturaCusto=fatura.pago?0:fatura.valor;
  const gastosCusto=(fatura.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
  const gastosMensaisDetalhe=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,ano,mes)).map(g=>{
    const d=dataNoMes(ano,mes,g.diaDoMes);
    /* custo aqui é o que ainda FALTA sair: zero depois do dia, zero se foi
       paga antes dele. Quem decide é gastoFixoPendenteEm(), a mesma função
       que o aviso e a caixinha consultam. */
    const pendente=gastoFixoPendenteEm(g,ano,mes);
    /* `valor` é a conta cheia e `custo` é o que ainda falta sair. Quem desenha
       precisa dos dois: com só o custo, uma conta já paga aparecia como
       "R$ 0,00" — que se lê como "essa conta é zero", não como "já paguei". */
    return {nome:g.nome,valor:g.valor,custo:pendente?g.valor:0,pago:!pendente};
  });
  const gastosMensaisCusto=gastosMensaisDetalhe.reduce((s,g)=>s+g.custo,0);
  const despesas=faturaCusto+gastosCusto+gastosMensaisCusto;
  const saldoMes=renda-despesas;
  const isPast=monthEnd<t;
  const isAtual=ano===t.getFullYear()&&mes===t.getMonth()+1;
  return {renda,gastosCusto,gastosMensaisDetalhe,gastosMensaisCusto,despesas,saldoMes,isPast,isAtual};
}

/* ── dias úteis e feriados nacionais ──────────────────────────────────────

   O vencimento do DARF é o último dia útil do mês seguinte ao recebimento, e
   "útil" aqui não é só "não é fim de semana": banco fechado em feriado empurra
   o prazo. Sem isto o app diria 31/12 — que nunca é dia útil — e mandaria a
   pessoa pagar com multa.

   A tabela é LOCAL, calculada, sem rede. O app funciona offline e pedir
   feriado a um servidor para saber o vencimento seria trocar uma conta certa
   por uma dependência que falha no avião. Carnaval, Sexta-feira Santa e Corpus
   Christi saem da Páscoa, que sai do algoritmo de Gauss.

   O que NÃO cobre: feriado estadual e municipal, e ponto facultativo. Nenhum
   dos dois é calculável sem saber onde a pessoa está, e errar para o lado de
   "é dia útil" é o lado seguro — o prazo aparece mais curto, não mais longo. */

/* Domingo de Páscoa pelo algoritmo de Gauss, no calendário gregoriano. */
function domingoDePascoa(ano){
  const a=ano%19, b=Math.floor(ano/100), c=ano%100;
  const d=Math.floor(b/4), e=b%4, f=Math.floor((b+8)/25);
  const g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7;
  const m=Math.floor((a+11*h+22*l)/451);
  const mes=Math.floor((h+l-7*m+114)/31);
  const dia=((h+l-7*m+114)%31)+1;
  return new Date(ano,mes-1,dia);
}

function _somaDias(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

/* Os feriados nacionais do ano, como ISO. Set para a consulta ser direta. */
function feriadosNacionais(ano){
  const pascoa=domingoDePascoa(ano);
  const fixos=[[1,1],[4,21],[5,1],[9,7],[10,12],[11,2],[11,15],[11,20],[12,25]];
  const dias=fixos.map(([m,d])=>isoDate(new Date(ano,m-1,d)));
  /* móveis: Carnaval (-48 e -47), Sexta-feira Santa (-2), Corpus Christi (+60) */
  [-48,-47,-2,60].forEach(n=>{ dias.push(isoDate(_somaDias(pascoa,n))); });
  return new Set(dias);
}

function ehDiaUtil(d,feriados){
  const dia=d.getDay();
  if(dia===0||dia===6) return false;
  const lista=feriados||feriadosNacionais(d.getFullYear());
  return !lista.has(isoDate(d));
}

/* O último dia útil do mês: anda para trás do último dia até achar um. */
function ultimoDiaUtilDoMes(ano,mes){ // mes: 1-12
  const feriados=feriadosNacionais(ano);
  const d=new Date(ano,mes,0);
  /* 31 dias é folga de sobra: não existe mês inteiro de feriado */
  for(let i=0;i<31;i++){
    if(ehDiaUtil(d,feriados)) return d;
    d.setDate(d.getDate()-1);
  }
  return new Date(ano,mes,0);
}

/* O vencimento do DARF de um recebimento: último dia útil do mês SEGUINTE.
   Dezembro vence em janeiro do ano que vem, e aí os feriados são os do ano
   novo — por isso a virada passa pelo ano, e não só pelo mês. */
function ultimoDiaUtilDoMesSeguinte(ano,mes){ // mes: 1-12
  const proximo=mes===12?{ano:ano+1,mes:1}:{ano,mes:mes+1};
  return ultimoDiaUtilDoMes(proximo.ano,proximo.mes);
}
