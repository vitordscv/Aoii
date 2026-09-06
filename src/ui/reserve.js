/* ── reserva de emergência: meta calculada a partir dos gastos fixos ativos ── */
function custoMensalEssencial(){
  const hoje=today();
  const ano=hoje.getFullYear(), mes=hoje.getMonth()+1;
  const num=v=>{ const n=parseNum(v); return isNaN(n)?0:n; };

  const fixos=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,ano,mes)).reduce((s,g)=>s+num(g.valor),0);

  /* média da fatura: usa os meses já fechados; se não houver nenhum ainda,
     cai pro mês atual pra não zerar o cálculo de quem começou a usar agora */
  const totalFatura=f=>num(f.valor)+(f.gastos||[]).reduce((a,g)=>a+num(g.valor),0);
  const kAtual=chaveMes(ano,mes);
  const porMesFat=new Map();
  (data.faturas||[]).forEach(f=>{
    const k=chaveMes(f.ano,f.mes);
    if(k>=kAtual) return; // só meses já fechados
    porMesFat.set(k,(porMesFat.get(k)||0)+totalFatura(f));
  });
  let chaves=[...porMesFat.keys()].sort((a,b)=>a-b).slice(-3); // os 3 ÚLTIMOS meses
  if(chaves.length===0){ // ninguém fechou ainda: cai pro mês atual, somando os cartões
    (data.faturas||[]).forEach(f=>{
      const k=chaveMes(f.ano,f.mes);
      if(k===kAtual) porMesFat.set(k,(porMesFat.get(k)||0)+totalFatura(f));
    });
    chaves=[...porMesFat.keys()];
  }
  const mediaFatura=chaves.length?chaves.reduce((s,k)=>s+porMesFat.get(k),0)/chaves.length:0;

  const custo=fixos+mediaFatura;
  if(custo>0) return custo;

  /* último recurso: média do que realmente saiu nos últimos 3 meses com movimento */
  const meses=[];
  for(let i=1;i<=3;i++){ let m=mes-i,a=ano; while(m<1){ m+=12; a--; } meses.push(computeMonthSpend(a,m)); }
  const comMovimento=meses.filter(v=>v>0);
  return comMovimento.length?comMovimento.reduce((s,v)=>s+v,0)/comMovimento.length:0;
}
function renderReservaCard(){
  const el=document.getElementById('reserva-card'); if(!el) return;
  const custo=custoMensalEssencial();
  const meses=data.reservaMeses||3;
  const alvo=custo*meses;
  const guardado=data.reservaGuardado||0;
  const cobertura=custo>0?guardado/custo:0;
  const pct=alvo>0?Math.min(100,(guardado/alvo)*100):0;

  let statusKey='construindo', statusCls='mid';
  if(custo<=0){ statusKey='semDados'; statusCls='none'; }
  else if(cobertura>=meses){ statusKey='protegido'; statusCls='ok'; }
  else if(cobertura<1){ statusKey='critico'; statusCls='low'; }

  // sugestão baseada na renda: quanto sobra por mês e em quanto tempo a reserva fecha nesse ritmo
  const renda=rendaMediaMensal();
  const sobra=renda-custo;
  const falta=Math.max(0,alvo-guardado);
  let sugestaoHtml='';
  if(custo>0&&renda>0){
    if(falta<=0){
      sugestaoHtml=`<div class="reserva-sugestao">${L('rs.completa')}</div>`;
    }else if(sobra>0){
      const mesesFalta=Math.ceil(falta/sobra);
      const aporteIdeal=sobra*0.5;
      sugestaoHtml=`<div class="reserva-sugestao">${L('rs.sugestao')
        .replace('{sobra}',`<b>${formatBRL(sobra)}</b>`)
        .replace('{aporte}',`<b>${formatBRL(aporteIdeal)}</b>`)
        .replace('{meses}',`<b>${mesesFalta}</b>`)}</div>`;
    }else{
      sugestaoHtml=`<div class="reserva-sugestao">${L('rs.semSobra')}</div>`;
    }
  }

  el.innerHTML=`
  <div class="reserva-box">
    <div class="reserva-top">
      <div>
        <div class="reserva-label">🛡️ ${L('rs.titulo')}</div>
        <div class="reserva-valor">${formatBRL(guardado)}${alvo>0?`<span class="reserva-alvo"> / ${formatBRL(alvo)}</span>`:''}</div>
      </div>
      <div class="reserva-badge ${statusCls}">${L('rs.status.'+statusKey)}</div>
    </div>
    ${alvo>0?`<div class="reserva-track"><div class="reserva-fill ${statusCls}" style="width:${pct}%;"></div></div>`:''}
    <div class="reserva-cobertura">${custo>0
      ? L('rs.cobre').replace('{meses}',cobertura.toFixed(1).replace('.',',')).replace('{custo}',formatBRL(custo))
      : L('rs.semDadosHint')}</div>
    ${sugestaoHtml}
    <div class="reserva-controls">
      <label class="reserva-field">
        <span>${L('rs.jaGuardei')}</span>
        <input type="text" inputmode="decimal" id="reserva-guardado-input" value="${guardado>0?guardado:''}" placeholder="0,00">
      </label>
      <label class="reserva-field">
        <span>${L('rs.quantosMeses')}</span>
        <select id="reserva-meses-select">
          ${[3,6,12].map(n=>`<option value="${n}"${n===meses?' selected':''}>${n} ${L('rs.mesesSufixo')}</option>`).join('')}
        </select>
      </label>
      <div class="reserva-field reserva-onde-campo">
        <span>${L('rs.ondeEsta')}</span>
        <div class="segmented reserva-onde">
          <button type="button" class="segmented-btn${data.reservaNaConta!==false?' active':''}" data-onde="conta">${L('rs.naConta')}</button>
          <button type="button" class="segmented-btn${data.reservaNaConta===false?' active':''}" data-onde="fora">${L('rs.foraDaConta')}</button>
        </div>
        <div class="reserva-onde-hint">${L(data.reservaNaConta!==false?'rs.ondeHintConta':'rs.ondeHintFora')}</div>
      </div>
    </div>
  </div>`;

  const gIn=document.getElementById('reserva-guardado-input');
  gIn.addEventListener('change',async()=>{
    const v=parseNum(gIn.value);
    data.reservaGuardado=isNaN(v)?0:v;
    await persist(); render();
  });
  document.getElementById('reserva-meses-select').addEventListener('change',async e=>{
    data.reservaMeses=parseInt(e.target.value,10)||3;
    await persist(); render();
  });
  el.querySelectorAll('.reserva-onde .segmented-btn').forEach(b=>b.addEventListener('click',async()=>{
    const naConta=b.getAttribute('data-onde')==='conta';
    if(data.reservaNaConta===naConta) return;
    data.reservaNaConta=naConta;
    vibrate(8);
    await persist(); render();
  }));
}

let gfExpandAll=false;
