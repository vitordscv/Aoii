/* ── comandos de lançamentos do Diário ────────────────────────────────
   Toda mudança em transações passa por estas funções para que o item e o saldo
   correspondente sejam alterados juntos. fator 1 aplica; -1 estorna. */
function aplicarEfeitoTransacao(item,fator,atualizadoEm){
  const sinal=item.tipo==='receita'?1:-1;
  const delta=sinal*fator*item.valor;
  const now=atualizadoEm||new Date().toISOString();
  if(item.metodo==='dinheiro'){
    data.dinheiroVivo=(data.dinheiroVivo||0)+delta;
    data.dinheiroVivoAtualizadoEm=now;
  }else{
    data.saldoAtual=(data.saldoAtual||0)+delta;
    data.saldoAtualizadoEm=now;
  }
}

function registrarMovimento(campos){
  campos=campos||{};
  const valor=Number(campos.valor);
  if(!Number.isFinite(valor)||valor<=0) return null;
  if(!['pix','debito','dinheiro'].includes(campos.metodo)) return null;
  const categoria=campos.categoria||'Outros';
  const item={
    id:uid(),
    /* sem descrição, o nome vira a categoria — e aí tem que ser a categoria
       traduzida: senão quem usa o app em inglês fica com "Mercado" no extrato
       pra sempre. O nome é dado do usuário, editável; o rótulo do idioma de
       quando lançou é o melhor palpite. */
    nome:String(campos.nome||categoriaLabel(categoria)).trim()||categoriaLabel(categoria),
    valor,
    categoria,
    metodo:campos.metodo,
    data:campos.data||todayISO(),
  };
  if(campos.tipo==='receita') item.tipo='receita';
  if(campos.viagemId) item.viagemId=campos.viagemId;
  if(Array.isArray(campos.tags)&&campos.tags.length) item.tags=campos.tags.slice();
  if(campos.nota) item.nota=String(campos.nota);
  if(Number.isFinite(campos.percentual)&&campos.percentual<100){
    item.percentual=campos.percentual;
    item.valorTotal=campos.valorTotal;
  }
  if(!data.transacoes) data.transacoes=[];
  data.transacoes.unshift(item);
  aplicarEfeitoTransacao(item,1);
  return item;
}

function registrarTransacao(nome,valor,categoria,metodo){
  return registrarMovimento({nome,valor,categoria,metodo});
}

function registrarReceita(nome,valor,categoria,metodo){
  return registrarMovimento({tipo:'receita',nome,valor,categoria,metodo});
}

function repetirUltimoGasto(){
  const ultimo=(data.transacoes||[]).find(item=>item.tipo!=='receita');
  if(!ultimo) return null;
  return registrarMovimento({
    nome:ultimo.nome,
    valor:ultimo.valor,
    categoria:ultimo.categoria,
    metodo:ultimo.metodo,
    tags:ultimo.tags||[],
    nota:ultimo.nota||'',
    viagemId:ultimo.viagemId||null,
    percentual:ultimo.percentual,
    valorTotal:ultimo.valorTotal,
  });
}

function atualizarTransacao(id,campos){
  const atual=(data.transacoes||[]).find(x=>x.id===id);
  if(!atual) return null;
  campos=campos||{};
  const valor=Number(campos.valor);
  const metodo=campos.metodo;
  if(!Number.isFinite(valor)||valor<=0) return null;
  if(!['pix','debito','dinheiro'].includes(metodo)) return null;

  const now=new Date().toISOString();
  aplicarEfeitoTransacao(atual,-1,now);
  Object.assign(atual,{
    nome:String(campos.nome||campos.categoria||'Outros').trim()||'Outros',
    valor,
    categoria:campos.categoria||'Outros',
    metodo,
    data:campos.data||atual.data||todayISO(),
    viagemId:campos.viagemId||null,
    tags:Array.isArray(campos.tags)?campos.tags.slice():[],
    nota:campos.nota?String(campos.nota):'',
  });
  if(campos.tipo==='receita') atual.tipo='receita'; else delete atual.tipo;
  if(Number.isFinite(campos.percentual)&&campos.percentual<100){
    atual.percentual=campos.percentual;
    atual.valorTotal=campos.valorTotal;
  }else{
    delete atual.percentual;
    delete atual.valorTotal;
  }
  aplicarEfeitoTransacao(atual,1,now);
  return atual;
}

function removerTransacao(id){
  const lista=data.transacoes||[];
  const indice=lista.findIndex(x=>x.id===id);
  if(indice<0) return null;
  const item=lista[indice];
  aplicarEfeitoTransacao(item,-1);
  lista.splice(indice,1);
  return {item,indice};
}

function restaurarTransacao(item,indice){
  if(!item||(data.transacoes||[]).some(x=>x.id===item.id)) return null;
  if(!data.transacoes) data.transacoes=[];
  const pos=Math.max(0,Math.min(Number.isInteger(indice)?indice:0,data.transacoes.length));
  data.transacoes.splice(pos,0,item);
  aplicarEfeitoTransacao(item,1);
  return item;
}

/* ── gasto fixo: ativo (não pausado) e já dentro do período de cobrança ── */
function gastoFixoAtivoEm(g,ano,mes){
  if(g.ativo===false) return false;
  if(g.inicioAno&&g.inicioMes){
    if(ano<g.inicioAno) return false;
    if(ano===g.inicioAno&&mes<g.inicioMes) return false;
  }
  return true;
}

