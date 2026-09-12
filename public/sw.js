/* Shell offline do Aoii. A versão é inserida pelo build a partir do conteúdo. */
const VERSAO='__AOII_BUILD_VERSION__';
const CACHE_SHELL=VERSAO+'-shell';
const CACHE_FONTES=VERSAO+'-fontes';
const SHELL=[
  '/',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/logo-128.png',
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_SHELL).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const nomes=await caches.keys();
    await Promise.all(nomes.filter(nome=>nome.startsWith('aoii-')&&!nome.startsWith(VERSAO)).map(nome=>caches.delete(nome)));
    await self.clients.claim();
  })());
});

/* O que identifica uma publicação sem ler o corpo. Quando o servidor manda
   ETag, é uma comparação de duas palavras. */
function assinatura(res){
  if(!res) return null;
  const h=res.headers;
  return h.get('etag')||h.get('last-modified')||h.get('content-length')||null;
}

/* Nem todo servidor manda cabeçalho de versão — o de desenvolvimento deste
   projeto não manda nenhum dos três, e responde `Cache-Control: no-store`. Se
   a comparação parasse aí, o aviso nunca sairia e a pessoa ficaria presa numa
   versão antiga para sempre, sem jeito de sair. Então, sem assinatura, compara
   o conteúdo: ele já foi baixado, e a conta roda uma vez por abertura. */
async function ehOutraPublicacao(salvo,novo){
  const a=assinatura(salvo), b=assinatura(novo);
  if(a&&b) return a!==b;
  const [textoSalvo,textoNovo]=await Promise.all([salvo.text(),novo.clone().text()]);
  return textoSalvo!==textoNovo;
}

async function avisarVersaoNova(){
  const clientes=await self.clients.matchAll({type:'window'});
  clientes.forEach(c=>c.postMessage({tipo:'aoii-versao-nova',versao:VERSAO}));
}

/* ── A página: responde do cache e revalida por trás ──────────────────────

   Era rede-primeiro. Isso fazia toda abertura esperar o download inteiro
   antes de desenhar qualquer coisa — e baixar 1,2 MB de novo mesmo com a
   cópia salva, mesmo sem nada ter mudado. Com uma abertura por dia, cerca de
   11 MB por mês de dados móveis gastos com um arquivo idêntico.

   Agora o cache responde na hora e a rede corre atrás. Quando a resposta nova
   é de outra publicação, o cache é trocado e a página é avisada — ela decide
   quando recarregar, em `setupAutoUpdate()`. É o aviso que evita a corrida:
   recarregar antes de a revalidação terminar traria a versão velha de novo, e
   o laço se repetiria. */
async function cacheERevalida(event){
  const cache=await caches.open(CACHE_SHELL);
  const salvo=await cache.match('/');

  const daRede=fetch(event.request).then(async res=>{
    if(!res||!res.ok) return res;
    /* Uma leitura NOVA do cache, e nao um clone da resposta que ja foi
       devolvida a pagina. `clone()` divide um stream so em dois ramos: a
       pagina le um, esta comparacao leria o outro segundos depois, e com 1,2 MB
       o buffer entre eles enche e a leitura da pagina TRAVA — o app ficava em
       branco. `match()` devolve uma resposta independente, sem ramo nenhum. */
    const antigo=await cache.match('/');
    const trocou=antigo?await ehOutraPublicacao(antigo,res):false;
    await cache.put('/',res.clone());
    if(trocou) await avisarVersaoNova();
    return res;
  }).catch(()=>null);

  if(salvo){
    /* `waitUntil` e o que segura o worker vivo: respondido o pedido, o
       navegador pode encerrar o service worker a qualquer momento, e a
       revalidacao morreria pela metade — o cache nunca trocaria e o aviso
       nunca sairia. */
    event.waitUntil(daRede);
    return salvo;
  }
  const res=await daRede;
  if(res) return res;
  throw new Error('sem rede e sem copia salva');
}

async function cachePrimeiro(request,cacheName){
  const cache=await caches.open(cacheName);
  const salvo=await cache.match(request);
  if(salvo) return salvo;
  const response=await fetch(request);
  if(response&&(response.ok||response.type==='opaque')) await cache.put(request,response.clone());
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  const ehNavegacao=request.mode==='navigate'||request.destination==='document';
  /* Navegacao nao quer dizer "a pagina do app": a fita de cotacoes roda num
     iframe, e um iframe navega. O tratamento antigo respondia a ela com o
     index inteiro e, pior, GRAVAVA a fita sob a chave '/' — o cache da pagina
     passava a conter 3 KB de ticker, e era isso que aparecia offline. Com
     rede-primeiro o estrago ficava escondido, porque a pagina certa sempre
     vinha da rede. */
  const ehAPagina=ehNavegacao&&url.origin===self.location.origin&&(url.pathname==='/'||url.pathname==='/index.html');
  if(ehAPagina){
    event.respondWith(cacheERevalida(event));
    return;
  }
  if(ehNavegacao&&url.origin===self.location.origin){
    event.respondWith(cachePrimeiro(request,CACHE_SHELL));
    return;
  }
  if(url.origin===self.location.origin&&(url.pathname==='/manifest.webmanifest'||url.pathname.startsWith('/assets/'))){
    event.respondWith(cachePrimeiro(request,CACHE_SHELL));
    return;
  }
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    event.respondWith(cachePrimeiro(request,CACHE_FONTES));
  }
  /* Supabase, Gemini e BrasilAPI continuam fora do cache. */
});
