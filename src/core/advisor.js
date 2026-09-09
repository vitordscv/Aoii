/* ── conselheiro: dicas e alertas baseados em regras sobre os próprios dados (sem IA, 100% offline) ── */
function computeConselhos(){
  const dicas=[];
  const hoje=today(); const y=hoje.getFullYear(), m=hoje.getMonth()+1;
  // 1) categoria muito acima da média dos últimos 3 meses
  const porCatMes={};
  for(let i=0;i<4;i++){
    let yy=y, mm=m-i; while(mm<1){ mm+=12; yy--; }
    const map={};
    transacoesGasto().forEach(t=>{
      const d=new Date(t.data+'T12:00:00');
      if(!isNaN(d)&&d.getFullYear()===yy&&d.getMonth()+1===mm) map[t.categoria]=(map[t.categoria]||0)+t.valor;
    });
    (data.faturas||[]).forEach(f=>{ if(f.ano===yy&&f.mes===mm) (f.gastos||[]).forEach(g=>map[g.categoria]=(map[g.categoria]||0)+g.valor); });
    porCatMes[i]=map;
  }
  const catsVistas=new Set([...Object.keys(porCatMes[0]||{})]);
  catsVistas.forEach(cat=>{
    const atual=porCatMes[0][cat]||0;
    const anteriores=[porCatMes[1]?.[cat]||0,porCatMes[2]?.[cat]||0,porCatMes[3]?.[cat]||0];
    const media=anteriores.reduce((s,v)=>s+v,0)/3;
    if(media>50&&atual>media*1.4){
      const pct=Math.round(((atual-media)/media)*100);
      dicas.push({icon:'📊',texto:L('cons.categoriaAcima').replace('{pct}',pct).replace('{cat}',cat),prioridade:2});
    }
  });
  // 2) metas atrasadas
  (data.metas||[]).forEach(meta=>{
    if(!meta.dataAlvo) return;
    const alvo=meta.valorAlvo||0, guardado=meta.valorGuardado||0;
    if(alvo<=0||guardado>=alvo) return;
    const months=metaMonthsRemaining(meta.dataAlvo);
    if(months<=0){
      dicas.push({icon:'🎯',texto:L('cons.metaAtrasada').replace('{nome}',meta.nome).replace('{falta}',formatBRL(alvo-guardado)),prioridade:3});
    }else{
      const necessario=(alvo-guardado)/months;
      if(meta.aporteMensal>0&&meta.aporteMensal<necessario*0.8){
        dicas.push({icon:'🎯',texto:L('cons.aporteBaixo').replace('{nome}',meta.nome).replace('{aporte}',formatBRL(meta.aporteMensal)).replace('{necessario}',formatBRL(necessario)),prioridade:2});
      }
    }
  });
  // 3) orçamento por categoria estourado
  const gastoAtual=computeGastoMesPorCategoria();
  Object.entries(data.orcamentos||{}).forEach(([cat,teto])=>{
    if(!(teto>0)) return;
    const gasto=gastoAtual[cat]||0;
    if(gasto>teto){
      dicas.push({icon:'⚠️',texto:L('cons.orcamentoEstourado').replace('{cat}',categoriaLabel(cat)).replace('{gasto}',formatBRL(gasto)).replace('{teto}',formatBRL(teto)),prioridade:3});
    }
  });
  // 4) cartão perto do limite
  (data.cartoes||[]).forEach(c=>{
    const info=computeCartao(c.id);
    if(info.limite>0&&info.pct>=85){
      dicas.push({icon:'💳',texto:L('cons.cartaoLimite').replace('{nome}',c.nome).replace('{pct}',info.pct.toFixed(0)),prioridade:2});
    }
  });
  // 5) viagem estourando orçamento
  (data.viagens||[]).forEach(v=>{
    if(!(v.orcamento>0)) return;
    const gasto=transacoesGasto().filter(t=>t.viagemId===v.id).reduce((s,t)=>s+t.valor,0);
    if(gasto>v.orcamento){
      dicas.push({icon:'✈️',texto:L('cons.viagemEstourada').replace('{nome}',v.nome).replace('{gasto}',formatBRL(gasto)).replace('{orcamento}',formatBRL(v.orcamento)),prioridade:2});
    }
  });
  // 6) saldo projetado negativo (reforça o que já aparece no hero)
  if(computeTotals().projetado<0){
    dicas.push({icon:'📉',texto:L('cons.saldoNegativo'),prioridade:3});
  }
  dicas.sort((a,b)=>b.prioridade-a.prioridade);
  return dicas.slice(0,4);
}
function renderConselhos(){
  const el=document.getElementById('conselhos-card'); if(!el) return;
  const dicas=computeConselhos();
  if(!dicas.length){ el.innerHTML=''; return; }
  el.innerHTML=`
  <div class="conselhos-box">
    <div class="conselhos-title">💡 ${esc(L('advisor.title'))}</div>
    ${dicas.map(d=>`<div class="conselho-item"><span class="conselho-icon">${d.icon}</span><span>${esc(d.texto)}</span></div>`).join('')}
  </div>`;
}
