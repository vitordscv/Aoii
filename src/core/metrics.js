/* ── gastos por categoria (faturas em aberto + gastos mensais fixos) ── */
const CATEGORIAS_DEFAULT=['Mercado','Transporte','Lazer','Saúde','Casa','Outros'];
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

/* ─── mesmos lançamentos do mês, mas linha a linha por categoria (usado no relatório exportado) ── */
function computeCategoryDetalhe(){
  const map={};
  const add=(cat,nome,val,data_,origem)=>{ cat=cat||'Outros'; if(!map[cat]) map[cat]=[]; map[cat].push({nome,val,data:data_,origem}); };
  const hoje0=new Date();
  data.faturas.forEach(f=>{ if(f.ano===hoje0.getFullYear()&&f.mes===hoje0.getMonth()+1) (f.gastos||[]).forEach(g=>{ add(g.categoria,g.nome,g.valor,null,'💳 '+(nomeCartao(f.cartaoId)||L('rp.cartao'))); }); });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,hoje0.getFullYear(),hoje0.getMonth()+1)) add(g.categoria,g.nome,g.valor,null,'🔁 '+L('rp.fixoDia').replace('{dia}',g.diaDoMes)); });
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00');
    if(d.getFullYear()===hoje0.getFullYear()&&d.getMonth()===hoje0.getMonth()){
      const metodoTxt=t.metodo==='dinheiro'?'💵 '+L('pay.dinheiro'):t.metodo==='pix'?'⚡ '+L('pay.pix'):'💳 '+L('pay.debito');
      add(t.categoria,t.nome,t.valor,d.toLocaleDateString(localeAtual(),{day:'2-digit',month:'2-digit'}),metodoTxt);
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

