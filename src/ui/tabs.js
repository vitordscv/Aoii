/* ─── abas de verdade: mostra uma view por vez, sem scroll ─── */
function setupBottomNav(){
  const items=document.querySelectorAll('.bn-item');
  if(!items.length) return;
  const views=document.querySelectorAll('.tab-view');
  function showTab(id){
    views.forEach(v=>{ v.style.display = (v.id===id)?'':'none'; });
    items.forEach(a=>a.classList.toggle('active', a.getAttribute('data-target')===id));
    try{ localStorage.setItem('financas-last-tab', id); }catch(e){}
    window.scrollTo({top:0,behavior:'instant' in window ? 'instant' : 'auto'});
    const fab=document.getElementById('gasto-fab');
    if(fab) fab.classList.toggle('visible', id==='view-diario' || id==='view-resumo');
    positionGastoFab();
    vibrate(6);
    const view=document.getElementById(id);
    if(view) animateBars(view);
  }
  items.forEach(a=>{
    a.addEventListener('click',()=>showTab(a.getAttribute('data-target')));
  });
  let start='view-resumo';
  try{ const saved=localStorage.getItem('financas-last-tab'); if(saved && document.getElementById(saved)) start=saved; }catch(e){}
  showTab(start);
  positionGastoFab();
}

