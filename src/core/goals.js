/* ── comandos de metas ──────────────────────────────────────────────
   O valor guardado fica fora do saldo da conta e entra no patrimônio pela
   meta. Toda alteração move apenas a diferença, preservando o patrimônio. */
function dataAlvoMetaValida(valor){
  if(valor==null||valor==='') return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d=new Date(valor+'T12:00:00');
  return !isNaN(d)&&d.getFullYear()===Number(valor.slice(0,4))&&d.getMonth()+1===Number(valor.slice(5,7))&&d.getDate()===Number(valor.slice(8,10));
}

function moverSaldoParaMeta(diferenca,atualizadoEm){
  if(!diferenca) return;
  data.saldoAtual=(data.saldoAtual||0)-diferenca;
  data.saldoAtualizadoEm=atualizadoEm||new Date().toISOString();
}

function criarMeta(campos){
  campos=campos||{};
  const nome=String(campos.nome||'').trim();
  const valorAlvo=Number(campos.valorAlvo);
  const aporteMensal=campos.aporteMensal==null||campos.aporteMensal===''?0:Number(campos.aporteMensal);
  const dataAlvo=campos.dataAlvo||null;
  if(!nome||!Number.isFinite(valorAlvo)||valorAlvo<=0) return null;
  if(!Number.isFinite(aporteMensal)||aporteMensal<0||!dataAlvoMetaValida(dataAlvo)) return null;
  const meta={id:uid(),nome,valorAlvo,valorGuardado:0,aporteMensal};
  if(dataAlvo) meta.dataAlvo=dataAlvo;
  if(aporteMensal>0){ const t=today(); meta.ultimoAporte=`${t.getFullYear()}-${t.getMonth()+1}`; }
  if(!data.metas) data.metas=[];
  data.metas.push(meta);
  return meta;
}

function atualizarMeta(id,campos){
  const meta=(data.metas||[]).find(x=>x.id===id);
  if(!meta) return null;
  campos=campos||{};
  const alteracoes={};
  if(Object.prototype.hasOwnProperty.call(campos,'nome')){
    alteracoes.nome=String(campos.nome||'').trim();
    if(!alteracoes.nome) return null;
  }
  for(const chave of ['valorAlvo','valorGuardado','aporteMensal']){
    if(!Object.prototype.hasOwnProperty.call(campos,chave)) continue;
    const valor=Number(campos[chave]);
    if(!Number.isFinite(valor)||valor<0) return null;
    alteracoes[chave]=valor;
  }
  if(Object.prototype.hasOwnProperty.call(campos,'dataAlvo')){
    const valor=campos.dataAlvo||null;
    if(!dataAlvoMetaValida(valor)) return null;
    alteracoes.dataAlvo=valor;
  }
  const antes=Math.max(0,Number(meta.valorGuardado)||0);
  const depois=Object.prototype.hasOwnProperty.call(alteracoes,'valorGuardado')?alteracoes.valorGuardado:antes;
  moverSaldoParaMeta(depois-antes);
  Object.assign(meta,alteracoes);
  return meta;
}

function removerMeta(id){
  const lista=data.metas||[];
  const indice=lista.findIndex(x=>x.id===id);
  if(indice<0) return null;
  const item=lista[indice];
  moverSaldoParaMeta(-Math.max(0,Number(item.valorGuardado)||0));
  lista.splice(indice,1);
  return {item,indice};
}

function restaurarMeta(item,indice){
  if(!item||(data.metas||[]).some(x=>x.id===item.id)) return null;
  if(!data.metas) data.metas=[];
  const pos=Math.max(0,Math.min(Number.isInteger(indice)?indice:data.metas.length,data.metas.length));
  data.metas.splice(pos,0,item);
  moverSaldoParaMeta(Math.max(0,Number(item.valorGuardado)||0));
  return item;
}
