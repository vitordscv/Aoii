/* ── investimentos: taxas atuais, mediana de dividendos e juros ── */
function mediana(arr){
  if(!arr.length) return 0;
  const s=[...arr].sort((a,b)=>a-b);
  const mid=Math.floor(s.length/2);
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}
function taxaAnualDisponivel(qual){ // 'cdi' | 'selic' → % a.a. ou null
  const tm=data.taxasManuais||{};
  return (typeof tm[qual]==='number'&&tm[qual]>0)?tm[qual]:null;
}
async function fetchTaxasAtuais(){
  const st=document.getElementById('calc-taxas-status');
  if(st) st.textContent='Buscando taxas atuais…';
  try{
    const res=await fetch('https://brasilapi.com.br/api/taxas/v1');
    if(!res.ok) throw new Error('http '+res.status);
    const list=await res.json();
    if(!data.taxasManuais) data.taxasManuais={};
    list.forEach(t=>{
      const nome=String(t.nome||'').toUpperCase();
      if(nome==='CDI') data.taxasManuais.cdi=t.valor;
      if(nome==='SELIC') data.taxasManuais.selic=t.valor;
    });
    data.taxasManuais.atualizadoEm=new Date().toISOString();
    await persist();
    refreshTaxasUI();
    setSaveStatus(L('st.taxasAtualizadas'));
  }catch(e){
    if(st) st.textContent=L('calc.taxasErro');
  }
}
function refreshTaxasUI(){
  const st=document.getElementById('calc-taxas-status');
  const tm=data.taxasManuais||{};
  if(st){
    if(tm.cdi||tm.selic){
      const quando=tm.atualizadoEm?' · '+new Date(tm.atualizadoEm).toLocaleDateString(localeAtual()):'';
      st.textContent=`CDI ${tm.cdi?tm.cdi+'% a.a.':'—'} · Selic ${tm.selic?tm.selic+'% a.a.':'—'}${quando}`;
    }else st.textContent=L('calc.taxasIndisponivel');
  }
  const ci=document.getElementById('taxa-cdi-manual'), si=document.getElementById('taxa-selic-manual');
  if(ci&&document.activeElement!==ci) ci.value=tm.cdi||'';
  if(si&&document.activeElement!==si) si.value=tm.selic||'';
  renderCalcResult();
  renderInvestimentos();
}
