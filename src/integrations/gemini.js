
/* ─── o que sai daqui para o Google ───────────────────────────────────────
   O resumo é montado no aparelho e mandado inteiro para o Gemini junto com a
   pergunta. Vale a regra do guia: nome de pessoa, de banco e de empregador não
   vão sem necessidade — e não há necessidade nenhuma, porque a IA responde
   igualmente bem sobre "Cartão 1".

   Fica de fora, de propósito:
     · o credor de cada dívida — é o nome de OUTRA pessoa, que nem usa o app
     · o nome do cartão, que na prática é o nome do banco
     · o nome livre de cada renda, que costuma ser o empregador
       ("Salário · TechBrasil" é o exemplo que o próprio campo sugere)
     · as notas dos lançamentos, que nunca foram enviadas

   Continua indo o que a própria pessoa nomeou sobre a vida dela — metas,
   viagens, contas fixas, compras planejadas, ativos: sem isso ela não
   consegue perguntar "como está a viagem a Portugal?", que é metade do valor
   do recurso. Se um dia isso incomodar, o lugar de mexer é aqui. */
function rotuloDoCartao(cartaoId){
  const i=(data.cartoes||[]).findIndex(c=>c.id===cartaoId);
  return i<0?L('ia.cartaoSemNome'):L('ia.cartaoNumero').replace('{n}',i+1);
}

function montarResumoFinanceiroParaIA(){
  const t=computeTotals();
  const cat=computeCategoryBreakdown();
  const w=computeWeekSummary();
  const saude=computeSaudeFinanceira();
  const cartoes=(data.cartoes||[]).map(c=>{ const i=computeCartao(c.id); return `${rotuloDoCartao(c.id)}: ${i.pct.toFixed(0)}% do limite usado, disponível ${formatBRL(i.disponivel)}${i.faturaAberta>0?`, fatura em aberto ${formatBRL(i.faturaAberta)}`:''}`; }).join('; ')||'nenhum';
  const metas=(data.metas||[]).map(m=>`${m.nome}: ${formatBRL(m.valorGuardado||0)} de ${formatBRL(m.valorAlvo||0)}${m.aporteMensal>0?` (aporte automático ${formatBRL(m.aporteMensal)}/mês)`:''}`).join('; ')||'nenhuma';
  const fixos=(data.gastosMensais||[]).filter(g=>gastoFixoAtivoEm(g,today().getFullYear(),today().getMonth()+1)).map(g=>`${g.nome} ${formatBRL(g.valor)} (dia ${g.diaDoMes})`).join('; ')||'nenhum';
  const faturasPendentes=(data.faturas||[]).filter(f=>!f.pago).map(f=>`${MONTH_NAMES[f.mes-1]}/${f.ano}${f.cartaoId?` (${rotuloDoCartao(f.cartaoId)})`:''}: ${formatBRL(f.valor+(f.gastos||[]).filter(g=>!g.pago).reduce((s,g)=>s+g.valor,0))}`).join('; ')||'nenhuma';
  const viagens=(data.viagens||[]).map(v=>{ const g=gastoDaViagem(v.id); return `${v.nome}: ${formatBRL(g)}${v.orcamento>0?` de ${formatBRL(v.orcamento)}`:''}`; }).join('; ')||'nenhuma';
  const orcamentos=Object.entries(data.orcamentos||{}).filter(([,v])=>v>0).map(([c,v])=>`${categoriaLabel(c)} teto ${formatBRL(v)} (gasto atual ${formatBRL(cat.entries.find(([cc])=>cc===c)?.[1]||0)})`).join('; ')||'sem tetos definidos';
  const custoEss=custoMensalEssencial();
  const reservaAlvo=custoEss*(data.reservaMeses||3);
  const reservaTxt=custoEss>0
    ? `${formatBRL(data.reservaGuardado||0)} guardados de um alvo de ${formatBRL(reservaAlvo)} (${data.reservaMeses||3} meses do custo essencial de ${formatBRL(custoEss)}/mês) — cobre ${(custoEss>0?(data.reservaGuardado||0)/custoEss:0).toFixed(1)} mês(es)`
    : 'sem gastos fixos cadastrados para calcular';
  /* o tipo da renda, não o nome livre: o nome costuma ser o empregador */
  const rendas=rendasRecorrentesAtivas().map(r=>`${tipoRenda(r.tipo).label} ${formatBRL(r.valor)} (dia ${r.diaDoMes})`).join('; ')||'nenhuma';
  const aReceber=(data.entradasExtras||[]).filter(e=>!e.feito).map(e=>`${e.nome} ${formatBRL(e.valor)}`).join('; ')||'nenhuma';
  /* sem o credor: é o nome de outra pessoa, que nem usa o app */
  const deve=(data.dividas||[]).filter(d=>!d.quitado).map(d=>`${d.nome}: falta ${formatBRL(restanteDivida(d))} de ${formatBRL(d.valor)}`).join('; ')||'nenhuma';
  const planejadas=(data.comprasPlanejadas||[]).filter(c=>!c.feito).map(c=>`${c.nome} ${formatBRL(c.valor)}${c.cartao?' (no cartão)':''}`).join('; ')||'nenhuma';
  const investimentos=(data.investimentos||[]).map(i=>`${i.nome} ${formatBRL(i.valorInvestido||0)}${i.tipo?` (${tipoInvest(i.tipo).label})`:''}`).join('; ')||'nenhum';
  const anoA=today().getFullYear(), mesA=today().getMonth()+1;
  let pm=mesA-1, pa=anoA; if(pm<1){ pm=12; pa--; }
  const gastoMesAtual=computeMonthSpend(anoA,mesA), gastoMesPassado=computeMonthSpend(pa,pm);
  const compMes=gastoMesPassado>0
    ? `${formatBRL(gastoMesAtual)} este mês vs ${formatBRL(gastoMesPassado)} no mês passado (${Math.round(((gastoMesAtual-gastoMesPassado)/gastoMesPassado)*100)}%)`
    : `${formatBRL(gastoMesAtual)} este mês (sem histórico do mês passado)`;
  return `Saúde financeira (score 0-100): ${saude.score===null?'ainda sem dados suficientes para calcular':saude.score}. Motivos: ${saude.motivos.join('; ')||'—'}.
Saldo atual: ${formatBRL(data.saldoAtual||0)}. Dinheiro vivo: ${formatBRL(data.dinheiroVivo||0)}. Saldo projetado até a data-alvo: ${formatBRL(t.projetado)}.
Patrimônio total: ${formatBRL(patrimonioCalculado())}.
Renda média mensal: ${formatBRL(rendaMediaMensal())}. Rendas recorrentes ativas: ${rendas}.
Gasto nos últimos 7 dias: ${formatBRL(w.gastoSemana)}.${w.livreAteFimDoMes!==null?` Livre até o fim do mês: ${formatBRL(w.livreAteFimDoMes)}.`:''}
Comparação de gasto mês a mês: ${compMes}.
Gastos por categoria este mês: ${cat.entries.map(([c,v])=>`${categoriaLabel(c)} ${formatBRL(v)}`).join(', ')||'nenhum'}.
Tetos de orçamento por categoria: ${orcamentos}.
Gastos fixos mensais ativos: ${fixos}.
Cartões de crédito: ${cartoes}.
Faturas pendentes: ${faturasPendentes}.
Reserva de emergência: ${reservaTxt}.
Metas de economia: ${metas}.
Investimentos: ${investimentos}.
Entradas extras a receber: ${aReceber}.
Compras planejadas (ainda não compradas): ${planejadas}.
Dívidas com pessoas (o que ainda falta pagar): ${deve}.
Viagens/eventos com orçamento próprio: ${viagens}.`;
}

/* O resumo é uma FOTOGRAFIA com totais, não o extrato. Dizer isso ao modelo é
   o que separa "não tenho esse dado" de um número inventado com confiança.

   Sem esta lista, perguntar "quanto gastei com mercado em julho?" rendia uma
   resposta redonda e plausível montada a partir do total de UM mês — que é o
   único que existe aqui. Num app de dinheiro isso não pode acontecer. */
function limitesDoResumoParaIA(){
  return `O que você NÃO tem, e portanto não deve estimar nem inventar:
- os lançamentos um a um (só existem os totais por categoria DESTE mês, sem descrição, data ou forma de pagamento);
- qualquer histórico além da comparação deste mês com o anterior — nada de três, seis ou doze meses, nem por categoria;
- o que há dentro de cada fatura (só o total de cada uma);
- a projeção mês a mês (só o saldo final na data-alvo);
- em que dias o dinheiro saiu.
Se a pergunta depender de algo dessa lista, diga com todas as letras que o dado não está disponível e responda com o que dá, em vez de estimar.`;
}

function idiomaNomeCompleto(){ return ({pt:'português do Brasil',en:'English',es:'español',fr:'français',it:'italiano'})[data.idioma||'pt']; }
async function perguntarIA(pergunta,aoTentarDeNovo){
  const resumo=montarResumoFinanceiroParaIA();
  const prompt=`Você é um consultor financeiro pessoal, direto e prático, respondendo em ${idiomaNomeCompleto()}. Aqui estão os dados financeiros atuais do usuário:\n\n${resumo}\n\n${limitesDoResumoParaIA()}\n\nPergunta do usuário: ${pergunta}\n\nResponda em no máximo 5 frases, sem rodeios, com base nesses dados.`;
  return chamarGemini(prompt,aoTentarDeNovo);
}

/* ── mesma coisa, mas mantendo o histórico da conversa do chat (reanalisa os dados a cada pergunta) ── */
async function perguntarIAComHistorico(historico,aoTentarDeNovo){
  const resumo=montarResumoFinanceiroParaIA();
  const conversa=historico.map(h=>`${h.role==='user'?'Usuário':'Consultor'}: ${h.texto}`).join('\n');
  const prompt=`Você é um consultor financeiro pessoal, direto e prático, respondendo em ${idiomaNomeCompleto()}. Aqui estão os dados financeiros ATUAIS do usuário (sempre atualizados a cada pergunta):\n\n${resumo}\n\n${limitesDoResumoParaIA()}\n\nConversa até agora:\n${conversa}\n\nResponda à última pergunta do usuário em no máximo 5 frases, sem rodeios, com base nesses dados.`;
  return chamarGemini(prompt,aoTentarDeNovo);
}

/* Respostas do Google que passam sozinhas: 503 é "estou cheio agora", 429 é
   ritmo, 500/502/504 são soluços do caminho. Todas dizem "tente de novo", e
   até agora quem tentava de novo era a pessoa — na mão, lendo um texto em
   inglês colado numa tela em português. */
const IA_STATUS_PASSAGEIRO=new Set([429,500,502,503,504]);
const IA_TENTATIVAS=3;

async function chamarGemini(prompt,aoTentarDeNovo){
  const chave=getIaChave();
  const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
  let ultimoStatus=0;

  for(let tentativa=1;tentativa<=IA_TENTATIVAS;tentativa++){
    const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),20000);
    try{
      const res=await fetch(url,{
        method:'POST', signal:ctrl.signal,
        headers:{'Content-Type':'application/json','x-goog-api-key':chave},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
      });
      if(res.ok){
        const json=await res.json();
        const texto=json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if(!texto) throw new Error(L('ia.erroVazio'));
        return texto.trim();
      }
      /* chave errada ou sem permissão não melhora tentando de novo */
      if(res.status===400||res.status===403) throw new Error(L('ia.erroChave'));
      ultimoStatus=res.status;
      if(!IA_STATUS_PASSAGEIRO.has(res.status)){
        let detalhe='';
        try{ detalhe=(await res.json())?.error?.message||''; }catch(e){}
        throw new Error(L('ia.erroConexao').replace('{status}',res.status)+(detalhe?' '+detalhe:''));
      }
    }catch(e){
      /* o abort do nosso próprio relógio também merece outra chance */
      if(e&&e.name==='AbortError') ultimoStatus=ultimoStatus||504;
      else throw e;
    }finally{ clearTimeout(to); }

    if(tentativa<IA_TENTATIVAS){
      if(aoTentarDeNovo) aoTentarDeNovo(tentativa);
      /* espera crescente: 1,2 s e depois 2,4 s. Insistir no mesmo instante em
         que o servidor disse "estou cheio" é pedir a mesma resposta. */
      await new Promise(r=>setTimeout(r,1200*tentativa));
    }
  }
  /* acabaram as tentativas: diz o que houve, na língua de quem lê */
  throw new Error(L(ultimoStatus===429?'ia.erroLimite':'ia.erroOcupado'));
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
      <button type="button" class="ia-ask-chip" data-q-key="ia.questionHealth" data-i18n="ia.chipComoEstou">Como estou indo?</button>
      <button type="button" class="ia-ask-chip" data-q-key="ia.questionCuts" data-i18n="ia.chipCortar">Onde cortar gastos?</button>
      <button type="button" class="ia-ask-chip" data-q-key="ia.questionGoals" data-i18n="ia.chipMetas">Vou bater minhas metas?</button>
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
      /* enquanto insiste, diz que está insistindo — senão parece travado */
      const texto=await perguntarIA(pergunta.trim(),()=>{ resp.textContent=L('ia.tentandoDeNovo'); });
      resp.className='ia-ask-resposta'; resp.textContent=texto;
    }catch(err){
      resp.className='ia-ask-resposta'; resp.textContent='⚠️ '+(err.message||L('ia.erroGenerico'));
    }finally{ btn.disabled=false; }
  }
  btn.addEventListener('click',()=>ask(input.value));
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') ask(input.value); });
  el.querySelectorAll('.ia-ask-chip').forEach(chip=>chip.addEventListener('click',()=>ask(L(chip.getAttribute('data-q-key')))));
}
