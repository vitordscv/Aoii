/* ─── checa se tem versão nova publicada e recarrega sozinho ─── */
function setupAutoUpdate(){
  const url=location.href.split('#')[0].split('?')[0];
  let assinatura=null, checking=false;

  /* A versao que ESTA NA TELA, carimbada no HTML pelo build. */
  function versaoLocal(){
    const m=document.querySelector('meta[name="aoii-versao"]');
    return m?m.getAttribute('content'):null;
  }

  /* A versao que esta PUBLICADA, lida dos primeiros bytes. O carimbo fica no
     comeco do <head> justamente pra caber num pedido de 4 KB: a pagina inteira
     tem 1,3 MB, e sondar isso a cada volta de aba seria absurdo.

     Devolve undefined quando nao deu pra saber (sem rede, servidor sem Range,
     resposta sem carimbo) — que e diferente de "nao mudou". */
  async function versaoPublicada(){
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),8000);
    try{
      const res=await fetch(url+'?_v='+Date.now(),
        {cache:'no-store',signal:ctrl.signal,headers:{Range:'bytes=0-4095'}});
      /* 206 e o pedaco pedido. 200 significa que o servidor ignorou o Range e
         vai mandar tudo — a abortamos, pra nao torrar 1,3 MB de dados moveis
         numa sondagem. */
      if(res.status!==206){ ctrl.abort(); return undefined; }
      const texto=await res.text();
      const m=texto.match(/name="aoii-versao" content="([^"]+)"/);
      return m?m[1]:undefined;
    }catch(e){ return undefined; }
    finally{ clearTimeout(t); }
  }

  /* O jeito antigo, guardado pra quando o Range nao serve. Vale menos: ele so
     sabe que a assinatura MUDOU desde a primeira leitura desta sessao, nao se
     a tela esta velha. */
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
    return !document.querySelector('.bottom-sheet[style*="block"], .modal-backdrop[style*="block"], .calendar-dialog:not([hidden]), .tour-callout');
  }

  /* Quem vai recarregar quando puder. Fica pendente se a pessoa esta digitando
     ou com uma folha aberta: trocar a pagina debaixo da mao e pior do que
     esperar mais um minuto. */
  let esperandoTrocarDeVersao=false, vigia=null;
  function recarregarQuandoDer(){
    esperandoTrocarDeVersao=true;
    if(podeRecarregar()){ location.reload(); return; }
    /* Nao deu agora — tem folha aberta, ou alguem esta digitando. Sem isto, a
       proxima tentativa so viria na troca de aba: quem fecha a folha e continua
       na pagina ficava com a versao antiga na tela por tempo indefinido, sem
       nada indicando que havia outra esperando. */
    if(vigia) return;
    vigia=setInterval(()=>{
      if(!podeRecarregar()) return;
      clearInterval(vigia); vigia=null;
      location.reload();
    },2000);
  }

  /* ANTES: a primeira leitura so guardava a assinatura remota e seguia. Se o
     navegador tivesse servido um HTML velho do cache dele — e serve, com
     `max-age` de dez minutos no GitHub Pages — o app anotava a assinatura NOVA
     como se fosse a sua e nunca mais recarregava. Ficava preso na versao
     antiga por sessao inteira, sem nada na tela dizendo isso. Foi assim que
     uma correcao publicada e conferida no ar continuou sem chegar em quem usa.

     AGORA a comparacao e entre a versao da tela e a versao publicada, que nao
     depende de quando esta sessao comecou. A assinatura so entra quando o
     carimbo nao da pra ler. */
  async function checkForUpdate(){
    if(checking||document.visibilityState!=='visible') return;
    checking=true;
    try{
      const daTela=versaoLocal();
      if(daTela){
        const noAr=await versaoPublicada();
        if(noAr){ if(noAr!==daTela) recarregarQuandoDer(); return; }
      }
      const nova=await assinaturaRemota();
      if(nova){
        if(assinatura===null) assinatura=nova;
        else if(nova!==assinatura) recarregarQuandoDer();
      }
    } finally { checking=false; }
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

