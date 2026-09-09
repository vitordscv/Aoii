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
/* estatísticas dos dividendos: mediana, frequência estimada e projeção */
function invDividendStats(inv){
  const divs=(inv.dividendos||[]).filter(d=>typeof d.valor==='number'&&d.valor>0);
  if(!divs.length) return null;
  const vals=divs.map(d=>d.valor);
  const med=mediana(vals);
  const total=vals.reduce((s,v)=>s+v,0);
  const ordenados=divs.slice().sort((a,b)=>String(a.data||'').localeCompare(String(b.data||'')));
  const ultimo=ordenados[ordenados.length-1];
  const vi=inv.valorInvestido||0;
  const yieldMed=vi>0?(med/vi)*100:0;
  const yieldUlt=vi>0&&ultimo?(ultimo.valor/vi)*100:0;
  // frequência estimada de pagamentos por ano, pelo intervalo entre o 1º e o último
  let porAno=12;
  const datas=ordenados.map(d=>new Date(String(d.data||'')+'T12:00:00')).filter(d=>!isNaN(d));
  if(datas.length>=2){
    const spanMeses=Math.max(1,(datas[datas.length-1]-datas[0])/2629800000);
    porAno=Math.max(1,Math.min(12,Math.round(((datas.length-1)/spanMeses)*12)));
  }
  const proj12=med*porAno;
  const yieldAno=vi>0?(proj12/vi)*100:0;
  const payback=(med>0&&porAno>0&&vi>0)?Math.ceil(vi/(med*porAno/12)):null; // meses
  return {med,total,ultimo,yieldMed,yieldUlt,porAno,proj12,yieldAno,payback,qtd:divs.length};
}
let invFiltro='Todos';
function renderInvestimentos(){
  const listEl=document.getElementById('inv-list');
  const filterEl=document.getElementById('inv-filter');
  if(!listEl||!filterEl) return;
  filterEl.innerHTML=[`<button type="button" class="cat-pill${invFiltro==='Todos'?' active':''}" data-f="Todos">✨ ${L('inv.todos')}</button>`]
    .concat(TIPOS_INVEST().map(t=>`<button type="button" class="cat-pill${invFiltro===t.id?' active':''}" data-f="${t.id}">${t.icon} ${esc(t.label)}</button>`)).join('');
  filterEl.querySelectorAll('.cat-pill').forEach(btn=>btn.addEventListener('click',()=>{
    invFiltro=btn.getAttribute('data-f'); vibrate(6); renderInvestimentos();
  }));
  const all=data.investimentos||[];
  const list=invFiltro==='Todos'?all:all.filter(i=>i.tipo===invFiltro);
  if(all.length===0){
    listEl.innerHTML=`<div class="empty-illus"><span class="ei-icon">🌱</span>${L('inv.nenhumRegistrado')}<br>${L('inv.registrePrimeiro')}</div>`;
    return;
  }
  if(list.length===0){
    listEl.innerHTML=`<div class="empty-illus"><span class="ei-icon">🔍</span>${L('inv.nadaNoFiltro')}</div>`;
    return;
  }
  const totalInvestido=list.reduce((s,i)=>s+(i.valorInvestido||0),0);
  listEl.innerHTML=`<div class="mc-row" style="padding:4px 0 10px;"><span style="font-size:12.5px;color:var(--muted);">${L('inv.totalInvestido')}${invFiltro==='Todos'?'':' '+L('inv.noFiltro')}</span><strong style="font-family:'Nunito Sans',sans-serif;">${formatBRL(totalInvestido)}</strong></div>`+
  list.map(inv=>{
    const t=tipoInvest(inv.tipo);
    const stats=invDividendStats(inv);
    const subParts=[t.label];
    if(inv.descricao) subParts.push(inv.descricao);
    if(t.conservador&&inv.percentCdi) subParts.push(`${inv.percentCdi}% ${L('inv.doIndexador')} ${inv.tipo==='selic'?'Selic':'CDI'}`);
    /* nome com Html no fim: é marcação pronta, não texto — o lint usa isso
       pra saber que a interpolação sem esc() é intencional */
    let tagHtml='';
    if(stats){
      tagHtml=`<span class="inv-yield-tag pos">${stats.qtd} ${stats.qtd===1?L('inv.provento'):L('inv.proventos')} · ${L('inv.mediana')} ${formatBRL(stats.med)} · ~${stats.yieldAno.toFixed(1)}% ${L('inv.aoAno')}</span>`;
    }else if(t.conservador){
      const base=taxaAnualDisponivel(inv.tipo==='selic'?'selic':'cdi');
      if(base&&inv.percentCdi){
        const taxa=base*(inv.percentCdi/100);
        const r=jurosProjetados(inv.valorInvestido||0,0,taxa,12);
        tagHtml=`<span class="inv-yield-tag">${taxa.toFixed(2)}% ${L('inv.aoAno')} · ${L('inv.em12m')}: ${formatBRL(r.composto)}</span>`;
      }
    }
    return `
    <div class="swipe-item" data-id="${inv.id}">
      <div class="swipe-actions">
        <button type="button" class="swipe-act-edit" title="${esc(L('btn.editar'))}">✏️</button>
        <button type="button" class="swipe-act-del" title="${esc(L('btn.excluir'))}">🗑</button>
      </div>
      <div class="swipe-content">
        <div class="gf-item-row" data-inv-id="${inv.id}" style="border-top:none;border-bottom:1px solid var(--line);">
          <div class="gf-item-main">
            <div class="gf-item-nome">${t.icon} ${esc(inv.nome||t.label)}</div>
            <div class="inv-item-sub">${esc(subParts.join(' · '))}</div>
            ${tagHtml}
          </div>
          <div class="gf-item-valor">${formatBRL(inv.valorInvestido||0)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('.swipe-item').forEach(item=>{
    const id=item.getAttribute('data-id');
    attachSwipe(item,{
      onEdit:()=>openInvSheet(id),
      onDelete:()=>removeInvestimentoComUndo(id),
    });
    const row=item.querySelector('[data-inv-id]');
    if(row) row.addEventListener('click',()=>openInvSheet(id));
  });
}
function removeInvestimentoComUndo(id){
  const idx=(data.investimentos||[]).findIndex(i=>i.id===id);
  if(idx<0) return;
  const removed=data.investimentos.splice(idx,1)[0];
  vibrate(15);
  render();
  showUndoToast(L('undo.removido').replace('{nome}',removed.nome||tipoInvest(removed.tipo).label),()=>{
    data.investimentos.splice(Math.min(idx,data.investimentos.length),0,removed);
  });
}

/* ── bottom sheet de investimento ── */
let _openInvSheet=null;
function openInvSheet(id){ if(_openInvSheet) _openInvSheet(id); }
function setupInvSheet(){
  const backdrop=document.getElementById('inv-sheet-backdrop');
  const sheet=document.getElementById('inv-sheet');
  const cancelBtn=document.getElementById('inv-sheet-cancel');
  const delBtn=document.getElementById('inv-sheet-del');
  const submitBtn=document.getElementById('inv-sheet-submit');
  const titleEl=document.getElementById('inv-sheet-title');
  if(!backdrop||!sheet) return;
  let tipoAtual='cdi';
  let editingId=null;
  let divsDraft=[];

  function renderTipoGrid(){
    const grid=document.getElementById('inv-tipo-grid');
    grid.innerHTML=TIPOS_INVEST().map(t=>`<button type="button" class="cat-pill${t.id===tipoAtual?' active':''}" data-tipo="${t.id}">${t.icon} ${esc(t.label)}</button>`).join('');
    grid.querySelectorAll('.cat-pill').forEach(btn=>btn.addEventListener('click',()=>{
      tipoAtual=btn.getAttribute('data-tipo'); vibrate(6); renderTipoGrid(); refreshFields();
    }));
  }
  function refreshFields(){
    const cons=tipoInvest(tipoAtual).conservador;
    document.getElementById('inv-cdi-field').style.display=cons?'':'none';
    document.getElementById('inv-div-section').style.display=cons?'none':'';
    const cdiLabel=document.querySelector('#inv-cdi-field label');
    if(cdiLabel) cdiLabel.textContent=tipoAtual==='selic'?L('calc.pctSelicRendendo'):L('calc.pctCdiRendendo');
    document.getElementById('inv-nome').placeholder=L(cons?'ph.investmentConservative':'ph.investmentMarket');
    if(!cons) renderDivList();
  }
  function renderDivList(){
    const listEl=document.getElementById('inv-div-list');
    const statsEl=document.getElementById('inv-div-stats');
    if(!divsDraft.length){
      listEl.innerHTML=`<div class="gm-empty">${L('inv.semDividendo')}</div>`;
      statsEl.innerHTML='';
      return;
    }
    listEl.innerHTML=divsDraft.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).map(d=>`
      <div class="div-row">
        <span class="d-data">${d.data?new Date(d.data+'T12:00:00').toLocaleDateString(localeAtual()):'—'}</span>
        <span class="d-valor">${formatBRL(d.valor)}</span>
        <button type="button" class="gm-del" data-did="${d.id}" title="${esc(L('btn.remover'))}">✕</button>
      </div>`).join('');
    listEl.querySelectorAll('.gm-del').forEach(btn=>btn.addEventListener('click',()=>{
      divsDraft=divsDraft.filter(x=>x.id!==btn.getAttribute('data-did'));
      renderDivList();
    }));
    const valorInv=parseNum(document.getElementById('inv-valor').value)||0;
    const stats=invDividendStats({valorInvestido:valorInv,dividendos:divsDraft});
    if(stats&&valorInv>0){
      statsEl.innerHTML=`<div class="div-stats">
        ${L('inv.last')}: <strong>${formatBRL(stats.ultimo?stats.ultimo.valor:0)}</strong> (${stats.yieldUlt.toFixed(2)}% ${L('inv.ofInvested')}) ·
        ${L('inv.medianaDe').replace('{n}',stats.qtd)}: <strong>${formatBRL(stats.med)}</strong> (${stats.yieldMed.toFixed(2)}%)<br>
        ${L('inv.estimatedFrequency')}: <strong>${stats.porAno}×</strong>/${L('inv.year')} ·
        ${L('inv.projection12')}: <strong>${formatBRL(stats.proj12)}</strong> (~${stats.yieldAno.toFixed(1)}% ${L('inv.aoAno')})
        ${stats.payback?`<br>${L('inv.dividendPayback').replace('{n}',`<strong>${stats.payback}</strong>`)}`:''}
      </div>`;
    }else if(stats){
      statsEl.innerHTML=`<div class="div-stats">${L('inv.medianaDe').replace('{n}',stats.qtd)}: <strong>${formatBRL(stats.med)}</strong> — ${L('inv.informeValor')}</div>`;
    }else statsEl.innerHTML='';
  }
  const divAddBtn=document.getElementById('inv-div-add');
  if(divAddBtn) divAddBtn.addEventListener('click',()=>{
    const dEl=document.getElementById('inv-div-data'), vEl=document.getElementById('inv-div-valor');
    const valor=parseNum(vEl.value);
    if(isNaN(valor)||valor<=0){ vEl.focus(); return; }
    divsDraft.push({id:uid(),data:dEl.value||todayISO(),valor});
    vEl.value=''; vibrate(8);
    renderDivList();
  });
  document.getElementById('inv-valor').addEventListener('input',()=>{
    if(!tipoInvest(tipoAtual).conservador) renderDivList();
  });

  function resetForm(inv){
    editingId=inv?inv.id:null;
    tipoAtual=inv?inv.tipo:'cdi';
    divsDraft=inv?JSON.parse(JSON.stringify(inv.dividendos||[])):[];
    titleEl.textContent=inv?L('inv.editar'):L('sheet.novoinvestimento');
    document.getElementById('inv-valor').value=inv?inv.valorInvestido:'';
    document.getElementById('inv-nome').value=inv?(inv.nome||''):'';
    document.getElementById('inv-descricao').value=inv?(inv.descricao||''):'';
    document.getElementById('inv-percent-cdi').value=inv&&inv.percentCdi?inv.percentCdi:'';
    document.getElementById('inv-div-data').value=todayISO();
    document.getElementById('inv-div-valor').value='';
    delBtn.style.display=inv?'block':'none';
    renderTipoGrid(); refreshFields();
  }
  function open(id){
    const inv=id?(data.investimentos||[]).find(x=>x.id===id):null;
    resetForm(inv);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openInvSheet=open;
  const newBtn=document.getElementById('inv-new-btn');
  if(newBtn) newBtn.addEventListener('click',()=>{ vibrate(8); open(null); });
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&sheet.style.display==='block') close(); });
  delBtn.addEventListener('click',()=>{
    if(!editingId) return;
    const id=editingId;
    close();
    removeInvestimentoComUndo(id);
  });
  submitBtn.addEventListener('click',async()=>{
    const valor=parseNum(document.getElementById('inv-valor').value);
    if(isNaN(valor)||valor<0){ document.getElementById('inv-valor').focus(); return; }
    const t=tipoInvest(tipoAtual);
    const nome=document.getElementById('inv-nome').value.trim();
    if(!t.conservador&&!nome){ document.getElementById('inv-nome').focus(); return; }
    const descricao=document.getElementById('inv-descricao').value.trim();
    const percentCdi=parseNum(document.getElementById('inv-percent-cdi').value)||null;
    if(!data.investimentos) data.investimentos=[];
    if(editingId){
      const inv=data.investimentos.find(x=>x.id===editingId);
      if(inv) Object.assign(inv,{tipo:tipoAtual,nome,descricao,valorInvestido:valor,percentCdi:t.conservador?percentCdi:null,dividendos:divsDraft});
    }else{
      data.investimentos.push({id:uid(),tipo:tipoAtual,nome,descricao,valorInvestido:valor,percentCdi:t.conservador?percentCdi:null,dividendos:divsDraft,criadoEm:new Date().toISOString()});
    }
    vibrate([10,30,10]);
    await persist(); render();
    close();
  });
}
