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

/* Antes de começar do zero, guarda o que não deu pra ler.
   Recomeçar já era o comportamento; o que faltava era não jogar fora — se a
   recusa vier de um engano da validação, ou de um app mais novo que salvou um
   formato desconhecido, o original continua ali pra ser recuperado. */
const CHAVE_RESGATE=STORAGE_KEY+'-recusado';
function guardarParaResgate(texto,motivo){
  try{
    localStorage.setItem(CHAVE_RESGATE,texto);
    localStorage.setItem(CHAVE_RESGATE+'-motivo',new Date().toISOString()+' · '+motivo);
    console.warn('[aoii] dados locais não aceitos ('+motivo+'). '+
      'Cópia guardada em localStorage["'+CHAVE_RESGATE+'"].');
  }catch(e){ console.warn('[aoii] dados locais não aceitos e sem espaço pra guardar cópia'); }
}

async function loadData(){
  let bruto=null;
  try{
    const res=await store.get(STORAGE_KEY);
    if(!(res&&res.value)){ data=defaultData(); await persist(); return; }
    bruto=res.value;
    /* o que está no localStorage também passa pela validação: ele guarda o que
       entrou por um backup em alguma sessão anterior, e pode ter sido editado
       à mão pelo console */
    const r=adotarDadosDeFora(JSON.parse(bruto),'local',{bytes:bruto.length});
    if(!r.ok){
      guardarParaResgate(bruto,r.problemas[0]||'formato não reconhecido');
      data=defaultData(); await persist(); return;
    }
    data=r.data; setSaveStatus(L('st.salvo'));
  }catch(e){
    if(bruto) guardarParaResgate(bruto,'erro ao ler: '+(e&&e.message||e));
    data=defaultData(); try{await persist();}catch(e2){}
  }
}

