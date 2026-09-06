function getSyncCode(){ try{ return localStorage.getItem('financas-sync-code')||''; }catch(e){ return ''; } }
function setSyncCode(c){ try{ localStorage.setItem('financas-sync-code',c); }catch(e){} }
function syncConfigured(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY && getSyncCode()); }
/* snapshot mensal: guarda uma cópia intocável dos dados do mês, na mesma tabela (id próprio, nunca sobrescrita) — backup real, não só espelho */
async function ensureMonthlySnapshot(){
  try{
    const code=getSyncCode(); if(!code) return;
    const t=today(); const chave=`${code}-snap-${t.getFullYear()}-${t.getMonth()+1}`;
    const jaFeito=(data.snapshotsMensais||[]).includes(chave);
    if(jaFeito) return;
    await supabaseSet(chave, data);
    if(!data.snapshotsMensais) data.snapshotsMensais=[];
    data.snapshotsMensais.push(chave);
    await persist();
  }catch(e){}
}
function genSyncCode(){
  const chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let c='';
  for(let i=0;i<8;i++) c+=chars[Math.floor(Math.random()*chars.length)];
  return c;
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
