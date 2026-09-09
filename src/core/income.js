/* ── rendas recorrentes: múltiplas fontes com dia do mês ── */
const TIPOS_RENDA=[
  {id:'clt',labelKey:'income.type.clt',icon:'💼'},
  {id:'pj',labelKey:'income.type.pj',icon:'🧾'},
  {id:'passiva',labelKey:'income.type.passive',icon:'🌱'},
  {id:'freela',labelKey:'income.type.freelance',icon:'🛠️'},
  {id:'outros',labelKey:'income.type.other',icon:'📦'},
];
function tipoRenda(id){
  const tipo=TIPOS_RENDA.find(t=>t.id===id)||TIPOS_RENDA[4];
  return {id:tipo.id,label:L(tipo.labelKey),icon:tipo.icon};
}
function rendasRecorrentesAtivas(){ return (data.rendasRecorrentes||[]).filter(r=>r.ativo!==false&&(r.valor||0)>0); }
/* soma as ocorrências de cada renda com data > inicio e <= fim */
function rendasRecorrentesEntre(inicio,fim){
  let total=0;
  rendasRecorrentesAtivas().forEach(r=>{
    let y=inicio.getFullYear(), m=inicio.getMonth();
    for(let i=0;i<72;i++){
      const d=dataNoMes(y,m+1,r.diaDoMes);
      if(d>fim) break;
      if(d>inicio) total+=r.valor;
      m++; if(m>11){m=0;y++;}
    }
  });
  return total;
}

/* ── comandos de renda recorrente ─────────────────────────────────── */
function camposRendaRecorrente(campos){
  campos=campos||{};
  const tipo=String(campos.tipo||'outros');
  const nome=String(campos.nome||'').trim();
  const valor=Number(campos.valor);
  const diaDoMes=Number(campos.diaDoMes);
  if(!TIPOS_RENDA.some(t=>t.id===tipo)) return null;
  if(!Number.isFinite(valor)||valor<=0) return null;
  if(!Number.isInteger(diaDoMes)||diaDoMes<1||diaDoMes>31) return null;
  return {tipo,nome,valor,diaDoMes,ativo:campos.ativo!==false};
}

function criarRendaRecorrente(campos){
  const valores=camposRendaRecorrente(campos); if(!valores) return null;
  const renda=Object.assign({id:uid()},valores,{criadoEm:new Date().toISOString()});
  if(!data.rendasRecorrentes) data.rendasRecorrentes=[];
  data.rendasRecorrentes.push(renda);
  return renda;
}

function atualizarRendaRecorrente(id,campos){
  const renda=(data.rendasRecorrentes||[]).find(x=>x.id===id);
  if(!renda) return null;
  const valores=camposRendaRecorrente(Object.assign({},renda,campos||{}));
  if(!valores) return null;
  Object.assign(renda,valores);
  return renda;
}

function removerRendaRecorrente(id){
  const lista=data.rendasRecorrentes||[];
  const indice=lista.findIndex(x=>x.id===id);
  if(indice<0) return null;
  return {item:lista.splice(indice,1)[0],indice};
}

function restaurarRendaRecorrente(item,indice){
  if(!item||(data.rendasRecorrentes||[]).some(x=>x.id===item.id)) return null;
  if(!data.rendasRecorrentes) data.rendasRecorrentes=[];
  const pos=Math.max(0,Math.min(Number.isInteger(indice)?indice:data.rendasRecorrentes.length,data.rendasRecorrentes.length));
  data.rendasRecorrentes.splice(pos,0,item);
  return item;
}
