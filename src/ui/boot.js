/* ─── checa se tem versão nova publicada e recarrega sozinho ─── */
function setupAutoUpdate(){
  const url=location.href.split('#')[0].split('?')[0];
  let assinatura=null, checking=false;

  /* assinatura do arquivo publicado, sem baixar o corpo */
  async function assinaturaRemota(){
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),8000);
    try{
      const res=await fetch(url+'?_v='+Date.now(),{method:'HEAD',cache:'no-store',signal:ctrl.signal});
      if(!res.ok) return null;
      return res.headers.get('etag')||res.headers.get('last-modified')||res.headers.get('content-length')||null;
    }catch(e){ return null; }
    finally{ clearTimeout(t); }
  }

  /* não recarrega por cima de quem está digitando ou com uma folha aberta */
  function podeRecarregar(){
    const a=document.activeElement;
    if(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    return !document.querySelector('.bottom-sheet[style*="block"], .modal-backdrop[style*="block"], .tour-callout');
  }

  async function checkForUpdate(){
    if(checking||document.visibilityState!=='visible') return;
    checking=true;
    const nova=await assinaturaRemota();
    if(nova){
      if(assinatura===null) assinatura=nova;          // primeira leitura: só guarda
      else if(nova!==assinatura&&podeRecarregar()) location.reload();
    }
    checking=false;
  }
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') checkForUpdate(); });
  window.addEventListener('pageshow',checkForUpdate);
  if('requestIdleCallback' in window) requestIdleCallback(checkForUpdate,{timeout:4000});
  else setTimeout(checkForUpdate,2000);
  setInterval(checkForUpdate,15*60*1000);   // de 1 em 1 minuto era exagero
}
init();

