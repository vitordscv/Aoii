/* juros simples e compostos, com aporte mensal opcional */
function jurosProjetados(principal,aporteMensal,taxaAnualPct,meses){
  const rAno=taxaAnualPct/100;
  const rMes=Math.pow(1+rAno,1/12)-1; // equivalente mensal (composto)
  const rMesSimples=rAno/12;          // proporcional (simples)
  let composto=principal*Math.pow(1+rMes,meses);
  let simples=principal*(1+rMesSimples*meses);
  for(let i=1;i<=meses;i++){
    composto+=aporteMensal*Math.pow(1+rMes,meses-i);
    simples+=aporteMensal*(1+rMesSimples*(meses-i));
  }
  const investido=principal+aporteMensal*meses;
  return {simples,composto,investido};
}
function renderCalcResult(){
  const out=document.getElementById('calc-result'); if(!out) return;
  const P=parseNum((document.getElementById('calc-valor')||{}).value)||0;
  const A=parseNum((document.getElementById('calc-aporte')||{}).value)||0;
  const idx=(document.getElementById('calc-indexador')||{}).value||'cdi';
  const pctFieldEl=document.getElementById('calc-pct-field');
  const fixaFieldEl=document.getElementById('calc-fixa-field');
  if(pctFieldEl) pctFieldEl.style.display=idx==='fixa'?'none':'';
  if(fixaFieldEl) fixaFieldEl.style.display=idx==='fixa'?'':'none';
  const pctLabel=pctFieldEl?pctFieldEl.querySelector('label'):null;
  if(pctLabel) pctLabel.textContent=idx==='selic'?L('calc.pctSelic'):L('calc.pctCdi');
  let n=parseInt((document.getElementById('calc-prazo')||{}).value,10)||0;
  if(((document.getElementById('calc-prazo-unidade')||{}).value)==='anos') n*=12;
  let taxa=null,taxaLabel='';
  if(idx==='fixa'){
    const tf=parseNum((document.getElementById('calc-taxa-fixa')||{}).value)||0;
    if(tf>0){ taxa=tf; taxaLabel=tf.toFixed(2)+'% a.a.'; }
  }else{
    const base=taxaAnualDisponivel(idx);
    const pct=(parseNum((document.getElementById('calc-percent')||{}).value)||100)/100;
    if(base!==null){ taxa=base*pct; taxaLabel=`${(pct*100).toFixed(0)}% do ${idx.toUpperCase()} (${base}% a.a.) = ${taxa.toFixed(2)}% a.a.`; }
  }
  if(!P&&!A){ out.innerHTML=`<div class="inv-result-item"><div class="sub">${L('calc.preenchaValor')}</div></div>`; return; }
  if(taxa===null){ out.innerHTML=`<div class="inv-result-item"><div class="sub">${L('calc.semTaxa')}</div></div>`; return; }
  if(n<=0){ out.innerHTML=`<div class="inv-result-item"><div class="sub">${L('calc.informePrazo')}</div></div>`; return; }
  const r=jurosProjetados(P,A,taxa,n);
  out.innerHTML=`
    <div class="inv-result-item"><div class="lbl">${L('inv.jurosCompostos')}</div><div class="val">${formatBRL(r.composto)}</div><div class="sub">${L('inv.rendimentoDe')} ${formatBRL(r.composto-r.investido)}</div></div>
    <div class="inv-result-item"><div class="lbl">${L('inv.jurosSimples')}</div><div class="val">${formatBRL(r.simples)}</div><div class="sub">${L('inv.rendimentoDe')} ${formatBRL(r.simples-r.investido)}</div></div>
    <div class="inv-result-item"><div class="lbl">${L('inv.totalInvestido')}</div><div class="val">${formatBRL(r.investido)}</div><div class="sub">${n} ${n===1?L('inv.mes'):L('inv.meses')} · ${esc(taxaLabel)}</div></div>`;
}
function bindCalculadora(){
  ['calc-valor','calc-aporte','calc-percent','calc-taxa-fixa','calc-prazo'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.addEventListener('input',renderCalcResult);
  });
  ['calc-indexador','calc-prazo-unidade'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.addEventListener('change',renderCalcResult);
  });
  const upd=document.getElementById('calc-atualizar-taxas');
  if(upd) upd.addEventListener('click',()=>{ vibrate(10); fetchTaxasAtuais(); });
  const ci=document.getElementById('taxa-cdi-manual');
  if(ci) ci.addEventListener('change',async e=>{
    if(!data.taxasManuais) data.taxasManuais={};
    data.taxasManuais.cdi=parseNum(e.target.value)||null;
    data.taxasManuais.atualizadoEm=new Date().toISOString();
    await persist(); refreshTaxasUI();
  });
  const si=document.getElementById('taxa-selic-manual');
  if(si) si.addEventListener('change',async e=>{
    if(!data.taxasManuais) data.taxasManuais={};
    data.taxasManuais.selic=parseNum(e.target.value)||null;
    data.taxasManuais.atualizadoEm=new Date().toISOString();
    await persist(); refreshTaxasUI();
  });
  refreshTaxasUI();
}

