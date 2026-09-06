/* Service worker do Aoii.
   O index.html já registrava 'sw.js', mas o arquivo não existia — a
   chamada falhava calada e o app nunca funcionou de verdade offline.

   Estratégia:
   - navegação (o próprio index.html): REDE PRIMEIRO, cache como reserva.
     Isso é importante: o app tem um verificador de atualização que compara
     o ETag do arquivo publicado. Se o service worker servisse o cache
     primeiro, o verificador veria versão nova, recarregaria, receberia o
     cache velho de novo e entraria em laço.
   - fontes do Google: CACHE PRIMEIRO, porque não mudam.
   - qualquer outra coisa: passa direto, sem interferir. */

const VERSAO='aoii-v1';
const CACHE_PAGINA=VERSAO+'-pagina';
const CACHE_FONTES=VERSAO+'-fontes';

self.addEventListener('install',e=>{ self.skipWaiting(); });

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const nomes=await caches.keys();
    await Promise.all(nomes.filter(n=>!n.startsWith(VERSAO)).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  /* a página em si */
  if(req.mode==='navigate'||(req.destination==='document')){
    e.respondWith((async()=>{
      try{
        const res=await fetch(req);
        if(res&&res.ok){
          const c=await caches.open(CACHE_PAGINA);
          c.put('/', res.clone());          // guarda uma cópia pra quando faltar rede
        }
        return res;
      }catch(err){
        const c=await caches.open(CACHE_PAGINA);
        const guardado=await c.match('/');
        if(guardado) return guardado;
        throw err;
      }
    })());
    return;
  }

  /* fontes do Google: não mudam, vale guardar */
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE_FONTES);
      const guardado=await c.match(req);
      if(guardado) return guardado;
      try{
        const res=await fetch(req);
        if(res&&(res.ok||res.type==='opaque')) c.put(req,res.clone());
        return res;
      }catch(err){
        if(guardado) return guardado;
        throw err;
      }
    })());
  }
  /* o resto (Supabase, Gemini, BrasilAPI) passa direto, sem cache */
});
