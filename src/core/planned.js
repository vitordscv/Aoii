/* ── entradas extras e compras planejadas ── */
function dataPlanejadaValida(valor){
  if(valor===null||valor===undefined||valor==='') return null;
  const d=new Date(String(valor)+'T12:00:00');
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor))&&!Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===valor?valor:undefined;
}

function camposPlanejados(tipo,entrada,atual){
  entrada=entrada||{}; atual=atual||{};
  const ler=campo=>Object.prototype.hasOwnProperty.call(entrada,campo)?entrada[campo]:atual[campo];
  const nome=String(ler('nome')||'').trim();
  const valor=Number(ler('valor'));
  const dataPrevista=dataPlanejadaValida(ler('dataPrevista'));
  if(!nome||!Number.isFinite(valor)||valor<0||dataPrevista===undefined) return null;
  if(tipo==='entrada'){
    const modo=ler('modo')||'unica';
    const recebido=Number(ler('recebido')||0);
    if(!['unica','aosPoucos','semPrevisao'].includes(modo)||!Number.isFinite(recebido)||recebido<0||recebido>valor) return null;
    return {nome,valor,nota:String(ler('nota')||''),dataPrevista,modo,recebido,feito:Boolean(ler('feito')),feitoEm:ler('feitoEm')||null};
  }
  const cartao=Boolean(ler('cartao'));
  const parcelas=Number(ler('parcelas')||1);
  const cartaoId=ler('cartaoId')||null;
  if(!Number.isInteger(parcelas)||parcelas<1||parcelas>360||(cartaoId&&!(data.cartoes||[]).some(c=>c.id===cartaoId))) return null;
  return {nome,valor,nota:String(ler('nota')||''),dataPrevista,cartao,parcelas,cartaoId,parcelasLancadas:Boolean(ler('parcelasLancadas')),feito:Boolean(ler('feito')),feitoEm:ler('feitoEm')||null};
}

function criarPlanejado(tipo,entrada){
  const campos=camposPlanejados(tipo,entrada);
  if(!campos) return null;
  const chave=tipo==='entrada'?'entradasExtras':'comprasPlanejadas';
  if(!data[chave]) data[chave]=[];
  const item={id:uid(),...campos};
  data[chave].push(item);
  return item;
}

function atualizarPlanejado(tipo,id,alteracoes){
  const chave=tipo==='entrada'?'entradasExtras':'comprasPlanejadas';
  const item=(data[chave]||[]).find(x=>x.id===id);
  if(!item) return null;
  const campos=camposPlanejados(tipo,alteracoes,item);
  if(!campos) return null;
  Object.assign(item,campos);
  return item;
}

function removerPlanejado(tipo,id){
  const chave=tipo==='entrada'?'entradasExtras':'comprasPlanejadas';
  const indice=(data[chave]||[]).findIndex(x=>x.id===id);
  if(indice<0) return null;
  return {item:data[chave].splice(indice,1)[0],indice};
}

function restaurarPlanejado(tipo,item,indice){
  if(!item) return null;
  const chave=tipo==='entrada'?'entradasExtras':'comprasPlanejadas';
  if(!data[chave]) data[chave]=[];
  data[chave].splice(Math.min(Math.max(0,indice||0),data[chave].length),0,item);
  return item;
}

function registrarRecebimentoEntrada(id,valor){
  const item=(data.entradasExtras||[]).find(x=>x.id===id);
  valor=Number(valor);
  if(!item||item.feito||!Number.isFinite(valor)||valor<=0) return null;
  const recebido=Math.min(valor,restanteEntrada(item));
  if(recebido<=0) return null;
  const receita=registrarReceita(item.nome||'Entrada extra',recebido,'Outros','pix');
  if(!receita) return null;
  item.recebido=(item.recebido||0)+recebido;
  if(restanteEntrada(item)<=0){ item.feito=true; item.feitoEm=todayISO(); }
  return {item,receita,recebido};
}

function definirPlanejadoFeito(tipo,id,feito){
  const chave=tipo==='entrada'?'entradasExtras':'comprasPlanejadas';
  const item=(data[chave]||[]).find(x=>x.id===id);
  if(!item||typeof feito!=='boolean') return null;
  item.feito=feito;
  item.feitoEm=feito?todayISO():null;
  if(tipo==='compra'&&feito&&item.cartao&&!item.parcelasLancadas){
    const inicio=item.dataPrevista?new Date(item.dataPrevista+'T12:00:00'):new Date();
    lancarParcelamento(item.nome,item.valor,item.parcelas||1,inicio.getFullYear(),inicio.getMonth()+1,'Outros',item.cartaoId);
    item.parcelasLancadas=true;
  }
  return item;
}
