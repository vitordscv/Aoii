/* ── preferências financeiras que afetam cálculos ── */
function definirTipoRenda(tipo){
  if(tipo!=='diaria'&&tipo!=='mensal') return null;
  data.tipoRenda=tipo;
  return tipo;
}

function atualizarRendaDiaria(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)||valor<0) return null;
  data.rendaDiaria=valor;
  return valor;
}

function atualizarRendaMensal(valor,diaDoMes){
  valor=Number(valor); diaDoMes=Number(diaDoMes);
  if(!Number.isFinite(valor)||valor<0||!Number.isInteger(diaDoMes)||diaDoMes<1||diaDoMes>31) return null;
  data.rendaMensal={valor,diaDoMes};
  return data.rendaMensal;
}

function atualizarSaldoConta(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)) return null;
  data.saldoAtual=valor;
  data.saldoAtualizadoEm=new Date().toISOString();
  return valor;
}

function atualizarDinheiroVivo(valor){
  valor=Number(valor);
  if(!Number.isFinite(valor)) return null;
  data.dinheiroVivo=valor;
  data.dinheiroVivoAtualizadoEm=new Date().toISOString();
  return valor;
}

function atualizarDataAlvo(valor){
  const dataTeste=typeof valor==='string'?new Date(valor+'T12:00:00'):null;
  if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor)||Number.isNaN(dataTeste.getTime())||dataTeste.toISOString().slice(0,10)!==valor) return null;
  data.dataAlvo=valor;
  return valor;
}

function atualizarReserva(alteracoes){
  alteracoes=alteracoes||{};
  const proxima={
    reservaGuardado:Object.prototype.hasOwnProperty.call(alteracoes,'reservaGuardado')?Number(alteracoes.reservaGuardado):data.reservaGuardado,
    reservaMeses:Object.prototype.hasOwnProperty.call(alteracoes,'reservaMeses')?Number(alteracoes.reservaMeses):data.reservaMeses,
    reservaNaConta:Object.prototype.hasOwnProperty.call(alteracoes,'reservaNaConta')?alteracoes.reservaNaConta:data.reservaNaConta,
  };
  if(!Number.isFinite(proxima.reservaGuardado)||proxima.reservaGuardado<0||!Number.isInteger(proxima.reservaMeses)||proxima.reservaMeses<0||proxima.reservaMeses>120||typeof proxima.reservaNaConta!=='boolean') return null;
  Object.assign(data,proxima);
  return proxima;
}
