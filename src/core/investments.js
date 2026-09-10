/* ── tipos de investimento ── */
function TIPOS_INVEST(){
  const L2={pt:{acoes:'Ações',fundos:'Fundos',cripto:'Cripto'},en:{acoes:'Stocks',fundos:'Funds',cripto:'Crypto'},es:{acoes:'Acciones',fundos:'Fondos',cripto:'Cripto'},fr:{acoes:'Actions',fundos:'Fonds',cripto:'Crypto'},it:{acoes:'Azioni',fundos:'Fondi',cripto:'Cripto'}}[data.idioma||'pt'];
  return [
    {id:'cdi',label:'CDI',icon:'🏦',conservador:true},
    {id:'selic',label:'Selic',icon:'🏛️',conservador:true},
    {id:'cdb',label:'CDB',icon:'💰',conservador:true},
    {id:'acoes',label:L2.acoes,icon:'📈',conservador:false},
    {id:'fundos',label:L2.fundos,icon:'🧺',conservador:false},
    {id:'fiis',label:'FIIs',icon:'🏢',conservador:false},
    {id:'cripto',label:L2.cripto,icon:'🪙',conservador:false},
    {id:'bdrs',label:'BDRs',icon:'🌎',conservador:false},
  ];
}
function tipoInvest(id){ return TIPOS_INVEST().find(t=>t.id===id)||TIPOS_INVEST()[0]; }

/* ── comandos de investimentos ── */
function camposInvestimento(entrada,atual){
  entrada=entrada||{}; atual=atual||{};
  const ler=campo=>Object.prototype.hasOwnProperty.call(entrada,campo)?entrada[campo]:atual[campo];
  const tipo=ler('tipo');
  const info=TIPOS_INVEST().find(t=>t.id===tipo);
  const nome=String(ler('nome')||'').trim();
  const descricao=String(ler('descricao')||'').trim();
  const valorInvestido=Number(ler('valorInvestido'));
  const brutoCdi=ler('percentCdi');
  const percentCdi=brutoCdi===null||brutoCdi===undefined||brutoCdi===''?null:Number(brutoCdi);
  const dividendos=ler('dividendos');
  const divs=Array.isArray(dividendos)?dividendos:[];
  const dividendosValidos=divs.every(d=>d&&typeof d.id==='string'&&Number.isFinite(Number(d.valor))&&Number(d.valor)>0&&typeof d.data==='string');
  if(!info||(!info.conservador&&!nome)||!Number.isFinite(valorInvestido)||valorInvestido<0||
     (percentCdi!==null&&(!Number.isFinite(percentCdi)||percentCdi<0))||!dividendosValidos) return null;
  return {tipo,nome,descricao,valorInvestido,percentCdi:info.conservador?percentCdi:null,dividendos:divs};
}

function criarInvestimento(entrada){
  const campos=camposInvestimento(entrada);
  if(!campos) return null;
  if(!data.investimentos) data.investimentos=[];
  const investimento={id:uid(),...campos,criadoEm:new Date().toISOString()};
  data.investimentos.push(investimento);
  return investimento;
}

function atualizarInvestimento(id,alteracoes){
  const investimento=(data.investimentos||[]).find(i=>i.id===id);
  if(!investimento) return null;
  const campos=camposInvestimento(alteracoes,investimento);
  if(!campos) return null;
  Object.assign(investimento,campos);
  return investimento;
}

function removerInvestimento(id){
  const indice=(data.investimentos||[]).findIndex(i=>i.id===id);
  if(indice<0) return null;
  return {item:data.investimentos.splice(indice,1)[0],indice};
}

function restaurarInvestimento(item,indice){
  if(!item) return null;
  if(!data.investimentos) data.investimentos=[];
  data.investimentos.splice(Math.min(Math.max(0,indice||0),data.investimentos.length),0,item);
  return item;
}
