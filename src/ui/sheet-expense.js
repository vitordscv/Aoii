/* ─── bottom sheet "Novo gasto" — acionado pelo + no Diário e no Resumo ─── */
/* ─── arrastar a alça pra baixo fecha o bottom sheet (funciona com touch e mouse) ─── */
/* fecha qualquer bottom sheet com a animação padrão (usado por todos os sheets) */
function closeSheetWithAnim(sheet,backdrop){
    backdrop.classList.add('closing'); sheet.classList.add('closing');
    const done=()=>{
      backdrop.style.display='none'; sheet.style.display='none';
      backdrop.classList.remove('closing'); sheet.classList.remove('closing');
      sheet.removeEventListener('animationend',done);
      desativarSheet(sheet);
    };
    sheet.addEventListener('animationend',done,{once:true});
    setTimeout(done,260);
}

function attachSheetDragToClose(sheet,backdrop,handle){
  const grabZone=sheet.querySelector('[data-sheet-grab]')||handle;
  if(!grabZone) return;
  const titleZone=sheet.querySelector('.sheet-title');
  const THRESHOLD=80;
  let startY=0,dy=0,dragging=false;

  function onDown(e){
    dragging=true; startY=e.clientY; dy=0;
    sheet.classList.add('dragging'); backdrop.classList.add('dragging');
    grabZone.setPointerCapture?.(e.pointerId);
  }
  function onMove(e){
    if(!dragging) return;
    dy=Math.max(0,e.clientY-startY);
    sheet.style.transform=`translateY(${dy}px)`;
    backdrop.style.opacity=String(Math.max(0,1-dy/400));
  }
  function onUp(){
    if(!dragging) return;
    dragging=false;
    sheet.classList.remove('dragging'); backdrop.classList.remove('dragging');
    if(dy>THRESHOLD){
      sheet.style.transform='translateY(100%)';
      backdrop.style.opacity='0';
      setTimeout(()=>{
        sheet.style.display='none'; backdrop.style.display='none';
        sheet.style.transform=''; backdrop.style.opacity='';
        sheet.classList.remove('closing'); backdrop.classList.remove('closing');
        desativarSheet(sheet);
      },260);
    }else{
      sheet.style.transform='';
      backdrop.style.opacity='';
    }
    dy=0;
  }
  grabZone.addEventListener('pointerdown',onDown);
  grabZone.addEventListener('pointermove',onMove);
  grabZone.addEventListener('pointerup',onUp);
  grabZone.addEventListener('pointercancel',onUp);
  if(titleZone){
    titleZone.style.touchAction='none';
    titleZone.style.cursor='grab';
    titleZone.addEventListener('pointerdown',onDown);
    titleZone.addEventListener('pointermove',onMove);
    titleZone.addEventListener('pointerup',onUp);
    titleZone.addEventListener('pointercancel',onUp);
  }
}
