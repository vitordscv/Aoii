/* ── patrimônio: saldo em conta + dinheiro vivo + guardado em metas ── */
function reservaContaNoPatrimonio(){
  /* só entra se a pessoa disse que guarda FORA da conta; se está na conta,
     o valor já vive dentro de data.saldoAtual e somar duplicaria */
  return data.reservaNaConta===false ? (data.reservaGuardado||0) : 0;
}
function patrimonioCalculado(){
  const metasGuardado=(data.metas||[]).reduce((s,m)=>s+(m.valorGuardado||0),0);
  return (data.saldoAtual||0)+(data.dinheiroVivo||0)+metasGuardado+reservaContaNoPatrimonio();
}

/* ── aporte mensal automático nas metas: soma sozinho quando o mês vira ── */
function aplicarAportesAutomaticos(){
  const t=today(); const chave=`${t.getFullYear()}-${t.getMonth()+1}`;
  let mudou=false;
  (data.metas||[]).forEach(m=>{
    if(!(m.aporteMensal>0)) return;
    if(m.ultimoAporte===chave) return;
    const alvo=m.valorAlvo||0;
    const antes=m.valorGuardado||0;
    const depois=alvo>0?Math.min(alvo,antes+m.aporteMensal):antes+m.aporteMensal;
    const movido=depois-antes;
    if(movido<=0){ m.ultimoAporte=chave; return; }
    m.valorGuardado=depois;
    /* o dinheiro sai da conta e vai pra meta — sem isso o patrimônio
       (saldo + dinheiro vivo + guardado) crescia sozinho todo mês */
    data.saldoAtual=(data.saldoAtual||0)-movido;
    data.saldoAtualizadoEm=new Date().toISOString();
    m.ultimoAporte=chave;
    mudou=true;
  });
  return mudou;
}

function ensurePatrimonioSnapshot(){
  const hoje=new Date();
  const ano=hoje.getFullYear(), mes=hoje.getMonth()+1;
  if(!data.patrimonioHistorico) data.patrimonioHistorico=[];
  let entry=data.patrimonioHistorico.find(p=>p.ano===ano&&p.mes===mes);
  const calc=patrimonioCalculado();
  let changed=false;
  if(!entry){
    data.patrimonioHistorico.push({ano,mes,valor:calc,manual:false});
    data.patrimonioHistorico.sort((a,b)=>(a.ano*12+a.mes)-(b.ano*12+b.mes));
    changed=true;
  }else if(!entry.manual&&entry.valor!==calc){
    entry.valor=calc;
    changed=true;
  }
  return changed;
}

