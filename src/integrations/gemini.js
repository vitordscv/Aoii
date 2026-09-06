
function montarResumoFinanceiroParaIA(){
  const t=computeTotals();
  const cat=computeCategoryBreakdown();
  const w=computeWeekSummary();
  const saude=computeSaudeFinanceira();
  const cartoes=(data.cartoes||[]).map(c=>{ const i=computeCartao(c.id); return `${c.nome}: ${i.pct.toFixed(0)}% do limite usado, disponível ${formatBRL(i.disponivel)}${i.faturaAberta>0?`, fatura em aberto ${formatBRL(i.faturaAberta)}`:''}`; }).join('; ')||'nenhum';
  const metas=(data.metas||[]).map(m=>`${m.nome}: ${formatBRL(m.valorGuardado||0)} de ${formatBRL(m.valorAlvo||0)}${m.aporteMensal>0?` (aporte automático ${formatBRL(m.aporteMensal)}/mês)`:''}`).join('; ')||'nenhuma';
  const fixos=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,today().getFullYear(),today().getMonth()+1)).map(g=>`${g.nome} ${formatBRL(g.valor)} (dia ${g.diaDoMes})`).join('; ')||'nenhum';
  const faturasPendentes=(data.faturas||[]).filter(f=>!f.pago).map(f=>`${MONTH_NAMES[f.mes-1]}/${f.ano}${nomeCartao(f.cartaoId)?` (${nomeCartao(f.cartaoId)})`:''}: ${formatBRL(f.valor+(f.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0))}`).join('; ')||'nenhuma';
  const viagens=(data.viagens||[]).map(v=>{ const g=transacoesGasto().filter(t=>t.viagemId===v.id).reduce((s,t)=>s+t.valor,0); return `${v.nome}: ${formatBRL(g)}${v.orcamento>0?` de ${formatBRL(v.orcamento)}`:''}`; }).join('; ')||'nenhuma';
  const orcamentos=Object.entries(data.orcamentos||{}).filter(([,v])=>v>0).map(([c,v])=>`${c} teto ${formatBRL(v)} (gasto atual ${formatBRL(cat.entries.find(([cc])=>cc===c)?.[1]||0)})`).join('; ')||'sem tetos definidos';
  const custoEss=custoMensalEssencial();
  const reservaAlvo=custoEss*(data.reservaMeses||3);
  const reservaTxt=custoEss>0
    ? `${formatBRL(data.reservaGuardado||0)} guardados de um alvo de ${formatBRL(reservaAlvo)} (${data.reservaMeses||3} meses do custo essencial de ${formatBRL(custoEss)}/mês) — cobre ${(custoEss>0?(data.reservaGuardado||0)/custoEss:0).toFixed(1)} mês(es)`
    : 'sem gastos fixos cadastrados para calcular';
  const rendas=rendasRecorrentesAtivas().map(r=>`${r.nome||tipoRenda(r.tipo).label} ${formatBRL(r.valor)} (dia ${r.diaDoMes})`).join('; ')||'nenhuma';
  const aReceber=(data.entradasExtras||[]).filter(e=>!e.feito).map(e=>`${e.nome} ${formatBRL(e.valor)}`).join('; ')||'nenhuma';
  const planejadas=(data.comprasPlanejadas||[]).filter(c=>!c.feito).map(c=>`${c.nome} ${formatBRL(c.valor)}${c.cartao?' (no cartão)':''}`).join('; ')||'nenhuma';
  const investimentos=(data.investimentos||[]).map(i=>`${i.nome} ${formatBRL(i.valorInvestido||0)}${i.tipo?` (${tipoInvest(i.tipo).label})`:''}`).join('; ')||'nenhum';
  const anoA=today().getFullYear(), mesA=today().getMonth()+1;
  let pm=mesA-1, pa=anoA; if(pm<1){ pm=12; pa--; }
  const gastoMesAtual=computeMonthSpend(anoA,mesA), gastoMesPassado=computeMonthSpend(pa,pm);
  const compMes=gastoMesPassado>0
    ? `${formatBRL(gastoMesAtual)} este mês vs ${formatBRL(gastoMesPassado)} no mês passado (${Math.round(((gastoMesAtual-gastoMesPassado)/gastoMesPassado)*100)}%)`
    : `${formatBRL(gastoMesAtual)} este mês (sem histórico do mês passado)`;
  return `Saúde financeira (score 0-100): ${saude.score}. Motivos: ${saude.motivos.join('; ')||'—'}.
Saldo atual: ${formatBRL(data.saldoAtual||0)}. Dinheiro vivo: ${formatBRL(data.dinheiroVivo||0)}. Saldo projetado até a data-alvo: ${formatBRL(t.projetado)}.
Patrimônio total: ${formatBRL(patrimonioCalculado())}.
Renda média mensal: ${formatBRL(rendaMediaMensal())}. Rendas recorrentes ativas: ${rendas}.
Gasto nos últimos 7 dias: ${formatBRL(w.gastoSemana)}.${w.livreAteFimDoMes!==null?` Livre até o fim do mês: ${formatBRL(w.livreAteFimDoMes)}.`:''}
Comparação de gasto mês a mês: ${compMes}.
Gastos por categoria este mês: ${cat.entries.map(([c,v])=>`${c} ${formatBRL(v)}`).join(', ')||'nenhum'}.
Tetos de orçamento por categoria: ${orcamentos}.
Gastos fixos mensais ativos: ${fixos}.
Cartões de crédito: ${cartoes}.
Faturas pendentes: ${faturasPendentes}.
Reserva de emergência: ${reservaTxt}.
Metas de economia: ${metas}.
Investimentos: ${investimentos}.
Entradas extras a receber: ${aReceber}.
Compras planejadas (ainda não compradas): ${planejadas}.
Viagens/eventos com orçamento próprio: ${viagens}.`;
}

function idiomaNomeCompleto(){ return ({pt:'português do Brasil',en:'English',es:'español',fr:'français',it:'italiano'})[data.idioma||'pt']; }
async function perguntarIA(pergunta){
  const resumo=montarResumoFinanceiroParaIA();
  const prompt=`Você é um consultor financeiro pessoal, direto e prático, respondendo em ${idiomaNomeCompleto()}. Aqui estão os dados financeiros atuais do usuário:\n\n${resumo}\n\nPergunta do usuário: ${pergunta}\n\nResponda em no máximo 5 frases, sem rodeios, com base nesses dados.`;
  return chamarGemini(prompt);
}

/* ── mesma coisa, mas mantendo o histórico da conversa do chat (reanalisa os dados a cada pergunta) ── */
async function perguntarIAComHistorico(historico){
  const resumo=montarResumoFinanceiroParaIA();
  const conversa=historico.map(h=>`${h.role==='user'?'Usuário':'Consultor'}: ${h.texto}`).join('\n');
  const prompt=`Você é um consultor financeiro pessoal, direto e prático, respondendo em ${idiomaNomeCompleto()}. Aqui estão os dados financeiros ATUAIS do usuário (sempre atualizados a cada pergunta):\n\n${resumo}\n\nConversa até agora:\n${conversa}\n\nResponda à última pergunta do usuário em no máximo 5 frases, sem rodeios, com base nesses dados.`;
  return chamarGemini(prompt);
}

async function chamarGemini(prompt){
  const chave=getIaChave();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
  const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),20000);
  try{
    const res=await fetch(url,{
      method:'POST', signal:ctrl.signal,
      headers:{'Content-Type':'application/json','x-goog-api-key':chave},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    if(!res.ok){
      if(res.status===400||res.status===403) throw new Error(L('ia.erroChave'));
      let detalhe='';
      try{ const errJson=await res.json(); detalhe=errJson?.error?.message||''; }catch(e){}
      throw new Error(L('ia.erroConexao').replace('{status}',res.status)+(detalhe?' '+detalhe:''));
    }
    const json=await res.json();
    const texto=json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!texto) throw new Error(L('ia.erroVazio'));
    return texto.trim();
  }finally{ clearTimeout(to); }
}
function renderIaPergunta(){
  const el=document.getElementById('ia-pergunta-card'); if(!el) return;
  if(!iaAtiva()){ el.innerHTML=''; return; }
  el.innerHTML=`
  <div class="ia-ask-box">
    <div class="ia-ask-title">🤖 <span data-i18n="ia.consultorTitle2">Pergunte ao consultor</span></div>
    <div class="ia-ask-row">
      <input type="text" id="ia-ask-input" placeholder="Ex: dá pra eu comprar algo de R$300 esse mês?" data-i18n-placeholder="ia.exemploPergunta">
      <button type="button" id="ia-ask-btn" data-i18n="ia.perguntar">Perguntar</button>
    </div>
    <div class="ia-ask-chips">
      <button type="button" class="ia-ask-chip" data-q="Como está minha saúde financeira esse mês?" data-i18n="ia.chipComoEstou">Como estou indo?</button>
      <button type="button" class="ia-ask-chip" data-q="Onde eu posso cortar gastos esse mês?" data-i18n="ia.chipCortar">Onde cortar gastos?</button>
      <button type="button" class="ia-ask-chip" data-q="Estou no caminho certo pra bater minhas metas?" data-i18n="ia.chipMetas">Vou bater minhas metas?</button>
    </div>
    <div id="ia-ask-resposta" class="ia-ask-resposta"></div>
  </div>`;
  const input=document.getElementById('ia-ask-input');
  const btn=document.getElementById('ia-ask-btn');
  const resp=document.getElementById('ia-ask-resposta');
  async function ask(pergunta){
    if(!pergunta||!pergunta.trim()) return;
    btn.disabled=true; resp.className='ia-ask-resposta loading'; resp.textContent=L('ia.pensando');
    try{
      const texto=await perguntarIA(pergunta.trim());
      resp.className='ia-ask-resposta'; resp.textContent=texto;
    }catch(err){
      resp.className='ia-ask-resposta'; resp.textContent='⚠️ '+(err.message||'Erro ao falar com a IA.');
    }finally{ btn.disabled=false; }
  }
  btn.addEventListener('click',()=>ask(input.value));
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') ask(input.value); });
  el.querySelectorAll('.ia-ask-chip').forEach(chip=>chip.addEventListener('click',()=>ask(chip.getAttribute('data-q'))));
}

