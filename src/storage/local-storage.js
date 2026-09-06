/* ─── storage (Claude + localStorage fallback) ─── */

const store={
  async get(key){
    if(syncConfigured()){
      try{
        const d=await supabaseGet(getSyncCode());
        if(d) return {value:JSON.stringify(d)};
      }catch(e){ console.warn('sync get falhou, usando local',e); }
    }
    try{
      if(typeof window.storage!=='undefined'&&window.storage.get){
        const r=await window.storage.get(key,false); return r;
      }
    }catch(e){}
    try{ const v=localStorage.getItem(key); return v?{value:v}:null; }catch(e){ return null; }
  },
  async set(key,value){
    if(syncConfigured()){
      try{ await supabaseSet(getSyncCode(),JSON.parse(value)); }
      catch(e){ console.warn('sync set falhou',e); }
    }
    try{
      if(typeof window.storage!=='undefined'&&window.storage.set){
        const r=await window.storage.set(key,value,false); return r;
      }
    }catch(e){}
    try{ localStorage.setItem(key,value); return true; }catch(e){ return false; }
  }
};

function setSaveStatus(t){ const el=document.getElementById('save-status'); if(el) el.textContent=t; }

async function persist(){
  invalidarTimeline();
  setSaveStatus(L('st.salvando'));
  const ok=await store.set(STORAGE_KEY,JSON.stringify(data));
  setSaveStatus(ok?'salvo ✓':'erro ao salvar');
}

async function loadData(){
  try{
    const res=await store.get(STORAGE_KEY);
    if(res&&res.value){ data=migrateData(JSON.parse(res.value)); setSaveStatus(L('st.salvo')); }
    else{ data=defaultData(); await persist(); }
  }catch(e){ data=defaultData(); try{await persist();}catch(e2){} }
}

