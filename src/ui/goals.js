/* ── metas de economia ── */
function renderMetas(){
  const el=document.getElementById('metas-list'); if(!el) return;
  const all=data.metas||[];

  const ativas=all
    .filter(m=>!((m.valorAlvo||0)>0&&(m.valorGuardado||0)>=(m.valorAlvo||0)))
    .sort((a,b)=>{
      // sem prazo vai ao final das ativas
      if(a.dataAlvo&&!b.dataAlvo) return -1;
      if(!a.dataAlvo&&b.dataAlvo) return 1;
      if(a.dataAlvo&&b.dataAlvo) return new Date(a.dataAlvo)-new Date(b.dataAlvo);
      return 0;
    });

  const concluidas=all.filter(m=>(m.valorAlvo||0)>0&&(m.valorGuardado||0)>=(m.valorAlvo||0));

  function metaCard(m, done){
    const alvo=m.valorAlvo||0, guardado=m.valorGuardado||0;
    const pct=alvo>0?Math.max(0,Math.min(100,(guardado/alvo)*100)):0;
    const dataTxt=m.dataAlvo?(L('meta.ate')+' '+new Date(m.dataAlvo+'T12:00:00').toLocaleDateString(localeAtual(),{day:'2-digit',month:'short',year:'numeric'})):'';
    let sugestaoHtml='';
    if(!done&&m.dataAlvo&&alvo>0){
      const months=metaMonthsRemaining(m.dataAlvo);
      const falta=Math.max(0,alvo-guardado);
      if(months<=0){
        sugestaoHtml=`<div class="meta-suggestion overdue">${L('meta.prazoPassou')} ${formatBRL(falta)}</div>`;
      }else{
        sugestaoHtml=`<div class="meta-suggestion">${L('meta.guarde')} ~${formatBRL(falta/months)}${L('meta.porMes')}</div>`;
      }
    }
    return `
    <div class="meta-row${done?' meta-done':''}">
      <div class="meta-top">
        ${done?'<span class="meta-check">✓</span>':''}
        <input type="text" class="meta-nome" data-id="${m.id}" data-action="meta-nome" value="${esc(m.nome)}">
        <button class="item-del" data-id="${m.id}" data-action="meta-del" title="${esc(L('btn.excluir'))}">✕</button>
      </div>
      <div class="meta-bar-track"><div class="meta-bar-fill${done?' done':''}" style="width:${pct}%;"></div></div>
      <div class="meta-info">
        <input type="text" inputmode="decimal" step="0.01" class="meta-guardado" data-id="${m.id}" data-action="meta-guardado" value="${guardado}">
        <span>/</span>
        <input type="text" inputmode="decimal" step="0.01" class="meta-alvo" data-id="${m.id}" data-action="meta-alvo" value="${alvo}">
        ${dataTxt?`<span class="meta-data">${esc(dataTxt)}</span>`:''}
      </div>
      ${m.aporteMensal>0?`<div class="meta-auto-aporte">🔄 ${L('meta.aporteAutomatico')} ${formatBRL(m.aporteMensal)}${L('meta.porMes')}</div>`:''}
      ${sugestaoHtml}
    </div>`;
  }

  let html='';
  if(all.length===0){
    html=`<div class="empty-illus"><span class="ei-icon">🎯</span>${L('empty.nenhumaMeta')}<br>${L('empty.crieAPrimeira')}</div>`;
  } else {
    html+=ativas.map(m=>metaCard(m,false)).join('');
    if(concluidas.length>0){
      html+=`<div class="meta-section-label">${L('meta.concluidas')}</div>`;
      html+=concluidas.map(m=>metaCard(m,true)).join('');
    }
  }
  el.innerHTML=html;

  // celebração sutil quando uma meta chega a 100% durante a sessão
  all.forEach(m=>{
    const done=(m.valorAlvo||0)>0&&(m.valorGuardado||0)>=(m.valorAlvo||0);
    const antes=_metaDoneState[m.id];
    _metaDoneState[m.id]=done;
    if(done&&antes===false&&!_metaFirstRender){
      const inp=el.querySelector(`.meta-nome[data-id="${m.id}"]`);
      celebrateMeta(inp?inp.closest('.meta-row'):null);
    }
  });
  _metaFirstRender=false;

  renderMetaWarning();

  el.querySelectorAll('[data-action="meta-nome"]').forEach(x=>x.addEventListener('change',async e=>{
    const m=(data.metas||[]).find(x=>x.id===e.target.getAttribute('data-id'));
    if(m){ m.nome=e.target.value; await persist(); }
  }));
  el.querySelectorAll('[data-action="meta-guardado"]').forEach(x=>x.addEventListener('change',async e=>{
    const m=(data.metas||[]).find(x=>x.id===e.target.getAttribute('data-id'));
    if(m){ m.valorGuardado=parseNum(e.target.value)||0; await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="meta-alvo"]').forEach(x=>x.addEventListener('change',async e=>{
    const m=(data.metas||[]).find(x=>x.id===e.target.getAttribute('data-id'));
    if(m){ m.valorAlvo=parseNum(e.target.value)||0; await persist(); render(); }
  }));
  el.querySelectorAll('[data-action="meta-del"]').forEach(x=>x.addEventListener('click',async e=>{
    const id=e.target.closest('[data-id]').getAttribute('data-id');
    const idx=(data.metas||[]).findIndex(m=>m.id===id); if(idx<0) return;
    const removedNome=data.metas[idx].nome;
    if(!(await confirmDialog({text:L('confirm.removerMeta').replace('{nome}',removedNome)}))) return;
    const removed=data.metas.splice(idx,1)[0];
    vibrate(15); render();
    showUndoToast(L('undo.removida').replace('{nome}',removed.nome),()=>{ data.metas.splice(Math.min(idx,data.metas.length),0,removed); });
  }));
}

