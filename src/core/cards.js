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

/* ── comandos de cartão: validam antes de alterar cartões e referências ── */
function camposCartao(entrada,atual){
  entrada=entrada||{}; atual=atual||{};
  const ler=(campo)=>Object.prototype.hasOwnProperty.call(entrada,campo)?entrada[campo]:atual[campo];
  const nome=String(ler('nome')||'').trim();
  /* O limite é opcional — e o rótulo do campo diz isso. Vazio vale zero, do
     mesmo jeito que dia vazio vale null: quem digita nada não está errando,
     está deixando em branco. Antes, campo vazio chegava aqui como NaN (é o
     que parseNum devolve pra texto sem dígito), a validação recusava o cartão
     inteiro e a folha fechava sem salvar e sem dizer nada. Texto ilegível —
     "abc" — continua sendo NaN e continua sendo recusado. */
  const limiteBruto=ler('limite');
  const limite=(limiteBruto===null||limiteBruto===undefined||limiteBruto==='')?0:Number(limiteBruto);
  function dia(campo){
    const bruto=ler(campo);
    if(bruto===null||bruto===undefined||bruto==='') return null;
    const n=Number(bruto);
    return Number.isInteger(n)&&n>=1&&n<=31?n:NaN;
  }
  const diaFechamento=dia('diaFechamento');
  const diaVencimento=dia('diaVencimento');
  if(!nome||!Number.isFinite(limite)||limite<0||Number.isNaN(diaFechamento)||Number.isNaN(diaVencimento)) return null;
  return {nome,limite,diaFechamento,diaVencimento};
}

function criarCartao(entrada){
  const campos=camposCartao(entrada);
  if(!campos) return null;
  if(!data.cartoes) data.cartoes=[];
  const cartao={id:uid(),...campos};
  data.cartoes.push(cartao);
  return cartao;
}

function atualizarCartao(id,alteracoes){
  const cartao=(data.cartoes||[]).find(c=>c.id===id);
  if(!cartao) return null;
  const campos=camposCartao(alteracoes,cartao);
  if(!campos) return null;
  Object.assign(cartao,campos);
  return cartao;
}

function removerCartao(id){
  const cartoes=data.cartoes||[];
  const indice=cartoes.findIndex(c=>c.id===id);
  if(indice<0) return null;
  const removido=cartoes[indice];
  const restantes=cartoes.filter(c=>c.id!==id);
  const destinoId=restantes.length?restantes[0].id:null;
  const faturas=data.faturas||[];
  const preservadas=faturas.filter(f=>f.cartaoId!==id);

  faturas.filter(f=>f.cartaoId===id).forEach(f=>{
    const destino=destinoId&&preservadas.find(x=>x.cartaoId===destinoId&&x.ano===f.ano&&x.mes===f.mes);
    if(destino){
      destino.valor=(Number(destino.valor)||0)+(Number(f.valor)||0);
      destino.gastos=[...(destino.gastos||[]),...(f.gastos||[])];
      destino.pago=Boolean(destino.pago)&&Boolean(f.pago);
    }else{
      f.cartaoId=destinoId;
      preservadas.push(f);
    }
  });

  (data.comprasPlanejadas||[]).forEach(c=>{
    if(c.cartaoId===id) c.cartaoId=destinoId;
  });
  data.cartoes=restantes;
  data.faturas=preservadas;
  return {item:removido,indice,destinoId};
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
