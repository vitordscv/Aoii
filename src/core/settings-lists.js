/* ── categorias e viagens ── */
/* Um emoji, e so um. Sem isso daria pra guardar um texto inteiro no lugar do
   icone e a lista de categorias ficaria ilegivel. O limite conta por PONTO DE
   CODIGO, nao por caractere: bandeira e emoji com tom de pele ocupam varios
   `length` e sao um simbolo so. */
function emojiDeCategoriaValido(e){
  const texto=String(e||'').trim();
  if(!texto) return '';
  if([...texto].length>4||texto.length>8) return '';
  /* letra e numero nao sao icone */
  if(/[a-zA-Z0-9]/.test(texto)) return '';
  return texto;
}

function definirEmojiDeCategoria(nome,emoji){
  const cat=String(nome||'').trim();
  if(!cat||!CATS().includes(cat)) return null;
  if(!data.categoriaEmojis) data.categoriaEmojis={};
  const limpo=emojiDeCategoriaValido(emoji);
  if(limpo) data.categoriaEmojis[cat]=limpo;
  else delete data.categoriaEmojis[cat];
  return limpo;
}

function adicionarCategoria(nome,emoji){
  nome=String(nome||'').trim();
  if(!nome||nome.length>60||CATS().some(c=>c.toLowerCase()===nome.toLowerCase())) return null;
  data.categorias=[...CATS(),nome];
  const icone=emojiDeCategoriaValido(emoji);
  if(icone){
    if(!data.categoriaEmojis) data.categoriaEmojis={};
    data.categoriaEmojis[nome]=icone;
  }
  return nome;
}

function removerCategoria(nome){
  const categorias=CATS();
  if(categorias.length<=1||!categorias.includes(nome)) return null;
  const destino=categorias.find(c=>c!==nome)||'Outros';
  data.categorias=categorias.filter(c=>c!==nome);
  /* o emoji vai junto: deixar orfao encheria o mapa de lixo a cada remocao */
  if(data.categoriaEmojis) delete data.categoriaEmojis[nome];
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
  /* as parcelas no cartão também apontam pra viagem desde que lancarParcelamento
     passou a carregar os extras — sem isto sobraria referência pra viagem que
     não existe mais, e a validação de entrada derrubaria o dado */
  (data.faturas||[]).forEach(f=>{ (f.gastos||[]).forEach(g=>{ if(g.viagemId===id) g.viagemId=null; }); });
  return {item,indice};
}
