/* ── entradas extras, compras planejadas e dívidas ── */
/* As três listas de coisas futuras. a chave é onde o item mora em data;
   feito e feitoEm mudam de nome porque uma dívida não é "feita", é
   quitada — e o nome do campo é o que a pessoa lê no backup. */
const LISTAS_PLANEJADAS={
  entrada:{chave:'entradasExtras',feito:'feito',feitoEm:'feitoEm'},
  compra: {chave:'comprasPlanejadas',feito:'feito',feitoEm:'feitoEm'},
  divida: {chave:'dividas',feito:'quitado',feitoEm:'quitadoEm'},
};
function listaPlanejada(tipo){ return Object.prototype.hasOwnProperty.call(LISTAS_PLANEJADAS,tipo)?LISTAS_PLANEJADAS[tipo]:null; }

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
  if(tipo==='divida'){
    /* Espelho da entrada extra: `valor` é o total combinado, `pago` é o que
       já saiu. O padrão é 'semPrevisao' porque quem empresta dinheiro a um
       conhecido quase nunca combina data — e prometer uma na projeção seria
       inventar. */
    const modo=ler('modo')||'semPrevisao';
    const pago=Number(ler('pago')||0);
    if(!['unica','aosPoucos','semPrevisao'].includes(modo)||!Number.isFinite(pago)||pago<0||pago>valor) return null;
    return {nome,credor:String(ler('credor')||''),valor,nota:String(ler('nota')||''),dataPrevista,modo,pago,
            quitado:Boolean(ler('quitado')),quitadoEm:ler('quitadoEm')||null};
  }
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
  /* O link é opcional, mas quando vem preenchido tem que ser aproveitável:
     um texto que não vira http/https recusa a edição inteira, em vez de ser
     descartado em silêncio e deixar a pessoa achando que salvou. */
  const linkBruto=ler('link');
  const link=(linkBruto===null||linkBruto===undefined||String(linkBruto).trim()==='')?null:urlSegura(String(linkBruto));
  if(link===null&&linkBruto!==null&&linkBruto!==undefined&&String(linkBruto).trim()!=='') return null;
  return {nome,valor,nota:String(ler('nota')||''),link,dataPrevista,cartao,parcelas,cartaoId,parcelasLancadas:Boolean(ler('parcelasLancadas')),feito:Boolean(ler('feito')),feitoEm:ler('feitoEm')||null};
}

function criarPlanejado(tipo,entrada){
  const campos=camposPlanejados(tipo,entrada);
  if(!campos) return null;
  const cfg=listaPlanejada(tipo); if(!cfg) return null;
  const chave=cfg.chave;
  if(!data[chave]) data[chave]=[];
  const item={id:uid(),...campos};
  data[chave].push(item);
  return item;
}

function atualizarPlanejado(tipo,id,alteracoes){
  const cfg=listaPlanejada(tipo); if(!cfg) return null;
  const chave=cfg.chave;
  const item=(data[chave]||[]).find(x=>x.id===id);
  if(!item) return null;
  const campos=camposPlanejados(tipo,alteracoes,item);
  if(!campos) return null;
  Object.assign(item,campos);
  return item;
}

function removerPlanejado(tipo,id){
  const cfg=listaPlanejada(tipo); if(!cfg) return null;
  const chave=cfg.chave;
  const indice=(data[chave]||[]).findIndex(x=>x.id===id);
  if(indice<0) return null;
  return {item:data[chave].splice(indice,1)[0],indice};
}

function restaurarPlanejado(tipo,item,indice){
  if(!item) return null;
  const cfg=listaPlanejada(tipo); if(!cfg) return null;
  const chave=cfg.chave;
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

/* Um pagamento da dívida: sai da conta como gasto no Diário e abate o que
   falta. Igual a registrarRecebimentoEntrada, do outro lado — e pelo mesmo
   motivo: o dinheiro tem que aparecer no extrato, senão a dívida encolhe
   sozinha e o saldo não mexe. */
function registrarPagamentoDivida(id,valor){
  const item=(data.dividas||[]).find(x=>x.id===id);
  valor=Number(valor);
  if(!item||item.quitado||!Number.isFinite(valor)||valor<=0) return null;
  const pago=Math.min(valor,restanteDivida(item));
  if(pago<=0) return null;
  const gasto=registrarTransacao(item.nome||'Dívida',pago,'Outros','pix');
  if(!gasto) return null;
  item.pago=(item.pago||0)+pago;
  if(restanteDivida(item)<=0){ item.quitado=true; item.quitadoEm=todayISO(); }
  return {item,gasto,pago};
}

function definirPlanejadoFeito(tipo,id,feito){
  const cfg=listaPlanejada(tipo); if(!cfg) return null;
  const chave=cfg.chave;
  const item=(data[chave]||[]).find(x=>x.id===id);
  if(!item||typeof feito!=='boolean') return null;
  item[cfg.feito]=feito;
  item[cfg.feitoEm]=feito?todayISO():null;
  if(tipo==='compra'&&feito&&item.cartao&&!item.parcelasLancadas){
    const inicio=item.dataPrevista?new Date(item.dataPrevista+'T12:00:00'):new Date();
    lancarParcelamento(item.nome,item.valor,item.parcelas||1,inicio.getFullYear(),inicio.getMonth()+1,'Outros',item.cartaoId);
    item.parcelasLancadas=true;
  }
  return item;
}
