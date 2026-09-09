/* ── lista e sheet das rendas recorrentes ── */
function renderRendas(){
  const listEl=document.getElementById('rr-list');
  const totalEl=document.getElementById('rr-total');
  if(!listEl) return;
  const all=data.rendasRecorrentes||[];
  const totalAtivo=rendasRecorrentesAtivas().reduce((s,r)=>s+r.valor,0);
  if(totalEl) totalEl.textContent=formatBRL(totalAtivo);
  if(all.length===0){
    listEl.innerHTML=`<div class="empty-illus"><span class="ei-icon">💼</span>${L('rr.nenhuma')}<br>${L('rr.adicionePrimeira')}</div>`;
    return;
  }
  listEl.innerHTML=all.map(r=>{
    const t=tipoRenda(r.tipo);
    const pausada=r.ativo===false;
    return `
    <div class="swipe-item" data-id="${r.id}">
      <div class="swipe-actions">
        <button type="button" class="swipe-act-edit" title="${esc(L('btn.editar'))}" aria-label="${esc(L('a11y.editItem').replace('{name}',r.nome||t.label))}">✏️</button>
        <button type="button" class="swipe-act-del" title="${esc(L('btn.excluir'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',r.nome||t.label))}">🗑</button>
      </div>
      <div class="swipe-content">
        <div class="gf-item-row${pausada?' paused':''}" data-rr-id="${r.id}" style="border-top:none;border-bottom:1px solid var(--line);">
          <div class="gf-item-main">
            <div class="gf-item-nome">${t.icon} ${esc(r.nome||t.label)}</div>
            <div class="inv-item-sub">${esc(t.label)} · ${L('rr.fallsDay').replace('{day}',r.diaDoMes)}</div>
            <span class="rr-tag${pausada?' pausada':''}">${pausada?'⏸ '+L('rr.paused'):'↻ '+L('rr.recurring')}</span>
          </div>
          <div class="gf-item-valor">${formatBRL(r.valor)}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  listEl.querySelectorAll('.swipe-item').forEach(item=>{
    const id=item.getAttribute('data-id');
    attachSwipe(item,{
      onEdit:()=>openRRSheet(id),
      onDelete:()=>{
        const idx=(data.rendasRecorrentes||[]).findIndex(r=>r.id===id); if(idx<0) return;
        const removed=data.rendasRecorrentes.splice(idx,1)[0];
        vibrate(15); render();
        showUndoToast(L('undo.removida').replace('{nome}',removed.nome||tipoRenda(removed.tipo).label),()=>{
          data.rendasRecorrentes.splice(Math.min(idx,data.rendasRecorrentes.length),0,removed);
        });
      },
    });
    const row=item.querySelector('[data-rr-id]');
    if(row) ativarComoBotao(row,()=>openRRSheet(id),L('a11y.editItem').replace('{name}',row.querySelector('.gf-item-nome')?.textContent||''));
  });
}

let _openRRSheet=null;
function openRRSheet(id){ if(_openRRSheet) _openRRSheet(id); }
function setupRRSheet(){
  const backdrop=document.getElementById('rr-sheet-backdrop');
  const sheet=document.getElementById('rr-sheet');
  if(!backdrop||!sheet) return;
  const cancelBtn=document.getElementById('rr-sheet-cancel');
  const delBtn=document.getElementById('rr-sheet-del');
  const submitBtn=document.getElementById('rr-sheet-submit');
  const titleEl=document.getElementById('rr-sheet-title');
  let tipoAtual='clt';
  let editingId=null;

  function renderTipoGrid(){
    const grid=document.getElementById('rr-tipo-grid');
    grid.innerHTML=TIPOS_RENDA.map(t=>`<button type="button" class="cat-pill${t.id===tipoAtual?' active':''}" aria-pressed="${t.id===tipoAtual}" data-tipo="${t.id}">${t.icon} ${esc(t.label)}</button>`).join('');
    grid.querySelectorAll('.cat-pill').forEach(btn=>btn.addEventListener('click',()=>{
      tipoAtual=btn.getAttribute('data-tipo'); vibrate(6); renderTipoGrid();
    }));
  }
  function resetForm(r){
    editingId=r?r.id:null;
    tipoAtual=r?r.tipo:'clt';
    titleEl.textContent=r?L('rr.editar'):L('sheet.novarendaBtn').replace('+ ','');
    document.getElementById('rr-valor').value=r?r.valor:'';
    document.getElementById('rr-nome').value=r?(r.nome||''):'';
    document.getElementById('rr-dia').value=r?r.diaDoMes:'';
    document.getElementById('rr-ativo').checked=r?r.ativo!==false:true;
    delBtn.style.display=r?'block':'none';
    renderTipoGrid();
  }
  function open(id){
    const r=id?(data.rendasRecorrentes||[]).find(x=>x.id===id):null;
    resetForm(r);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,document.getElementById('rr-valor'),close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openRRSheet=open;
  const newBtn=document.getElementById('rr-new-btn');
  if(newBtn) newBtn.addEventListener('click',()=>{ vibrate(8); open(null); });
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&sheet.style.display==='block') close(); });
  delBtn.addEventListener('click',()=>{
    if(!editingId) return;
    const id=editingId;
    close();
    const idx=(data.rendasRecorrentes||[]).findIndex(r=>r.id===id); if(idx<0) return;
    const removed=data.rendasRecorrentes.splice(idx,1)[0];
    vibrate(15); render();
    showUndoToast(L('undo.removida').replace('{nome}',removed.nome||tipoRenda(removed.tipo).label),()=>{
      data.rendasRecorrentes.splice(Math.min(idx,data.rendasRecorrentes.length),0,removed);
    });
  });
  submitBtn.addEventListener('click',async()=>{
    const valor=parseNum(document.getElementById('rr-valor').value);
    if(isNaN(valor)||valor<=0){ document.getElementById('rr-valor').focus(); return; }
    let dia=parseInt(document.getElementById('rr-dia').value,10);
    if(isNaN(dia)||dia<1){ document.getElementById('rr-dia').focus(); return; }
    dia=Math.min(31,dia);
    const nome=document.getElementById('rr-nome').value.trim();
    const ativo=document.getElementById('rr-ativo').checked;
    if(!data.rendasRecorrentes) data.rendasRecorrentes=[];
    if(editingId){
      const r=data.rendasRecorrentes.find(x=>x.id===editingId);
      if(r) Object.assign(r,{tipo:tipoAtual,nome,valor,diaDoMes:dia,ativo});
    }else{
      data.rendasRecorrentes.push({id:uid(),tipo:tipoAtual,nome,valor,diaDoMes:dia,ativo,criadoEm:new Date().toISOString()});
    }
    vibrate([10,30,10]);
    await persist(); render();
    close();
  });
}
