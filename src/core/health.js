/* ── indicador de saúde financeira: score simples 0-100 baseado em orçamento, saldo projetado, faturas e metas ── */
function computeSaudeFinanceira(){
  let score=0; const motivos=[];
  const t=today(); const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  const orcamentoTotal=Object.values(data.orcamentos||{}).reduce((s,v)=>s+(v||0),0);
  const gastoMes=computeMonthSpend(anoA,mesA);
  if(orcamentoTotal>0){
    if(gastoMes<=orcamentoTotal){ score+=40; motivos.push(L('saude.dentroOrcamento')); }
    else{ score+=Math.max(0,40-Math.round(((gastoMes-orcamentoTotal)/orcamentoTotal)*40)); motivos.push(L('saude.acimaOrcamento')); }
  }else{ score+=20; }
  const proj=computeTotals().projetado;
  if(proj>=0){ score+=30; motivos.push(L('saude.saldoPositivo')); } else motivos.push(L('saude.saldoNegativo'));
  const atrasada=(data.faturas||[]).some(f=>{
    if(f.pago) return false;
    const cartao=(data.cartoes||[]).find(c=>c.id===f.cartaoId);
    const dia=Math.min(31,Math.max(1,(cartao&&cartao.diaVencimento)||data.diaVencimentoFatura||10));
    return startOfDay(dataNoMes(f.ano,f.mes,dia))<t;
  });
  if(!atrasada){ score+=20; } else motivos.push(L('saude.faturaAtrasada'));
  const guardouAlgo=(data.metas||[]).some(m=>m.aporteMensal>0)
    ||(data.metas||[]).some(m=>(m.valorGuardado||0)>0)
    ||(orcamentoTotal>0&&gastoMes<orcamentoTotal);
  if(guardouAlgo){ score+=10; }
  return {score:Math.min(100,score),motivos};
}

/* ── resumo semanal: gasto dos últimos 7 dias + quanto ainda dá pra gastar até o fim do mês ── */
function computeWeekSummary(){
  const t=today();
  const seteDiasAtras=new Date(t); seteDiasAtras.setDate(seteDiasAtras.getDate()-6);
  let gastoSemana=0;
  transacoesGasto().forEach(tr=>{
    const d=startOfDay(new Date(tr.data+'T12:00:00')); // normaliza: hoje conta
    if(d>=seteDiasAtras&&d<=t) gastoSemana+=tr.valor;
  });
  const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  const orcamentoTotal=Object.values(data.orcamentos||{}).reduce((s,v)=>s+(v||0),0);
  const gastoMes=computeMonthSpend(anoA,mesA);
  const diasNoMes=new Date(anoA,mesA,0).getDate();
  const diasRestantes=Math.max(1,diasNoMes-t.getDate()+1);
  const livreAteFimDoMes=orcamentoTotal>0?Math.max(0,orcamentoTotal-gastoMes):null;
  return {gastoSemana,livreAteFimDoMes,diasRestantes};
}

/* ── total realmente gasto num mês (transações + fatura do mês + fixos ativos), p/ comparação mês a mês ── */
/* ── receitas efetivamente realizadas no mês (linha a linha), pro relatório contábil ── */
function computeReceitasMesDetalhe(){
  const t=today(); const y=t.getFullYear(), m=t.getMonth();
  const itens=[];
  (data.transacoes||[]).forEach(tr=>{
    if(tr.tipo==='receita'){
      const d=new Date(tr.data+'T12:00:00');
      if(!isNaN(d)&&d.getFullYear()===y&&d.getMonth()===m) itens.push({nome:tr.nome||L('rp.entrada'),val:tr.valor,tag:L('rp.entradaAvulsa')});
    }
  });
  (data.entradasExtras||[]).forEach(e=>{
    if(!e.feito) return;
    const quando=e.feitoEm||e.dataPrevista;
    if(!quando) return;                 // sem data não dá pra dizer que foi deste mês
    const d=new Date(quando+'T12:00:00');
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m) return;
    itens.push({nome:e.nome||L('rp.entradaExtra'),val:e.valor,tag:L('rp.entradaExtra')});
  });
  rendasRecorrentesAtivas().forEach(r=>{ itens.push({nome:r.nome||L('rp.rendaRecorrente'),val:r.valor,tag:L('rp.rendaRecorrente')}); });
  if(data.tipoRenda==='mensal'&&data.rendaMensal&&data.rendaMensal.valor>0){
    itens.push({nome:L('rp.rendaMensalPrincipal'),val:data.rendaMensal.valor,tag:L('rp.rendaFixa')});
  }else if(data.tipoRenda==='diaria'&&data.rendaDiaria>0){
    const folgas=new Set(data.diasNaoTrabalhados||[]);
    const diasUteisNoMes=(()=>{ let c=0; const diasNoMes=new Date(y,m+1,0).getDate(); for(let d=1;d<=diasNoMes;d++){ const dt=new Date(y,m,d); if((data.diasTrabalho||[]).includes(dt.getDay())&&!folgas.has(isoDate(dt))) c++; } return c; })();
    itens.push({nome:L('rp.rendaPorDia').replace('{n}',diasUteisNoMes),val:data.rendaDiaria*diasUteisNoMes,tag:L('rp.rendaDiaria')});
  }
  return itens;
}

function computeMonthSpend(ano,mes){
  let total=0;
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00');
    if(d.getFullYear()===ano&&d.getMonth()+1===mes) total+=t.valor;
  });
  (data.faturas||[]).forEach(f=>{
    if(f.ano===ano&&f.mes===mes) total+=(f.gastos||[]).reduce((s,g)=>s+g.valor,0);
  });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,ano,mes)) total+=g.valor; });
  return total;
}
