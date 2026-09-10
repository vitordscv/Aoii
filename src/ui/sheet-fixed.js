/* ─── bottom sheet "Novo gasto fixo" — aba Fixos ─── */
let _openGastoFixoSheet=null;
function openGastoFixoSheet(id){ if(_openGastoFixoSheet) _openGastoFixoSheet(id); }

function setupGastoFixoSheet(){
  const backdrop=document.getElementById('gf-sheet-backdrop');
  const sheet=document.getElementById('gf-sheet');
  const cancelBtn=document.getElementById('gf-sheet-cancel');
  const delBtn=document.getElementById('gf-sheet-cancel-del');
  const submitBtn=document.getElementById('gf-sheet-submit');
  const titleEl=document.getElementById('gf-sheet-title');
  if(!backdrop||!sheet) return;

  let categoriaAtual=null;
  let editingId=null;

  const mesSel=document.getElementById('gf-inicio-mes');
  mesSel.innerHTML=MONTH_NAMES.map((nm,i)=>`<option value="${i+1}">${nm}</option>`).join('');
  const anoSel=document.getElementById('gf-inicio-ano');
  const anoBase=new Date().getFullYear();
  anoSel.innerHTML=[anoBase-1,anoBase,anoBase+1,anoBase+2].map(a=>`<option value="${a}">${a}</option>`).join('');

  function renderCatGrid(){
    const grid=document.getElementById('gf-cat-grid');
    grid.innerHTML=CATS().map(c=>`<button type="button" class="cat-pill${c===categoriaAtual?' active':''}" aria-pressed="${c===categoriaAtual}" data-cat="${esc(c)}">${catIcon(c)} ${esc(categoriaLabel(c))}</button>`).join('');
    grid.querySelectorAll('.cat-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{ categoriaAtual=btn.getAttribute('data-cat'); renderCatGrid(); });
    });
  }

  function resetForm(g){
    const hoje=new Date();
    editingId=g?g.id:null;
    categoriaAtual=g?(g.categoria||CATS()[0]):CATS()[0];
    titleEl.textContent=g?L('gf.editar'):L('sheet.novogastofixo');
    document.getElementById('gf-valor').value=g?g.valor:'';
    document.getElementById('gf-nome').value=g?g.nome:'';
    document.getElementById('gf-dia').value=g?g.diaDoMes:'';
    mesSel.value=g&&g.inicioMes?g.inicioMes:(hoje.getMonth()+1);
    anoSel.value=g&&g.inicioAno?g.inicioAno:hoje.getFullYear();
    document.getElementById('gf-ativo').checked=g?g.ativo!==false:true;
    const marcaCartao=document.getElementById('gf-cartao');
    const selCartao=document.getElementById('gf-cartao-select');
    const qualCartao=document.getElementById('gf-cartao-qual');
    marcaCartao.checked=!!(g&&g.cartao);
    selCartao.innerHTML=(data.cartoes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    if(g&&g.cartaoId) selCartao.value=g.cartaoId;
    /* com um cartão só não há o que escolher; com nenhum, nem marcar faz sentido */
    const mostrarQual=()=>{ qualCartao.hidden=!(marcaCartao.checked&&(data.cartoes||[]).length>1); };
    mostrarQual();
    marcaCartao.onchange=mostrarQual;
    delBtn.style.display=g?'block':'none';
    renderCatGrid();
  }

  function open(id){
    const g=id?(data.gastosMensais||[]).find(x=>x.id===id):null;
    resetForm(g);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,document.getElementById('gf-valor'),close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openGastoFixoSheet=open;

  document.getElementById('gf-new-btn')?.addEventListener('click',()=>open(null));
  document.getElementById('gf-empty-add-link')?.addEventListener('click',()=>open(null));
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheet.style.display==='block') close(); });

  delBtn.addEventListener('click',async()=>{
    if(!editingId) return;
    if(!removerGastoFixo(editingId)) return;
    await persist(); render();
    close();
  });

  submitBtn.addEventListener('click',async()=>{
    const valor=parseNum(document.getElementById('gf-valor').value);
    if(isNaN(valor)||valor<=0){ document.getElementById('gf-valor').focus(); return; }
    const nome=document.getElementById('gf-nome').value.trim()||(categoriaAtual||'Outros');
    const dia=Math.min(31,Math.max(1,parseInt(document.getElementById('gf-dia').value,10)||10));
    const inicioMes=parseInt(mesSel.value,10);
    const inicioAno=parseInt(anoSel.value,10);
    const ativo=document.getElementById('gf-ativo').checked;
    const categoria=categoriaAtual||'Outros';

    const noCartao=document.getElementById('gf-cartao').checked;
    const qualCartaoId=document.getElementById('gf-cartao-select').value||null;
    const campos={nome,valor,diaDoMes:dia,categoria,ativo,inicioAno,inicioMes,
                  cartao:noCartao,cartaoId:noCartao?qualCartaoId:null};
    const salvo=editingId?atualizarGastoFixo(editingId,campos):criarGastoFixo(campos);
    if(!salvo) return;
    await persist(); render();
    close();
  });

  document.getElementById('gf-expand-toggle')?.addEventListener('click',()=>{
    gfExpandAll=!gfExpandAll;
    document.getElementById('gf-expand-toggle').textContent=L(gfExpandAll?'main.recolherTudo':'main.expandirTudo');
    renderGastosFixosTab();
  });
}
