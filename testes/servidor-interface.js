#!/usr/bin/env node
/* Ensaio manual da interface, duas origens com armazenamento independente.
   node testes/servidor-interface.js
   Abra http://localhost:4173 e http://localhost:4174. Só dados fictícios.
   Toda RPC passa pela lista permitida abaixo; produção é bloqueada por CSP.
   /controle?lento=1 atrasa PUT 5 s; /controle?offline=1 simula indisponibilidade.
   /evidencias mostra somente método, função, código de teste, status e horário.
   /limpar remove exclusivamente os registros criados por este processo. */
const http=require('http'),fs=require('fs'),path=require('path');
const raiz=path.resolve(__dirname,'..');
const cfg=fs.readFileSync(path.join(raiz,'src/storage/supabase-config.js'),'utf8');
const base=/const SUPABASE_URL = '([^']+)'/.exec(cfg)[1];
const chave=/const SUPABASE_ANON_KEY = '([^']+)'/.exec(cfg)[1];
const codigo='UI'+require('crypto').randomBytes(5).toString('hex').toUpperCase();
const permitidas=new Set(['aoii_get_homolog','aoii_put_homolog']);
const codigoLegado=codigo+'LEG';
const ids=new Set([codigo,codigoLegado]),evidencias=[];
const modos=new Map();
const headers={apikey:chave,Authorization:'Bearer '+chave,'Content-Type':'application/json'};
function responder(res,status,tipo,texto){res.writeHead(status,{'Content-Type':tipo,'Cache-Control':'no-store'});res.end(texto);}
async function atender(req,res){
  const url=new URL(req.url,'http://localhost'),porta=req.socket.localPort;
  const modo=modos.get(porta);
  if(url.pathname==='/controle'){
    if(url.searchParams.has('lento'))modo.lento=url.searchParams.get('lento')==='1';
    if(url.searchParams.has('offline'))modo.offline=url.searchParams.get('offline')==='1';
    return responder(res,200,'text/plain',JSON.stringify({codigo,porta,...modo}));
  }
  if(url.pathname==='/evidencias')return responder(res,200,'application/json',JSON.stringify({codigo,evidencias},null,2));
  if(url.pathname==='/semear-legado'&&req.method==='POST'){
    const dados={schemaVersion:1,saldoAtual:4321.99,dinheiroVivo:25,
      onboardingCompleto:true,tourCompleto:true,cartoes:[{id:'cartao-teste',nome:'Cartão fictício',limite:5000}]};
    const r=await fetch(base+'/rest/v1/financas_homolog',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates'},
      body:JSON.stringify({id:codigoLegado,data:dados,revision:0,write_token_hash:null})});
    evidencias.push({horario:new Date().toISOString(),metodo:'POST',funcao:'financas_homolog',id:codigoLegado,status:r.status});
    return responder(res,r.status,'application/json',JSON.stringify({codigo:codigoLegado,saldo:dados.saldoAtual}));
  }
  if(url.pathname==='/limpar'&&req.method==='POST'){
    for(const id of ids){
      const r=await fetch(base+'/rest/v1/financas_homolog?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers});
      evidencias.push({metodo:'DELETE',funcao:'financas_homolog',id,status:r.status});
      if(!r.ok)throw new Error('falha na limpeza: '+r.status);
    }
    return responder(res,200,'text/plain','Registros fictícios removidos.');
  }
  if(url.pathname.startsWith('/rpc/')&&req.method==='POST'){
    const nome=url.pathname.slice(5);let corpo='';for await(const chunk of req)corpo+=chunk;
    const dados=JSON.parse(corpo);
    if(!permitidas.has(nome)||!(ids.has(dados.p_id)||[...ids].some(id=>dados.p_id?.startsWith(id+'-snap-')))){
      evidencias.push({bloqueada:true,funcao:nome});return responder(res,403,'application/json','{}');
    }
    ids.add(dados.p_id);
    const registro={horario:new Date().toISOString(),porta,metodo:'POST',funcao:nome,id:dados.p_id};
    evidencias.push(registro);
    if(modo.offline){registro.status=503;return responder(res,503,'application/json','{}');}
    if(modo.lento&&nome==='aoii_put_homolog')await new Promise(r=>setTimeout(r,5000));
    const r=await fetch(base+'/rest/v1/rpc/'+nome,{method:'POST',headers,body:corpo});
    registro.status=r.status;return responder(res,r.status,'application/json',await r.text());
  }
  if(url.pathname==='/'||url.pathname==='/index.html'){
    let html=fs.readFileSync(path.join(raiz,'dist/index.html'),'utf8');
    const inicial={schemaVersion:1,saldoAtual:100,dinheiroVivo:0,onboardingCompleto:true,tourCompleto:true};
    const boot=`<script>
      localStorage.setItem('aoii-homolog','1');
      if(!localStorage.getItem('financas-data'))localStorage.setItem('financas-data',${JSON.stringify(JSON.stringify(inicial))});
      const fetchReal=window.fetch.bind(window);
      window.fetch=(alvo,opcoes)=>{
        const u=new URL(String(alvo),location.href);
        if(u.origin===${JSON.stringify(base)}){
          const nome=u.pathname.split('/').pop();
          if(!['aoii_get_homolog','aoii_put_homolog'].includes(nome))throw new Error('PRODUÇÃO BLOQUEADA');
          return fetchReal('/rpc/'+nome,opcoes);
        }
        return fetchReal(alvo,opcoes);
      };
    </script>`;
    html=html.replace('<head>','<head>'+boot);
    html=html.replace('</body>',`<aside style="position:fixed;bottom:0;left:0;z-index:1;background:#fff;color:#000;font:12px monospace">ENSAIO ${porta} · Novo: ${codigo} · Legado: ${codigoLegado}</aside></body>`);
    res.setHeader('Content-Security-Policy',"connect-src 'self'; worker-src 'none'");
    return responder(res,200,'text/html; charset=utf-8',html);
  }
  /* O resto do que está em dist/: logo, ícones, a página da faixa de
     cotações. Sem isto o ensaio mostrava um app sem logo e sem faixa — e um
     ensaio que não parece o app não serve para conferir o app. Só dist/, e
     só o que estiver mesmo dentro dela. */
  const alvo=path.resolve(raiz,'dist',url.pathname.replace(/^[/]+/,''));
  const dentro=path.resolve(raiz,'dist')+path.sep;
  if(alvo.startsWith(dentro)&&fs.existsSync(alvo)&&fs.statSync(alvo).isFile()){
    const tipos={'.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon',
      '.js':'text/javascript','.css':'text/css','.json':'application/json',
      '.webmanifest':'application/manifest+json','.woff2':'font/woff2',
      '.html':'text/html; charset=utf-8'};
    const tipo=tipos[path.extname(alvo).toLowerCase()]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':tipo,'Cache-Control':'no-store'});
    return res.end(fs.readFileSync(alvo));
  }
  return responder(res,404,'text/plain','Não encontrado');
}
for(const porta of [4173,4174]){
  modos.set(porta,{lento:false,offline:false});
  http.createServer((req,res)=>atender(req,res).catch(e=>{console.error(e.message);if(!res.headersSent)responder(res,500,'text/plain','Falha no ensaio');else res.end();}))
    .listen(porta,'127.0.0.1',()=>console.log('http://localhost:'+porta+' · novo '+codigo+' · legado '+codigoLegado));
}
