/* ── consulta pública das taxas; não altera estado nem interface ── */
async function buscarTaxasAtuais(){
  const res=await fetch('https://brasilapi.com.br/api/taxas/v1');
  if(!res.ok) throw new Error('http '+res.status);
  const list=await res.json();
  const taxas={};
  list.forEach(t=>{
    const nome=String(t.nome||'').toUpperCase();
    if(nome==='CDI') taxas.cdi=t.valor;
    if(nome==='SELIC') taxas.selic=t.valor;
  });
  return taxas;
}
