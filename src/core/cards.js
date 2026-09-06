/* ── cartão de crédito: quanto do limite está comprometido ── */
function computeCartao(cartaoId){
  const comprometido=data.faturas.filter(f=>!f.pago&&f.cartaoId===cartaoId).reduce((s,f)=>{
    const g=(f.gastos||[]).filter(x=>!x.pago).reduce((a,x)=>a+x.valor,0);
    return s+f.valor+g;
  },0);
  const cartao=(data.cartoes||[]).find(c=>c.id===cartaoId);
  const limite=cartao?(cartao.limite||0):0;
  const disponivel=limite-comprometido;
  const pct=limite>0?Math.max(0,Math.min(100,(comprometido/limite)*100)):0;
  const hoje=new Date();
  const faturaAtual=(data.faturas||[]).find(f=>f.cartaoId===cartaoId&&f.ano===hoje.getFullYear()&&f.mes===hoje.getMonth()+1&&!f.pago);
  const faturaAberta=faturaAtual?(faturaAtual.gastos||[]).reduce((s,g)=>s+g.valor,0):0;
  const faturaAbertaMes=faturaAtual?MONTH_NAMES[faturaAtual.mes-1]:null;
  return {comprometido,limite,disponivel,pct,faturaAberta,faturaAbertaMes};
}

/* ── parcelamento: divide uma compra parcelada nas faturas dos meses seguintes ── */
function nextMonth(ano,mes){ mes++; if(mes>12){ mes=1; ano++; } return {ano,mes}; }

function ensureFatura(ano,mes,cartaoId){
  cartaoId=cartaoId||(data.cartoes[0]&&data.cartoes[0].id);
  let f=data.faturas.find(x=>x.ano===ano&&x.mes===mes&&x.cartaoId===cartaoId);
  if(!f){ f={id:uid(),mes,ano,valor:0,pago:false,gastos:[],cartaoId}; data.faturas.push(f); }
  if(!f.gastos) f.gastos=[];
  return f;
}

function lancarParcelamento(nome,valorTotal,parcelas,anoIni,mesIni,categoria,cartaoId,dataCompra){
  parcelas=Math.max(1,parseInt(parcelas,10)||1);
  /* divide em centavos e joga o resto nas primeiras parcelas, senão a soma
     das parcelas não fecha com o valor da compra (100 em 3x = 99,99) */
  const centavos=Math.round((Number(valorTotal)||0)*100);
  const base=Math.trunc(centavos/parcelas);
  const resto=centavos-base*parcelas;
  const groupId=uid();
  let ano=anoIni, mes=mesIni;
  for(let i=0;i<parcelas;i++){
    const f=ensureFatura(ano,mes,cartaoId);
    const label=parcelas>1?`${nome} (${i+1}/${parcelas})`:nome;
    const parcelaValor=(base+(i<resto?1:0))/100;
    f.gastos.push({id:uid(),nome:label,valor:parcelaValor,pago:false,categoria:categoria||'Outros',parcelamentoId:groupId,dataCompra:i===0?dataCompra:undefined});
    const nx=nextMonth(ano,mes); ano=nx.ano; mes=nx.mes;
  }
  return groupId;
}

