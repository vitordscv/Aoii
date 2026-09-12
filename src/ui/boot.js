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

  /* Quem vai recarregar quando puder. Fica pendente se a pessoa esta digitando
     ou com uma folha aberta: trocar a pagina debaixo da mao e pior do que
     esperar mais um minuto. */
  let esperandoTrocarDeVersao=false;
  function recarregarQuandoDer(){
    esperandoTrocarDeVersao=true;
    if(podeRecarregar()) location.reload();
  }

  async function checkForUpdate(){
    if(checking||document.visibilityState!=='visible') return;
    checking=true;
    const nova=await assinaturaRemota();
    if(nova){
      if(assinatura===null) assinatura=nova;          // primeira leitura: só guarda
      else if(nova!==assinatura) recarregarQuandoDer();
    }
    checking=false;
  }

  /* Com o service worker no comando, quem sabe que chegou versao nova e ele:
     serve a copia salva na hora e revalida por tras. Sondar por HEAD daqui
     veria a publicacao nova ANTES de o cache ter trocado, recarregaria, o
     cache velho responderia de novo, e o laco nao terminaria. Entao: com SW,
     escuta o aviso; sem SW, sonda como antes. */
  const temServiceWorker='serviceWorker' in navigator&&navigator.serviceWorker.controller;
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message',ev=>{
      /* a mensagem vai pra uma variavel antes de ser lida: `data` e o nome do
         objeto financeiro do app, e o lint de campos persistidos toma qualquer
         acesso a um campo dele como campo novo — inclusive aqui, onde o objeto
         e o do evento, nao o do app */
      const aviso=ev.data;
      if(aviso&&aviso.tipo==='aoii-versao-nova') recarregarQuandoDer();
    });
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible') return;
    if(esperandoTrocarDeVersao) recarregarQuandoDer();
    else if(!temServiceWorker) checkForUpdate();
  });
  if(!temServiceWorker){
    window.addEventListener('pageshow',checkForUpdate);
    if('requestIdleCallback' in window) requestIdleCallback(checkForUpdate,{timeout:4000});
    else setTimeout(checkForUpdate,2000);
    setInterval(checkForUpdate,15*60*1000);   // de 1 em 1 minuto era exagero
  }
}
init();

