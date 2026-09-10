/* ── categorias e viagens ── */
function adicionarCategoria(nome){
  nome=String(nome||'').trim();
  if(!nome||nome.length>60||CATS().some(c=>c.toLowerCase()===nome.toLowerCase())) return null;
  data.categorias=[...CATS(),nome];
  return nome;
}

function removerCategoria(nome){
  const categorias=CATS();
  if(categorias.length<=1||!categorias.includes(nome)) return null;
  const destino=categorias.find(c=>c!==nome)||'Outros';
  data.categorias=categorias.filter(c=>c!==nome);
  (data.transacoes||[]).forEach(t=>{ if(t.categoria===nome) t.categoria=destino; });
  (data.gastosMensais||[]).forEach(g=>{ if(g.categoria===nome) g.categoria=destino; });
  (data.faturas||[]).forEach(f=>(f.gastos||[]).forEach(g=>{ if(g.categoria===nome) g.categoria=destino; }));
  if(data.orcamentos) delete data.orcamentos[nome];
  return {nome,destino};
}

function criarViagem(entrada){
  entrada=entrada||{};
  const nome=String(entrada.nome||'').trim();
  const orcamento=Number(entrada.orcamento);
  if(!nome||!Number.isFinite(orcamento)||orcamento<0) return null;
  if(!data.viagens) data.viagens=[];
  const viagem={id:uid(),nome,orcamento};
  data.viagens.push(viagem);
  return viagem;
}

function removerViagem(id){
  const indice=(data.viagens||[]).findIndex(v=>v.id===id);
  if(indice<0) return null;
  const item=data.viagens.splice(indice,1)[0];
  (data.transacoes||[]).forEach(t=>{ if(t.viagemId===id) t.viagemId=null; });
  return {item,indice};
}
