/* ── reserva de emergência: apresentação e edição ── */
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
    if(atualizarReserva({reservaGuardado:v})){ await persist(); render(); }
  });
  document.getElementById('reserva-meses-select').addEventListener('change',async e=>{
    if(atualizarReserva({reservaMeses:parseInt(e.target.value,10)})){ await persist(); render(); }
  });
  el.querySelectorAll('.reserva-onde .segmented-btn').forEach(b=>b.addEventListener('click',async()=>{
    const naConta=b.getAttribute('data-onde')==='conta';
    if(data.reservaNaConta===naConta) return;
    atualizarReserva({reservaNaConta:naConta});
    vibrate(8);
    await persist(); render();
  }));
}

let gfExpandAll=false;
