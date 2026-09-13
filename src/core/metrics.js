/* ── gastos por categoria (faturas em aberto + gastos mensais fixos) ── */
const CATEGORIAS_DEFAULT=['Mercado','Transporte','Lazer','Saúde','Casa','Assinaturas','Outros'];
function CATS(){ return (data&&data.categorias&&data.categorias.length)?data.categorias:CATEGORIAS_DEFAULT; }
function computeCategoryBreakdown(){
  const map={};
  const add=(cat,val)=>{ cat=cat||'Outros'; map[cat]=(map[cat]||0)+val; };
  const hoje0=new Date();
  data.faturas.forEach(f=>{ if(f.ano===hoje0.getFullYear()&&f.mes===hoje0.getMonth()+1) (f.gastos||[]).forEach(g=>{ add(g.categoria,g.valor); }); });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,hoje0.getFullYear(),hoje0.getMonth()+1)) add(g.categoria,g.valor); });
  const hoje=new Date();
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00');
    if(d.getFullYear()===hoje.getFullYear()&&d.getMonth()===hoje.getMonth()) add(t.categoria,t.valor);
  });
  const entries=Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const total=entries.reduce((s,[,v])=>s+v,0);
  return {entries,total};
}

/* dia em que a fatura de (ano,mes) vence, pelo cartão dela */
function vencimentoDaFatura(f){
  const cartao=(data.cartoes||[]).find(c=>c.id===f.cartaoId);
  const dia=Math.min(31,Math.max(1,(cartao&&cartao.diaVencimento)||data.diaVencimentoFatura||10));
  return dataNoMes(f.ano,f.mes,dia);
}

/* ─── mesmos lançamentos do mês, linha a linha por categoria (usado no
       relatório exportado) ─────────────────────────────────────────────

   Cada item leva `realizado`: o dinheiro JÁ saiu da conta, ou ainda vai sair
   antes do fim do mês. O relatório somava os dois num total único, e com isso
   misturava um débito do dia 3 com uma conta que vence no dia 20 — número que
   não bate com extrato nenhum.

   O critério é o mesmo que o app já usa pra parar de descontar uma despesa da
   projeção: passou o dia, ou foi marcada como paga. */
function computeCategoryDetalhe(){
  const map={};
  const add=(cat,nome,val,iso,origem,realizado)=>{ cat=cat||'Outros'; if(!map[cat]) map[cat]=[]; map[cat].push({nome,val,iso,origem,realizado}); };
  const hoje0=new Date();
  const t=today();
  const ano=hoje0.getFullYear(), mes=hoje0.getMonth()+1;
  data.faturas.forEach(f=>{
    if(f.ano!==ano||f.mes!==mes) return;
    /* a fatura vencida e não marcada conta como paga pelo mesmo motivo das
       contas fixas: não dá pra supor que o cartão segue em aberto pra sempre */
    /* a data da compra no cartão é o dia em que a FATURA sai da conta — é
       essa que bate com o extrato, não o dia em que se passou o cartão */
    const vence=vencimentoDaFatura(f);
    const saiu=!!f.pago||startOfDay(vence)<=t;
    (f.gastos||[]).forEach(g=>{ add(g.categoria,g.nome,g.valor,isoDate(vence),'💳 '+(nomeCartao(f.cartaoId)||L('rp.cartao')),saiu||!!g.pago); });
  });
  (data.gastosMensais||[]).forEach(g=>{
    if(!gastoFixoAtivoEm(g,ano,mes)) return;
    const vence=dataNoMes(ano,mes,g.diaDoMes);
    const saiu=gastoFixoPagoEm(g,ano,mes)||startOfDay(vence)<=t;
    add(g.categoria,g.nome,g.valor,isoDate(vence),'🔁 '+L('rp.fixoDia').replace('{dia}',g.diaDoMes),saiu);
  });
  transacoesGasto().forEach(tr=>{
    const d=new Date(tr.data+'T12:00:00');
    if(d.getFullYear()===ano&&d.getMonth()+1===mes){
      const metodoTxt=tr.metodo==='dinheiro'?'💵 '+L('pay.dinheiro'):tr.metodo==='pix'?'⚡ '+L('pay.pix'):'💳 '+L('pay.debito');
      add(tr.categoria,tr.nome,tr.valor,tr.data,metodoTxt,startOfDay(d)<=t);
    }
  });
  Object.values(map).forEach(list=>list.sort((a,b)=>b.val-a.val));
  return map;
}

/* ─── total gasto por categoria no mês anterior, pra comparar no relatório ── */
function computeCategoryPrevMonth(){
  const t=today();
  let mm=t.getMonth(), yy=t.getFullYear();
  mm--; if(mm<0){ mm=11; yy--; }
  const map={};
  const add=(cat,val)=>{ cat=cat||'Outros'; map[cat]=(map[cat]||0)+val; };
  data.faturas.forEach(f=>{ if(f.ano===yy&&f.mes===mm+1) (f.gastos||[]).forEach(g=>{ add(g.categoria,g.valor); }); });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,yy,mm+1)) add(g.categoria,g.valor); });
  transacoesGasto().forEach(t2=>{
    const d=new Date(t2.data+'T12:00:00');
    if(d.getFullYear()===yy&&d.getMonth()===mm) add(t2.categoria,t2.valor);
  });
  return map;
}

