/* ── comandos de gastos fixos ── */
function camposGastoFixo(entrada,atual){
  entrada=entrada||{}; atual=atual||{};
  const ler=campo=>Object.prototype.hasOwnProperty.call(entrada,campo)?entrada[campo]:atual[campo];
  const nome=String(ler('nome')||'').trim();
  const categoria=String(ler('categoria')||'').trim();
  const valor=Number(ler('valor'));
  const diaDoMes=Number(ler('diaDoMes'));
  const inicioAno=Number(ler('inicioAno'));
  const inicioMes=Number(ler('inicioMes'));
  const ativo=ler('ativo');
  if(!nome||!categoria||!Number.isFinite(valor)||valor<=0||
     !Number.isInteger(diaDoMes)||diaDoMes<1||diaDoMes>31||
     !Number.isInteger(inicioAno)||inicioAno<1900||inicioAno>3000||
     !Number.isInteger(inicioMes)||inicioMes<1||inicioMes>12||typeof ativo!=='boolean') return null;
  return {nome,valor,diaDoMes,categoria,ativo,inicioAno,inicioMes};
}

function criarGastoFixo(entrada){
  const campos=camposGastoFixo(entrada);
  if(!campos) return null;
  if(!data.gastosMensais) data.gastosMensais=[];
  const gasto={id:uid(),...campos,criadoEm:new Date().toISOString()};
  data.gastosMensais.push(gasto);
  return gasto;
}

function atualizarGastoFixo(id,alteracoes){
  const gasto=(data.gastosMensais||[]).find(g=>g.id===id);
  if(!gasto) return null;
  const campos=camposGastoFixo(alteracoes,gasto);
  if(!campos) return null;
  Object.assign(gasto,campos);
  return gasto;
}

function removerGastoFixo(id){
  const indice=(data.gastosMensais||[]).findIndex(g=>g.id===id);
  if(indice<0) return null;
  return {item:data.gastosMensais.splice(indice,1)[0],indice};
}

function restaurarGastoFixo(item,indice){
  if(!item) return null;
  if(!data.gastosMensais) data.gastosMensais=[];
  data.gastosMensais.splice(Math.min(Math.max(0,indice||0),data.gastosMensais.length),0,item);
  return item;
}
