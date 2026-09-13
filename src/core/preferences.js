/* ── o palpite de quem está abrindo o app pela primeira vez ──────────────
   O idioma e a moeda nasciam fixos em português e real. Um italiano abria o
   app em português e só descobria a troca se lesse até o fim do primeiro
   diálogo — num idioma que ele não fala. Vale para quem começa hoje: ambos
   continuam no assistente de primeiro uso e nas Configurações, e o palpite
   nunca sobrepõe uma escolha já feita.

   As duas funções recebem a lista de idiomas em vez de ler o navigator, pra
   serem testáveis e pra não haver navigator nenhum do lado do teste. */
const IDIOMAS_SUPORTADOS=['pt','en','es','fr','it'];
/* a moeda sai da REGIÃO quando ela vem na etiqueta: pt-PT é euro, pt-BR é
   real, e adivinhar pelo idioma erraria um dos dois */
const MOEDA_POR_REGIAO={BR:'BRL',US:'USD',GB:'GBP',
  AT:'EUR',BE:'EUR',CY:'EUR',DE:'EUR',EE:'EUR',ES:'EUR',FI:'EUR',FR:'EUR',GR:'EUR',HR:'EUR',
  IE:'EUR',IT:'EUR',LT:'EUR',LU:'EUR',LV:'EUR',MT:'EUR',NL:'EUR',PT:'EUR',SI:'EUR',SK:'EUR'};
/* sem região utilizável, o idioma é o que sobra */
const MOEDA_POR_IDIOMA={pt:'BRL',en:'USD',es:'EUR',fr:'EUR',it:'EUR'};

function etiquetasDeIdioma(lista){
  return (Array.isArray(lista)?lista:[lista]).filter(x=>typeof x==='string'&&x);
}
function idiomaDoNavegador(lista){
  for(const etiqueta of etiquetasDeIdioma(lista)){
    const base=etiqueta.toLowerCase().split('-')[0];
    if(IDIOMAS_SUPORTADOS.includes(base)) return base;
  }
  return 'pt';
}
function moedaDoNavegador(lista){
  const etiquetas=etiquetasDeIdioma(lista);
  /* a primeira etiqueta com região conhecida ganha, mesmo que o idioma dela
     não seja um dos cinco: quem lê o app em inglês na Alemanha gasta euro */
  for(const etiqueta of etiquetas){
    const partes=etiqueta.split('-');
    const regiao=partes.length>1?partes[partes.length-1].toUpperCase():null;
    if(regiao&&MOEDA_POR_REGIAO[regiao]) return MOEDA_POR_REGIAO[regiao];
  }
  return MOEDA_POR_IDIOMA[idiomaDoNavegador(etiquetas)]||'BRL';
}
/* o que o navegador oferece, na ordem de preferência de quem configurou */
function etiquetasDoNavegador(){
  if(typeof navigator==='undefined') return [];
  return (navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language]).filter(Boolean);
}

/* ── preferências financeiras que afetam cálculos ── */
function definirIdioma(idioma){
  if(!IDIOMAS_SUPORTADOS.includes(idioma)) return null;
  data.idioma=idioma;
  return idioma;
}
function definirMoeda(moeda){
  if(!['BRL','USD','EUR','GBP'].includes(moeda)) return null;
  data.moeda=moeda;
  return moeda;
}
function definirTema(tema){
  if(!['onda','noite','sakura','matcha','poupa','grafite','roxo','custom'].includes(tema)) return null;
  data.tema=tema;
  return tema;
}
function definirPreferenciaBooleana(chave,valor){
  if(!['fundoIlustrado','temaAutoNoite','gastoDiario','iaAtiva','pierreAtivo','pierreTrazerSaldo','pierreTrazerLancamentos',
  'pierreTrazerCartao','pierreTrazerFixos','pierreBuscarAoAbrir',
  'pierreContasDefinidas'].includes(chave)||typeof valor!=='boolean') return null;
  data[chave]=valor;
  return valor;
}
function definirTipoRenda(tipo){
  if(tipo!=='diaria'&&tipo!=='mensal') return null;
  data.tipoRenda=tipo;
  return tipo;
}

function atualizarRendaDiaria(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)||valor<0) return null;
  data.rendaDiaria=valor;
  return valor;
}

function atualizarRendaMensal(valor,diaDoMes){
  valor=Number(valor); diaDoMes=Number(diaDoMes);
  if(!Number.isFinite(valor)||valor<0||!Number.isInteger(diaDoMes)||diaDoMes<1||diaDoMes>31) return null;
  data.rendaMensal={valor,diaDoMes};
  return data.rendaMensal;
}

function atualizarSaldoConta(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)) return null;
  data.saldoAtual=valor;
  data.saldoAtualizadoEm=new Date().toISOString();
  return valor;
}

function atualizarDinheiroVivo(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)) return null;
  data.dinheiroVivo=valor;
  data.dinheiroVivoAtualizadoEm=new Date().toISOString();
  return valor;
}

function configurarPerfilFinanceiro(entrada){
  entrada=entrada||{};
  const tipo=entrada.tipoRenda;
  const renda=Number(entrada.renda);
  const saldo=Number(entrada.saldoAtual);
  const diaDoMes=entrada.diaDoMes===undefined?(data.rendaMensal||{}).diaDoMes:Number(entrada.diaDoMes);
  if((tipo!=='diaria'&&tipo!=='mensal')||!Number.isFinite(renda)||renda<0||!Number.isFinite(saldo)||
    (tipo==='mensal'&&(!Number.isInteger(diaDoMes)||diaDoMes<1||diaDoMes>31))) return null;
  definirTipoRenda(tipo);
  if(tipo==='diaria') atualizarRendaDiaria(renda);
  else atualizarRendaMensal(renda,diaDoMes);
  atualizarSaldoConta(saldo);
  return {tipoRenda:tipo,renda,saldoAtual:saldo};
}

function atualizarDataAlvo(valor){
  const dataTeste=typeof valor==='string'?new Date(valor+'T12:00:00'):null;
  /* isoDate() e não toISOString(): ver diaCalendarioValido() em dates.js */
  if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor)||Number.isNaN(dataTeste.getTime())||isoDate(dataTeste)!==valor) return null;
  data.dataAlvo=valor;
  return valor;
}

function atualizarReserva(alteracoes){
  alteracoes=alteracoes||{};
  const proxima={
    reservaGuardado:Object.prototype.hasOwnProperty.call(alteracoes,'reservaGuardado')?Number(alteracoes.reservaGuardado):data.reservaGuardado,
    reservaMeses:Object.prototype.hasOwnProperty.call(alteracoes,'reservaMeses')?Number(alteracoes.reservaMeses):data.reservaMeses,
    reservaNaConta:Object.prototype.hasOwnProperty.call(alteracoes,'reservaNaConta')?alteracoes.reservaNaConta:data.reservaNaConta,
  };
  if(!Number.isFinite(proxima.reservaGuardado)||proxima.reservaGuardado<0||!Number.isInteger(proxima.reservaMeses)||proxima.reservaMeses<0||proxima.reservaMeses>120||typeof proxima.reservaNaConta!=='boolean') return null;
  Object.assign(data,proxima);
  return proxima;
}
