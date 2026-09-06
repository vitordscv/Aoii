/* ── donut chart de categorias (conic-gradient, sem SVG) ── */
const CAT_DONUT_PALETTE=['#3E6F5C','#B8893F','#A23B2E','#5B7DB1','#8A5A2A','#6B4E8E','#4C8C8C','#B15C7C'];
function renderCatDonut(){
  const el=document.getElementById('cat-donut-wrap'); if(!el) return;
  const {entries,total}=computeCategoryBreakdown();
  if(entries.length===0||total===0){ el.innerHTML=''; return; }
  let acc=0;
  const stops=entries.map(([cat,val],i)=>{
    const pct=(val/total)*100;
    const start=acc; acc+=pct;
    const color=CAT_DONUT_PALETTE[i%CAT_DONUT_PALETTE.length];
    return `${color} ${start}% ${acc}%`;
  }).join(',');
  const legend=entries.map(([cat,val],i)=>{
    const pct=Math.round((val/total)*100);
    const color=CAT_DONUT_PALETTE[i%CAT_DONUT_PALETTE.length];
    return `<div class="cat-donut-legend-item"><span class="cat-donut-swatch" style="background:${color};"></span><span class="cat-donut-legend-name">${catIcon(cat)} ${esc(cat)}</span><span class="cat-donut-legend-pct">${pct}%</span></div>`;
  }).join('');
  el.innerHTML=`<div class="cat-donut" style="background:conic-gradient(${stops});"></div><div class="cat-donut-legend">${legend}</div>`;
}

/* ── revisão do mês: aparece nos primeiros dias do mês comparando o mês que acabou de fechar com o anterior a ele ── */
function renderRevisaoMensal(){
  const el=document.getElementById('revisao-mensal-card'); if(!el) return;
  const t=today();
  if(t.getDate()>7){ el.innerHTML=''; return; }
  let mesPassadoMes=t.getMonth(), mesPassadoAno=t.getFullYear();
  if(mesPassadoMes===0){ mesPassadoMes=12; mesPassadoAno--; } // janeiro -> dezembro do ano anterior
  const chave=`${mesPassadoAno}-${mesPassadoMes}`;
  if((data.revisoesVistas||[]).includes(chave)){ el.innerHTML=''; return; }
  let mesAnteriorMes=mesPassadoMes-1, mesAnteriorAno=mesPassadoAno;
  if(mesAnteriorMes<1){ mesAnteriorMes=12; mesAnteriorAno--; }
  const gastoPassado=computeMonthSpend(mesPassadoAno,mesPassadoMes);
  const gastoAnterior=computeMonthSpend(mesAnteriorAno,mesAnteriorMes);
  if(gastoPassado<=0&&gastoAnterior<=0){ el.innerHTML=''; return; }
  const delta=gastoAnterior>0?Math.round(((gastoPassado-gastoAnterior)/gastoAnterior)*100):null;

  function catTotaisDoMes(ano,mes){
    const map={};
    transacoesGasto().forEach(tr=>{ const d=new Date(tr.data+'T12:00:00'); if(d.getFullYear()===ano&&d.getMonth()+1===mes) map[tr.categoria]=(map[tr.categoria]||0)+tr.valor; });
    (data.faturas||[]).forEach(f=>{ if(f.ano===ano&&f.mes===mes) (f.gastos||[]).forEach(g=>{ map[g.categoria]=(map[g.categoria]||0)+g.valor; }); });
    return map;
  }
  const catPassado=catTotaisDoMes(mesPassadoAno,mesPassadoMes);
  const catAnterior=catTotaisDoMes(mesAnteriorAno,mesAnteriorMes);
  let piorCat=null,piorDelta=0,melhorCat=null,melhorDelta=0;
  Object.keys(catPassado).forEach(cat=>{
    const antes=catAnterior[cat]||0, agora=catPassado[cat];
    const diff=agora-antes;
    if(diff>piorDelta){ piorDelta=diff; piorCat=cat; }
    if(diff<melhorDelta){ melhorDelta=diff; melhorCat=cat; }
  });

  const mesNome=MONTH_NAMES[mesPassadoMes-1];
  el.innerHTML=`
  <div class="revisao-card">
    <div class="revisao-header">
      <span class="revisao-title">📋 ${L('revisao.titulo')} ${esc(mesNome)}</span>
      <button type="button" class="revisao-close" data-action="revisao-fechar">✕</button>
    </div>
    <div class="revisao-total">${formatBRL(gastoPassado)} ${L('revisao.gastoNoMes')}${delta!==null?` <span class="${delta>0?'revisao-up':'revisao-down'}">(${delta>0?'+':''}${delta}%)</span>`:''}</div>
    ${piorCat?`<div class="revisao-line">📈 ${catIcon(piorCat)} <b>${esc(piorCat)}</b> ${L('revisao.foiOndeMaisCresceu')} (+${formatBRL(piorDelta)})</div>`:''}
    ${melhorCat?`<div class="revisao-line">📉 ${catIcon(melhorCat)} <b>${esc(melhorCat)}</b> ${L('revisao.foiOndeMaisCaiu')} (${formatBRL(melhorDelta)})</div>`:''}
  </div>`;
  document.querySelector('[data-action="revisao-fechar"]')?.addEventListener('click',async()=>{
    if(!data.revisoesVistas) data.revisoesVistas=[];
    data.revisoesVistas.push(chave);
    await persist(); render();
  });
}

/* ── gastos por categoria ── */
function renderCategoryCard(){
  const el=document.getElementById('cat-card'); if(!el) return;
  const {entries,total}=computeCategoryBreakdown();
  if(entries.length===0||total===0){
    el.innerHTML=`<div class="cat-empty">${L('cat.semGastos')}</div>`;
    return;
  }
  el.innerHTML=entries.map(([cat,val])=>{
    const pct=total>0?(val/total)*100:0;
    return `
    <div class="cat-row">
      <span class="cat-name">${catIcon(cat)} ${esc(cat)}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;"></div></div>
      <span class="cat-value">${formatBRL(val)}</span>
    </div>`;
  }).join('');
}

