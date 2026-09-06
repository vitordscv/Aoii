function getSyncCode(){ try{ return localStorage.getItem('financas-sync-code')||''; }catch(e){ return ''; } }
function setSyncCode(c){ try{ localStorage.setItem('financas-sync-code',c); }catch(e){} }
function syncConfigured(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY && getSyncCode()); }
/* Snapshot mensal: uma cópia intocável dos dados do mês, com id próprio, nunca
   sobrescrita — backup de verdade, não só espelho.

   Cifrada com a mesma senha do espelho. Guardar snapshot em texto puro seria
   uma porta dos fundos aberta ao lado de uma porta trancada. E por isso ele só
   acontece com a sincronização destrancada: sem senha, não há o que cifrar. */
async function ensureMonthlySnapshot(){
  try{
    const code=getSyncCode(); if(!code) return;
    if(!sincronizacaoDestrancada()) return;
    const t=today(); const chave=`${code}-snap-${t.getFullYear()}-${t.getMonth()+1}`;
    if((data.snapshotsMensais||[]).includes(chave)) return;

    const envelope=await cifrarParaNuvem(data,sync.senha,{
      revision:1, device_id:idDesteAparelho(), salt:sync.salt,
    });
    /* revisão esperada 0: snapshot nasce e nunca é atualizado. Se já existir,
       o servidor devolve conflito e a gente só marca como feito. */
    const r=await nuvemGravar(chave,envelope,0,sync.token);
    if(!r.ok&&!r.conflito) return;

    if(!data.snapshotsMensais) data.snapshotsMensais=[];
    data.snapshotsMensais.push(chave);
    await persist();
  }catch(e){}
}
/* ═══════════════════════════════════════════════════════════════════════════
   Transporte novo: as duas funções do banco, no lugar do acesso direto à tabela.

   O acesso por REST (`/rest/v1/financas`) deixa a chave anon listar a tabela
   inteira — RLS não sabe exigir "só se você filtrar por id". aoii_get devolve
   uma linha pelo id exato e nada mais; aoii_put só grava se o token de escrita
   confere e a revisão é a esperada.

   Ver docs/SYNC-DESIGN.md e supabase/migrations/0001_sync_seguro.sql.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Modo de ensaio. Com localStorage['aoii-homolog'] = '1', o app fala com as
   funções gêmeas de homologação (aoii_get_homolog / aoii_put_homolog), numa
   tabela separada e descartável. Serve pra validar a interface inteira — senha,
   migração, conflito, queda de rede — sem encostar em dado de ninguém.

   Sem botão e desligado por padrão: quem liga precisa saber o que está
   fazendo. Ver docs/SYNC-DESIGN.md. */
function sufixoDeHomologacao(){
  try{ return localStorage.getItem('aoii-homolog')==='1' ? '_homolog' : ''; }
  catch(e){ return ''; }
}
function emHomologacao(){ return sufixoDeHomologacao()!==''; }

async function chamarRpc(nome,corpo,segundos){
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),(segundos||8)*1000);
  try{
    const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}${sufixoDeHomologacao()}`,{
      method:'POST',
      signal:ctrl.signal,
      headers:{
        apikey:SUPABASE_ANON_KEY,
        Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':'application/json',
      },
      body:JSON.stringify(corpo),
    });
    if(!res.ok) throw new Error('rpc-'+nome+'-'+res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

/* Devolve {envelope, revision, device_id, updated_at} ou null se não existe.
   `envelope` é o que estiver guardado: pode ser o formato cifrado novo ou o
   objeto em texto puro de antes da migração — quem chama decide. */
async function nuvemLer(code){
  const r=await chamarRpc('aoii_get',{p_id:code});
  if(!r) return null;
  return {
    envelope: r.data,
    revision: typeof r.revision==='number'?r.revision:0,
    device_id: r.device_id||null,
    updated_at: r.updated_at||null,
  };
}

/* Grava. Três desfechos, e nenhum deles é exceção — conflito é resposta
   esperada, não erro:
     {ok:true, revision}         gravou
     {conflito:true, revision}   outro aparelho gravou antes; NÃO gravou
     {erro:'token'|'id'|'tamanho'} recusado                                */
async function nuvemGravar(code,envelope,revisaoEsperada,tokenDeEscrita){
  const r=await chamarRpc('aoii_put',{
    p_id:code,
    p_data:envelope,
    p_expected_revision:revisaoEsperada,
    p_write_token:tokenDeEscrita,
  });
  if(r&&r.ok) return {ok:true,revision:r.revision};
  if(r&&r.conflito) return {conflito:true,revision:r.revision};
  return {erro:(r&&r.erro)||'desconhecido'};
}

async function supabaseGet(code){
  const url=`${SUPABASE_URL}/rest/v1/financas?id=eq.${encodeURIComponent(code)}&select=data`;
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),5000);
  try{
    const res=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},signal:ctrl.signal});
    if(!res.ok) throw new Error('supabase get failed');
    const rows=await res.json();
    return rows&&rows[0]?rows[0].data:null;
  } finally { clearTimeout(t); }
}
async function supabaseSet(code,valueObj){
  const url=`${SUPABASE_URL}/rest/v1/financas`;
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),5000);
  try{
    const res=await fetch(url,{
      method:'POST',
      signal:ctrl.signal,
      headers:{
        apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type':'application/json',
        Prefer:'resolution=merge-duplicates'
    },
    body:JSON.stringify({id:code,data:valueObj,updated_at:new Date().toISOString()})
  });
  if(!res.ok) throw new Error('supabase set failed');
  } finally { clearTimeout(t); }
}
