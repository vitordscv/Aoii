/* ─── modal de configurações (acionado pelo ícone do topbar) ─── */
function setupSettingsModal(){
  const fab=document.getElementById('topbar-settings-btn');
  const panel=document.getElementById('settings-panel');
  const backdrop=document.getElementById('settings-backdrop');
  const closeBtn=document.getElementById('settings-close-btn');
  if(!fab||!panel||!backdrop) return;
  let restaurar=null;
  function open(){
    panel.classList.remove('closing'); backdrop.classList.remove('closing');
    panel.style.display='block'; backdrop.style.display='block';
    restaurar=ativarDialogo(panel,backdrop,closeBtn,close);
  }
  function close(){
    if(panel.style.display!=='block') return;
    panel.classList.add('closing'); backdrop.classList.add('closing');
    let concluiu=false;
    const done=()=>{
      if(concluiu) return;
      concluiu=true;
      panel.style.display='none'; backdrop.style.display='none';
      panel.classList.remove('closing'); backdrop.classList.remove('closing');
      panel.removeEventListener('animationend',done);
      if(restaurar){ restaurar(); restaurar=null; }
    };
    panel.addEventListener('animationend',done,{once:true});
    // fallback caso o evento não dispare por algum motivo
    setTimeout(done,260);
  }
  fab.addEventListener('click',open);
  closeBtn?.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&panel.style.display==='block') close(); });
}
