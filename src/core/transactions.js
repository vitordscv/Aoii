/* ── compra no débito ou dinheiro: desconta na hora e fica no histórico ── */
function registrarTransacao(nome,valor,categoria,metodo){
  if(!data.transacoes) data.transacoes=[];
  const now=new Date().toISOString();
  data.transacoes.unshift({id:uid(),nome,valor,categoria:categoria||'Outros',metodo,data:todayISO()});
  if(metodo==='dinheiro'){
    data.dinheiroVivo=(data.dinheiroVivo||0)-valor;
    data.dinheiroVivoAtualizadoEm=now;
  }else{
    data.saldoAtual=(data.saldoAtual||0)-valor;
    data.saldoAtualizadoEm=now;
  }
}

/* ── entrada inesperada (ex: reembolso, presente): soma no saldo e fica no histórico do Diário ── */
function registrarReceita(nome,valor,categoria,metodo){
  if(!data.transacoes) data.transacoes=[];
  const now=new Date().toISOString();
  data.transacoes.unshift({id:uid(),nome,valor,categoria:categoria||'Outros',metodo,data:todayISO(),tipo:'receita'});
  if(metodo==='dinheiro'){
    data.dinheiroVivo=(data.dinheiroVivo||0)+valor;
    data.dinheiroVivoAtualizadoEm=now;
  }else{
    data.saldoAtual=(data.saldoAtual||0)+valor;
    data.saldoAtualizadoEm=now;
  }
}

function removerTransacao(id){
  const t=data.transacoes.find(x=>x.id===id);
  if(!t) return;
  const now=new Date().toISOString();
  const sinal=t.tipo==='receita'?-1:1;
  if(t.metodo==='dinheiro'){
    data.dinheiroVivo=(data.dinheiroVivo||0)+sinal*t.valor;
    data.dinheiroVivoAtualizadoEm=now;
  }else{
    data.saldoAtual=(data.saldoAtual||0)+sinal*t.valor;
    data.saldoAtualizadoEm=now;
  }
  data.transacoes=data.transacoes.filter(x=>x.id!==id);
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

