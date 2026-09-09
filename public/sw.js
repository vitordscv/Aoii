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

async function redePrimeiro(request){
  try{
    const response=await fetch(request);
    if(response&&response.ok){
      const cache=await caches.open(CACHE_SHELL);
      await cache.put('/',response.clone());
    }
    return response;
  }catch(error){
    const salvo=await caches.match('/');
    if(salvo) return salvo;
    throw error;
  }
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
  if(request.mode==='navigate'||request.destination==='document'){
    event.respondWith(redePrimeiro(request));
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
