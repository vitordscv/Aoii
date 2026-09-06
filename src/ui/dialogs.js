/* ── janela de confirmação estilizada (no lugar do confirm nativo) ── */
function confirmDialog(opts){
  return new Promise(resolve=>{
    const bd=document.getElementById('confirm-backdrop');
    const dg=document.getElementById('confirm-dialog');
    if(!bd||!dg){ resolve(window.confirm(opts.text||L('cd.temCerteza'))); return; }
    document.getElementById('confirm-title').textContent=opts.title||L('cd.temCerteza');
    document.getElementById('confirm-text').textContent=opts.text||'';
    const okBtn=document.getElementById('confirm-ok');
    const cancelBtn=document.getElementById('confirm-cancel');
    okBtn.textContent=opts.okLabel||'Confirmar';
    bd.style.display='block'; dg.style.display='block';
    vibrate(8);
    function done(v){
      bd.style.display='none'; dg.style.display='none';
      okBtn.removeEventListener('click',ok);
      cancelBtn.removeEventListener('click',no);
      bd.removeEventListener('click',no);
      resolve(v);
    }
    function ok(){ done(true); }
    function no(){ done(false); }
    okBtn.addEventListener('click',ok);
    cancelBtn.addEventListener('click',no);
    bd.addEventListener('click',no);
  });
}

/* ── janela de aviso estilizada (no lugar do alert nativo) ── */
function alertDialog(text,title){
  return new Promise(resolve=>{
    const bd=document.getElementById('confirm-backdrop');
    const dg=document.getElementById('confirm-dialog');
    if(!bd||!dg){ window.alert(text); resolve(); return; }
    document.getElementById('confirm-title').textContent=title||L('cd.aviso');
    document.getElementById('confirm-text').textContent=text||'';
    const okBtn=document.getElementById('confirm-ok');
    const cancelBtn=document.getElementById('confirm-cancel');
    okBtn.textContent=L('btn.ok');
    cancelBtn.style.display='none';
    bd.style.display='block'; dg.style.display='block';
    vibrate(8);
    function done(){
      bd.style.display='none'; dg.style.display='none';
      cancelBtn.style.display='';
      okBtn.removeEventListener('click',ok);
      bd.removeEventListener('click',ok);
      resolve();
    }
    function ok(){ done(); }
    okBtn.addEventListener('click',ok);
    bd.addEventListener('click',ok);
  });
}

/* ── editar transação lançada (reusa o bottom sheet de gasto) ── */
let _openGastoEdit=null;
function openGastoEditSheet(id){ if(_openGastoEdit) _openGastoEdit(id); }

