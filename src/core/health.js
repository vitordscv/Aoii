/* Tem algum número de verdade pra medir? Renda configurada, ou qualquer
   despesa registrada. Sem isso não há saúde financeira nenhuma pra calcular —
   só a soma dos pontos que o app dá por ausência de problema. */
function temDadoParaSaude(){
  const temRenda=(data.tipoRenda==='diaria'&&data.rendaDiaria>0)
    ||(data.tipoRenda==='mensal'&&data.rendaMensal&&data.rendaMensal.valor>0)
    ||rendasRecorrentesAtivas().length>0;
  const temDespesa=(data.transacoes||[]).length>0
    ||(data.gastosMensais||[]).length>0
    ||(data.faturas||[]).some(f=>(f.valor||0)>0||(f.gastos||[]).length>0);
  return temRenda||temDespesa;
}

/* ── indicador de saúde financeira: score simples 0-100 baseado em orçamento, saldo projetado, faturas e metas ──

   Num app recém-instalado a conta dava 70/100: +20 por não ter orçamento, +30
   por a projeção de zero não ser negativa, +20 por não haver fatura atrasada.
   Três quartos da nota vinham de ainda não haver nada cadastrado — e isso
   aparecia como a primeira avaliação que a pessoa lê sobre a vida financeira
   dela. Nota inventada em cima de nada é pior do que nota nenhuma. */
function computeSaudeFinanceira(){
  if(!temDadoParaSaude()) return {score:null,motivos:[]};
  let score=0; const motivos=[];
  const t=today(); const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  const orcamentoTotal=Object.values(data.orcamentos||{}).reduce((s,v)=>s+(v||0),0);
  const gastoMes=computeMonthSpend(anoA,mesA);
  if(orcamentoTotal>0){
    if(gastoMes<=orcamentoTotal){ score+=40; motivos.push(L('saude.dentroOrcamento')); }
    else{ score+=Math.max(0,40-Math.round(((gastoMes-orcamentoTotal)/orcamentoTotal)*40)); motivos.push(L('saude.acimaOrcamento')); }
  }else{ score+=20; }
  const proj=computeTotals().projetado;
  if(proj>=0){ score+=30; motivos.push(L('saude.saldoPositivo')); } else motivos.push(L('saude.saldoNegativo'));
  const atrasada=(data.faturas||[]).some(f=>!f.pago&&startOfDay(vencimentoDaFatura(f))<t);
  if(!atrasada){ score+=20; } else motivos.push(L('saude.faturaAtrasada'));
  const guardouAlgo=(data.metas||[]).some(m=>m.aporteMensal>0)
    ||(data.metas||[]).some(m=>(m.valorGuardado||0)>0)
    ||(orcamentoTotal>0&&gastoMes<orcamentoTotal);
  if(guardouAlgo){ score+=10; }
  return {score:Math.min(100,score),motivos};
}

/* ── resumo semanal: gasto dos últimos 7 dias + quanto ainda dá pra gastar até o fim do mês ── */
function computeWeekSummary(){
  const t=today();
  const seteDiasAtras=new Date(t); seteDiasAtras.setDate(seteDiasAtras.getDate()-6);
  let gastoSemana=0;
  transacoesGasto().forEach(tr=>{
    const d=startOfDay(new Date(tr.data+'T12:00:00')); // normaliza: hoje conta
    if(d>=seteDiasAtras&&d<=t) gastoSemana+=tr.valor;
  });
  const anoA=t.getFullYear(), mesA=t.getMonth()+1;
  const orcamentoTotal=Object.values(data.orcamentos||{}).reduce((s,v)=>s+(v||0),0);
  const gastoMes=computeMonthSpend(anoA,mesA);
  const diasNoMes=new Date(anoA,mesA,0).getDate();
  const diasRestantes=Math.max(1,diasNoMes-t.getDate()+1);
  const livreAteFimDoMes=orcamentoTotal>0?Math.max(0,orcamentoTotal-gastoMes):null;
  return {gastoSemana,livreAteFimDoMes,diasRestantes};
}

/* ── total realmente gasto num mês (transações + fatura do mês + fixos ativos), p/ comparação mês a mês ── */
/* ── receitas do mês, linha a linha, separando o que JÁ CAIU do que ainda vai
      cair ─────────────────────────────────────────────────────────────────

   Cada item leva `realizado`. Sem essa marca o relatório somava tudo num
   total só, e quem recebesse o documento não tinha como conciliar com
   extrato nenhum: um salário que cai no dia 20 aparecia como recebido num
   documento emitido no dia 3.

   O critério é de CAIXA — "o dinheiro entrou até hoje" —, que é o que dá
   para conferir contra um extrato bancário. */
function computeReceitasMesDetalhe(){
  const t=today(); const y=t.getFullYear(), m=t.getMonth();
  const itens=[];
  const jaChegou=dia=>dataNoMes(y,m+1,dia)<=t;
  /* o contador precisa saber QUANDO cada linha cai, não só que cai. Vai em ISO:
     quem desenha formata, e o CSV sai com data que planilha entende. */

  (data.transacoes||[]).forEach(tr=>{
    if(tr.tipo!=='receita') return;
    const d=new Date(tr.data+'T12:00:00');
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m) return;
    /* lançamento com data futura existe: quem antecipa o registro de algo
       combinado. Ele é previsto até o dia chegar. */
    itens.push({nome:tr.nome||L('rp.entrada'),val:tr.valor,tag:L('rp.entradaAvulsa'),
      iso:tr.data,realizado:startOfDay(d)<=t});
  });

  (data.entradasExtras||[]).forEach(e=>{
    const quando=e.feitoEm||e.dataPrevista;
    if(!quando) return;                 // sem data não dá pra dizer que é deste mês
    const d=new Date(quando+'T12:00:00');
    if(isNaN(d)||d.getFullYear()!==y||d.getMonth()!==m) return;
    /* as não recebidas passam a aparecer também, do lado do previsto: antes
       sumiam do relatório e o contador não sabia que eram esperadas */
    itens.push({nome:e.nome||L('rp.entradaExtra'),val:e.valor,tag:L('rp.entradaExtra'),
      iso:quando,realizado:!!e.feito});
  });

  rendasRecorrentesAtivas().forEach(r=>{
    itens.push({nome:r.nome||L('rp.rendaRecorrente'),val:r.valor,tag:L('rp.rendaRecorrente'),
      iso:isoDate(dataNoMes(y,m+1,r.diaDoMes)),realizado:jaChegou(r.diaDoMes)});
  });

  if(data.tipoRenda==='mensal'&&data.rendaMensal&&data.rendaMensal.valor>0){
    itens.push({nome:L('rp.rendaMensalPrincipal'),val:data.rendaMensal.valor,tag:L('rp.rendaFixa'),
      iso:isoDate(dataNoMes(y,m+1,data.rendaMensal.diaDoMes)),realizado:jaChegou(data.rendaMensal.diaDoMes)});
  }else if(data.tipoRenda==='diaria'&&data.rendaDiaria>0){
    /* a diária vira duas linhas: os dias já trabalhados e os que faltam. Uma
       linha só obrigaria a chamar o mês inteiro de recebido. */
    const folgas=new Set(data.diasNaoTrabalhados||[]);
    const diasNoMes=new Date(y,m+1,0).getDate();
    let ateHoje=0, depois=0;
    for(let d=1;d<=diasNoMes;d++){
      const dt=new Date(y,m,d);
      if(!(data.diasTrabalho||[]).includes(dt.getDay())||folgas.has(isoDate(dt))) continue;
      if(startOfDay(dt)<=t) ateHoje++; else depois++;
    }
    if(ateHoje) itens.push({nome:L('rp.rendaPorDia').replace('{n}',ateHoje),
      val:data.rendaDiaria*ateHoje,tag:L('rp.rendaDiaria'),realizado:true});
    if(depois) itens.push({nome:L('rp.rendaPorDia').replace('{n}',depois),
      val:data.rendaDiaria*depois,tag:L('rp.rendaDiaria'),realizado:false});
  }
  return itens;
}

function computeMonthSpend(ano,mes){
  let total=0;
  transacoesGasto().forEach(t=>{
    const d=new Date(t.data+'T12:00:00');
    if(d.getFullYear()===ano&&d.getMonth()+1===mes) total+=t.valor;
  });
  (data.faturas||[]).forEach(f=>{
    if(f.ano===ano&&f.mes===mes) total+=(f.gastos||[]).reduce((s,g)=>s+g.valor,0);
  });
  (data.gastosMensais||[]).forEach(g=>{ if(gastoFixoAtivoEm(g,ano,mes)) total+=g.valor; });
  return total;
}
