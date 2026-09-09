/* ── faturas agrupadas por mês ──
   com mais de um cartão existe UMA fatura por cartão no mesmo mês; sem agrupar,
   renda e gastos fixos do mês seriam contados uma vez por cartão ── */
function faturasPorMes(){
  const byMonth=new Map();
  [...data.faturas].sort((a,b)=>(a.ano*12+a.mes)-(b.ano*12+b.mes)).forEach(f=>{
    const k=f.ano*12+f.mes;
    if(!byMonth.has(k)) byMonth.set(k,[]);
    byMonth.get(k).push(f);
  });
  return [...byMonth.values()];
}

/* métricas do mês inteiro: renda + gastos fixos 1x, faturas de todos os cartões */
function mesMetrics(fs){
  const m=monthMetrics(fs[0]); // renda + gastos fixos do mês (1x)
  for(let i=1;i<fs.length;i++){ // demais cartões: soma só a parte de fatura deles
    const extra=(fs[i].pago?0:fs[i].valor)+(fs[i].gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0);
    m.despesas+=extra; m.saldoMes-=extra;
  }
  return m;
}

/* ── comandos de fatura e dos gastos que pertencem a ela ── */
function camposFatura(entrada){
  entrada=entrada||{};
  if(entrada.valor===null||entrada.valor===undefined||entrada.valor==='') return null;
  const ano=Number(entrada.ano), mes=Number(entrada.mes), valor=Number(entrada.valor);
  const cartaoId=entrada.cartaoId===undefined?((data.cartoes||[])[0]||{}).id||null:entrada.cartaoId;
  const cartaoExiste=cartaoId===null||(data.cartoes||[]).some(c=>c.id===cartaoId);
  if(!Number.isInteger(ano)||ano<1900||ano>3000||!Number.isInteger(mes)||mes<1||mes>12||
     !Number.isFinite(valor)||valor<0||!cartaoExiste) return null;
  return {ano,mes,valor,cartaoId};
}

function salvarFatura(entrada){
  const campos=camposFatura(entrada);
  if(!campos) return null;
  let fatura=(data.faturas||[]).find(f=>f.ano===campos.ano&&f.mes===campos.mes&&f.cartaoId===campos.cartaoId);
  if(fatura){ fatura.valor=campos.valor; return fatura; }
  if(!data.faturas) data.faturas=[];
  fatura={id:uid(),...campos,pago:false,gastos:[]};
  data.faturas.push(fatura);
  return fatura;
}

function atualizarValorFatura(id,valor){
  const fatura=(data.faturas||[]).find(f=>f.id===id);
  if(valor===null||valor===undefined||valor==='') return null;
  valor=Number(valor);
  if(!fatura||!Number.isFinite(valor)||valor<0) return null;
  fatura.valor=valor;
  return fatura;
}

function definirFaturaPaga(id,pago){
  const fatura=(data.faturas||[]).find(f=>f.id===id);
  if(!fatura||typeof pago!=='boolean') return null;
  fatura.pago=pago;
  if(pago) (fatura.gastos||[]).forEach(g=>{ g.pago=true; });
  return fatura;
}

function removerFaturas(ids){
  const conjunto=new Set(Array.isArray(ids)?ids:[ids]);
  const removidas=(data.faturas||[]).filter(f=>conjunto.has(f.id));
  if(!removidas.length) return [];
  data.faturas=(data.faturas||[]).filter(f=>!conjunto.has(f.id));
  return removidas;
}

function atualizarGastoFatura(faturaId,gastoId,alteracoes){
  const fatura=(data.faturas||[]).find(f=>f.id===faturaId);
  const gasto=fatura&&(fatura.gastos||[]).find(g=>g.id===gastoId);
  if(!gasto) return null;
  alteracoes=alteracoes||{};
  const proximo={};
  if(Object.prototype.hasOwnProperty.call(alteracoes,'nome')) proximo.nome=String(alteracoes.nome);
  if(Object.prototype.hasOwnProperty.call(alteracoes,'valor')){
    const valor=Number(alteracoes.valor);
    if(!Number.isFinite(valor)||valor<0) return null;
    proximo.valor=valor;
  }
  if(Object.prototype.hasOwnProperty.call(alteracoes,'pago')){
    if(typeof alteracoes.pago!=='boolean') return null;
    proximo.pago=alteracoes.pago;
  }
  Object.assign(gasto,proximo);
  return gasto;
}

function removerGastoFatura(faturaId,gastoId){
  const fatura=(data.faturas||[]).find(f=>f.id===faturaId);
  if(!fatura) return null;
  const indice=(fatura.gastos||[]).findIndex(g=>g.id===gastoId);
  if(indice<0) return null;
  return fatura.gastos.splice(indice,1)[0];
}

function removerParcelamento(parcelamentoId){
  if(!parcelamentoId) return 0;
  let removidos=0;
  (data.faturas||[]).forEach(f=>{
    const antes=(f.gastos||[]).length;
    f.gastos=(f.gastos||[]).filter(g=>g.parcelamentoId!==parcelamentoId);
    removidos+=antes-f.gastos.length;
  });
  return removidos;
}
