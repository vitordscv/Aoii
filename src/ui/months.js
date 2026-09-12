/* ── A linha do tempo ─────────────────────────────────────────────────────

   Era uma grade de cards, um por mês, cada um com tudo aberto. Com onze meses
   cadastrados isso dava quase treze mil pixels de altura no telefone: cada mês
   ocupava uma tela inteira, todos pareciam iguais, e não havia como comparar
   dois meses sem rolar meio minuto entre eles. Uma linha do tempo por onde só
   se pode rolar não é uma linha do tempo.

   Agora é uma lista de faixas. Fechada, a faixa diz o que se quer saber de
   relance — o mês, o peso das despesas sobre a renda, o saldo e quanto sobra
   na conta. Aberta, mostra o mesmo detalhe editável de antes.

   Quais estão abertas vive em `mesesAbertos`, fora da montagem: `render()` é
   chamado a cada tecla que muda um valor, e sem isso editar um gasto fechava
   o mês debaixo do dedo. */

const mesesAbertos = new Set();
let _monthsAutoScrolled = false;
let timelineFiltroAno = 'todos';

function chaveDoMes(ano, mes) { return ano + '-' + mes; }

function renderMonths(){
  /* agrupa as faturas por mês: compras em cartões diferentes ficam na MESMA
     faixa, e a renda + gastos fixos do mês contam uma única vez no acumulado */
  const grupos=faturasPorMes();
  const mList=grupos.map(fs=>({fs,m:mesMetrics(fs)}));

  /* acumulado e listas vêm do motor, pra bater com o hero e com o gráfico */
  const linha=new Map();
  buildTimeline().forEach(p=>linha.set(p.k,p));
  mList.forEach(item=>{
    const p=linha.get(chaveMes(item.fs[0].ano,item.fs[0].mes));
    item.saldoConta=p?p.value:0;
    item.extras=p?p.extras:0;
    item.compras=p?p.compras:0;
    item.aportes=p?(p.aportes||0):0;
    item.dividas=p?(p.dividas||0):0;
  });

  // meses futuros/atual primeiro, passados no fim (mais recente primeiro) — só
  // ordem de exibição; o saldo acumulado acima já é cronológico
  const anosDisponiveis=[...new Set(mList.map(({fs})=>fs[0].ano))].sort((a,b)=>a-b);
  const filtroAtual=timelineFiltroAno;
  const mListFiltrada=filtroAtual==='todos'?mList:mList.filter(({fs})=>fs[0].ano===parseInt(filtroAtual,10));
  const futuros=mListFiltrada.filter(({m})=>!m.isPast);
  const passados=mListFiltrada.filter(({m})=>m.isPast).slice().reverse();

  const multiCartao=(data.cartoes||[]).length>1;
  const nomeDoCartao=id=>esc((data.cartoes.find(c=>c.id===id)||{}).nome||'');

  /* o mês corrente já nasce aberto: é o que a pessoa veio ver */
  const atual=mListFiltrada.find(({m})=>m.isAtual);
  if(atual&&!_monthsAutoScrolled) mesesAbertos.add(chaveDoMes(atual.fs[0].ano,atual.fs[0].mes));

  /* ── o corpo, que é o detalhe editável de antes ── */
  const corpoDoMes=({fs,m,extras,compras,aportes,dividas=0},chave)=>{
    const f0=fs[0];

    const gastosHtml=fs.map(f=>(f.gastos||[]).map(g=>`
      <div class="gasto-row">
        <label class="mes-check" title="${esc(L('cal.paga'))}">
          <input type="checkbox" class="gasto-pago-check" data-action="gasto-pago" data-fid="${f.id}" data-gid="${g.id}" ${g.pago?'checked':''}>
        </label>
        <input type="text" class="gasto-nome${g.pago?' riscado':''}" data-action="gasto-nome" data-fid="${f.id}" data-gid="${g.id}" value="${esc(g.nome)}" placeholder="${esc(L('csv.name'))}">
        <input type="text" inputmode="decimal" class="gasto-valor-input" data-action="gasto-valor" data-fid="${f.id}" data-gid="${g.id}" value="${formatValorSemMoeda(g.valor)}">
        ${g.parcelamentoId?`<button class="gasto-del-parc" data-action="del-parcelamento" data-pid="${g.parcelamentoId}" title="${esc(L('tt.removerParcelaTodas'))}">🗑︎</button>`:''}
        <button class="gasto-del" data-action="del-gasto" data-fid="${f.id}" data-gid="${g.id}" title="${esc(L('tt.removerSoParcela'))}">✕</button>
      </div>`).join('')).join('');
    const todosGastos=fs.flatMap(f=>f.gastos||[]);
    const totalGastosCard=todosGastos.reduce((s,g)=>s+g.valor,0);
    const gastosColapsaveis=todosGastos.length>4;

    /* conta fixa que já saiu mostra o valor CHEIO riscado, não o custo
       pendente: "R$ 0,00" se lia como "essa conta é zero" */
    const gastosMensaisHtml=(m.gastosMensaisDetalhe||[]).map(g=>g.pago
      ? `<div class="mes-linha paga"><span>${esc(g.nome)}</span><span class="v"><s>${formatBRL(g.valor)}</s> ${L('cal.jaPaga')} ✓</span></div>`
      : `<div class="mes-linha"><span>${esc(g.nome)}</span><span class="v">${formatBRL(g.custo)}</span></div>`).join('');

    const faturaRows=fs.map(f=>`
        <div class="mes-linha mes-fatura">
          <label class="mes-check" title="${esc(L('cal.paga'))}">
            <input type="checkbox" data-action="fatura-pago" data-id="${f.id}" ${f.pago?'checked':''}>
          </label>
          <span class="mes-fatura-rotulo">${L('cal.fatura')}${multiCartao&&f.cartaoId?` <span class="mes-cartao-tag">${nomeDoCartao(f.cartaoId)}</span>`:''}</span>
          <input type="text" inputmode="decimal" class="mes-fatura-valor" value="${formatValorSemMoeda(f.valor)}" data-action="fatura-valor" data-id="${f.id}">
        </div>`).join('');

    const temGastos=fs.some(f=>(f.gastos||[]).length>0);
    const cartoesFaltantes=multiCartao?(data.cartoes||[]).filter(c=>!fs.some(f=>f.cartaoId===c.id)):[];

    /* a renda do mês corrente é o que AINDA vai cair; zero quer dizer que já
       caiu tudo, e não que a pessoa não ganha nada */
    const rendaHtml=m.isAtual&&m.renda===0
      ? `<div class="mes-linha paga"><span>${L('cal.rendaAReceber')}</span><span class="v">${L('cal.rendaToda')} ✓</span></div>`
      : `<div class="mes-linha"><span>${m.isAtual?L('cal.rendaAReceber'):L('cal.rendaPrevista')}</span><span class="v">${formatBRL(m.renda)}</span></div>`;

    const pesoTexto=m.renda>0
      ? L('cal.pesoDespesas').replace('{gasto}',formatBRL(m.despesas)).replace('{renda}',formatBRL(m.renda))
          .replace('{pct}',Math.round((m.despesas/m.renda)*100))
      : L('cal.pesoSemRenda').replace('{gasto}',formatBRL(m.despesas));

    return `
      <div class="mes-peso-texto">${pesoTexto}</div>
      ${rendaHtml}
      ${gastosMensaisHtml||faturaRows?`<div class="month-section-label">${L('cal.fixasEFatura')}</div>`:''}
      ${gastosMensaisHtml}
      ${faturaRows}
      ${cartoesFaltantes.length?`
      <button class="add-gasto-btn" data-action="show-add-fatura" data-key="${chave}">${L('cal.faturaOutroCartao')}</button>
      <div class="add-gasto-form" id="af-${chave}">
        <select data-role="af-cartao" aria-label="${esc(L('rp.cartao'))}">${cartoesFaltantes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
        <input type="text" inputmode="decimal" placeholder="${esc(L('ph.valorFatura'))}" data-role="af-valor">
        <button class="add-gasto-confirm" data-action="add-fatura" data-ano="${f0.ano}" data-mes="${f0.mes}" data-key="${chave}">${L('btn.confirmar')}</button>
      </div>`:''}

      ${temGastos?`<div class="month-section-label gastos-toggle-label">
        <span>${L('cal.comprasDoCartao')}</span>
        ${gastosColapsaveis?`<button type="button" class="gastos-toggle-btn" data-action="toggle-gastos-card" data-key="${chave}">${L('cal.verDetalhes')} (${todosGastos.length} · ${formatBRL(totalGastosCard)})</button>`:''}
      </div>`:''}
      <div class="gastos-wrap${gastosColapsaveis?' colapsado':''}" id="gw-${chave}">${gastosHtml}</div>

      ${extras?`<div class="mes-linha"><span>${L('main.entradasExtras')}</span><span class="v">+${formatBRL(extras)}</span></div>`:''}
      ${compras?`<div class="mes-linha"><span>${L('main.comprasPlanejadas')}</span><span class="v">−${formatBRL(compras)}</span></div>`:''}
      ${dividas?`<div class="mes-linha"><span>${L('main.dividas')}</span><span class="v">−${formatBRL(dividas)}</span></div>`:''}
      ${aportes?`<div class="mes-linha"><span>${L('cal.aporteMetas')}</span><span class="v">−${formatBRL(aportes)}</span></div>`:''}

      <button type="button" class="mes-remover" data-action="del-month" data-id="${fs.map(f=>f.id).join(',')}">${L('cal.removerEsteMes')}</button>`;
  };

  /* ── a faixa: cabeçalho sempre visível + corpo que abre ── */
  const faixaFn=item=>{
    const {fs,m,saldoConta,extras,compras,aportes,dividas=0}=item;
    const f0=fs[0];
    const chave=chaveDoMes(f0.ano,f0.mes);
    const aberto=mesesAbertos.has(chave);
    const saldoMesTotal=m.saldoMes+(extras||0)-(compras||0)-(aportes||0)-(dividas||0);
    const rotulo=`${MONTH_NAMES[f0.mes-1]} ${f0.ano}`;

    /* uma barra só, e com significado: quanto da renda do mês as despesas
       comem. Eram duas barras sem legenda nem escala, que não diziam nada. */
    const pct=m.renda>0?Math.min(100,Math.round((m.despesas/m.renda)*100)):0;
    const estouro=m.renda>0&&m.despesas>m.renda;
    const barraHtml=m.renda>0
      ? `<span class="mes-peso${estouro?' estouro':''}"><span class="mes-peso-fill" style="width:${pct}%;"></span></span>`
      : '<span class="mes-peso vazia"></span>';

    return `
      <div class="mes-item${m.isPast?' passado':''}${m.isAtual?' agora':''}${aberto?' aberto':''}"${m.isAtual?' id="month-atual"':''}>
        <button type="button" class="mes-cabeca" data-action="toggle-mes" data-key="${chave}"
                aria-expanded="${aberto?'true':'false'}" aria-controls="mb-${chave}">
          <span class="mes-titulo">
            <span class="mes-nome">${MONTH_NAMES[f0.mes-1]} <i>${f0.ano}</i></span>
            ${m.isAtual?`<span class="mes-agora">${L('cal.agora')}</span>`:''}
            <span class="mes-seta" aria-hidden="true">▾</span>
          </span>
          <span class="mes-resumo">
            ${barraHtml}
            <span class="mes-numeros">
              <span class="mes-saldo ${saldoMesTotal<0?'neg':'pos'}">${saldoMesTotal<0?'':'+'}${formatBRL(saldoMesTotal)}</span>
              <span class="mes-conta">${L('cal.naConta')} <b class="${saldoConta<0?'neg':''}">${formatBRL(saldoConta)}</b></span>
            </span>
          </span>
        </button>
        <div class="mes-corpo" id="mb-${chave}" role="region"
             aria-label="${esc(L('cal.detalheDoMes').replace('{mes}',rotulo))}"${aberto?'':' hidden'}>
          ${corpoDoMes(item,chave)}
        </div>
      </div>`;
  };

  /* o erro vale por uma faixa, não pela lista inteira: um mês com dado
     estranho não pode derrubar os outros dez */
  const faixaSegura=item=>{
    try{ return faixaFn(item); }
    catch(e){
      console.error('mês não montou',item&&item.fs&&item.fs[0],e);
      const mes=item&&item.fs&&item.fs[0];
      const rotulo=mes?MONTH_NAMES[mes.mes-1]+' '+mes.ano:'';
      return `<div class="mes-item mes-item-erro"><div class="mes-cabeca"><span class="mes-titulo"><span class="mes-nome">${esc(rotulo)}</span></span></div><div class="mes-erro-msg">${L('cal.mesNaoMontou')}</div></div>`;
    }
  };

  const addBloco=`
    <div class="mes-add">
      <button type="button" class="mes-add-btn" data-action="show-add-mes">${L('btn.adicionarMes')}</button>
      <div class="add-gasto-form" id="af-novo-mes">
        <select id="new-month-mes" aria-label="${esc(L('cal.novoMes'))}">${MONTH_NAMES.map((n,i)=>`<option value="${i+1}"${(i+1)===(new Date().getMonth()+1)?' selected':''}>${n}</option>`).join('')}</select>
        <input type="text" inputmode="decimal" id="new-month-ano" value="${new Date().getFullYear()}" placeholder="${esc(L('ph.ano'))}" aria-label="${esc(L('ph.ano'))}">
        <input type="text" inputmode="decimal" id="new-month-valor" placeholder="${esc(L('ph.valorFatura'))}" aria-label="${esc(L('ph.valorFatura'))}">
        ${(data.cartoes||[]).length>1?`<select id="new-month-cartao" aria-label="${esc(L('rp.cartao'))}">${data.cartoes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>`:''}
        <button class="add-gasto-confirm" id="add-month-btn">${L('btn.confirmar')}</button>
      </div>
    </div>`;

  const html=futuros.map(faixaSegura).join('')+addBloco+(passados.length?`
    <button type="button" class="csv-btn" id="toggle-passados-btn" data-count="${passados.length}"></button>
    <div class="mes-lista-passados" id="mes-passados-wrap" hidden>${passados.map(faixaSegura).join('')}</div>`:'');

  document.getElementById('month-grid').innerHTML=html;
  bindMonthEvents();

  const toggleBtn=document.getElementById('toggle-passados-btn');
  if(toggleBtn){
    const n=toggleBtn.getAttribute('data-count');
    const labelMostrar=L('main.mostrarMesesPassados').replace('{n}',n);
    toggleBtn.innerHTML=`<span class="tp-chevron">▾</span> ${labelMostrar}`;
    toggleBtn.setAttribute('data-open','0');
    toggleBtn.addEventListener('click',()=>{
      const wrap=document.getElementById('mes-passados-wrap');
      const aberto=!wrap.hidden;
      wrap.hidden=aberto;
      toggleBtn.setAttribute('data-open',aberto?'0':'1');
      toggleBtn.innerHTML=`<span class="tp-chevron">▾</span> ${aberto?labelMostrar:L('main.esconderMesesPassados')}`;
    });
  }

  const anoSel=document.getElementById('timeline-filtro-ano');
  if(anoSel){
    anoSel.innerHTML=`<option value="todos">${esc(L('filtro.todosAnos'))}</option>`+anosDisponiveis.map(a=>`<option value="${a}"${filtroAtual===String(a)?' selected':''}>${a}</option>`).join('');
    anoSel.value=filtroAtual;
    if(!anoSel.dataset.bound){
      anoSel.dataset.bound='1';
      anoSel.addEventListener('change',()=>{ timelineFiltroAno=anoSel.value; renderMonths(); });
    }
  }

  if(!_monthsAutoScrolled){
    _monthsAutoScrolled=true;
    setTimeout(()=>{
      const alvo=document.getElementById('month-atual');
      if(alvo) alvo.scrollIntoView({behavior:'auto',block:'center'});
    },80);
  }
}

function bindMonthEvents(){
  const grid=document.getElementById('month-grid');
  const numeroOuZeroSeVazio=el=>el.value.trim()===''?0:parseNum(el.value);

  /* abrir e fechar o mês: só mexe no DOM da faixa, sem remontar a lista —
     remontar aqui apagaria o que a pessoa está digitando em outra faixa */
  grid.querySelectorAll('[data-action="toggle-mes"]').forEach(el=>el.addEventListener('click',()=>{
    const chave=el.getAttribute('data-key');
    const corpo=document.getElementById('mb-'+chave);
    const abrindo=mesesAbertos.has(chave)?false:true;
    if(abrindo) mesesAbertos.add(chave); else mesesAbertos.delete(chave);
    el.setAttribute('aria-expanded',abrindo?'true':'false');
    el.closest('.mes-item').classList.toggle('aberto',abrindo);
    if(corpo) corpo.hidden=!abrindo;
  }));

  grid.querySelectorAll('[data-action="show-add-mes"]').forEach(el=>el.addEventListener('click',()=>{
    const form=document.getElementById('af-novo-mes');
    if(form) form.classList.toggle('visible');
  }));

  grid.querySelectorAll('[data-action="toggle-gastos-card"]').forEach(el=>el.addEventListener('click',()=>{
    const wrap=document.getElementById('gw-'+el.getAttribute('data-key'));
    if(!wrap) return;
    if(!el.dataset.openLabel) el.dataset.openLabel=el.textContent;
    const abrindo=wrap.classList.contains('colapsado');
    wrap.classList.toggle('colapsado');
    el.textContent=abrindo?L('cal.esconder'):el.dataset.openLabel;
  }));

  function onFatura(sel,fn){
    grid.querySelectorAll(sel).forEach(el=>el.addEventListener('change',async e=>{
      const mudou=fn(e.target.getAttribute('data-id'),e);
      if(mudou){ await persist(); render(); }
    }));
  }
  onFatura('[data-action="fatura-valor"]',(id,e)=>atualizarValorFatura(id,numeroOuZeroSeVazio(e.target)));
  onFatura('[data-action="fatura-pago"]',(id,e)=>definirFaturaPaga(id,e.target.checked));

  grid.querySelectorAll('[data-action="del-month"]').forEach(el=>el.addEventListener('click',async e=>{
    const ids=(e.currentTarget.getAttribute('data-id')||'').split(',');
    removerFaturas(ids);
    await persist(); render();
  }));

  /* gastos */
  grid.querySelectorAll('[data-action="gasto-pago"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=atualizarGastoFatura(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'),{pago:e.target.checked});
    if(g){ await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="gasto-nome"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=atualizarGastoFatura(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'),{nome:e.target.value});
    if(g) await persist();
  }));
  grid.querySelectorAll('[data-action="gasto-valor"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=atualizarGastoFatura(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'),{valor:parseNum(e.target.value)});
    if(g){ await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="del-gasto"]').forEach(el=>el.addEventListener('click',async e=>{
    const b=e.currentTarget;
    if(removerGastoFatura(b.getAttribute('data-fid'),b.getAttribute('data-gid'))){ await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="del-parcelamento"]').forEach(el=>el.addEventListener('click',async e=>{
    const pid=e.currentTarget.getAttribute('data-pid');
    if(!(await confirmDialog({title:L('confirm.removerParcTitulo'),text:L('confirm.removerParcTexto'),okLabel:L('btn.remover')}))) return;
    if(removerParcelamento(pid)){ await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="show-add-fatura"]').forEach(el=>el.addEventListener('click',e=>{
    const form=document.getElementById('af-'+e.currentTarget.getAttribute('data-key'));
    if(form) form.classList.toggle('visible');
  }));
  grid.querySelectorAll('[data-action="add-fatura"]').forEach(el=>el.addEventListener('click',async e=>{
    const b=e.currentTarget;
    const ano=parseInt(b.getAttribute('data-ano'),10);
    const mes=parseInt(b.getAttribute('data-mes'),10);
    const form=document.getElementById('af-'+b.getAttribute('data-key')); if(!form) return;
    const cartaoEl=form.querySelector('[data-role="af-cartao"]');
    const valorEl=form.querySelector('[data-role="af-valor"]');
    const cartaoId=cartaoEl?cartaoEl.value:null;
    if(!cartaoId) return;
    if(salvarFatura({ano,mes,cartaoId,valor:numeroOuZeroSeVazio(valorEl)})){ await persist(); render(); }
  }));

  /* mês novo */
  const addBtn=document.getElementById('add-month-btn');
  if(addBtn) addBtn.addEventListener('click',async()=>{
    const mes =parseInt(document.getElementById('new-month-mes').value,10);
    const ano =parseInt(document.getElementById('new-month-ano').value,10);
    const valor=numeroOuZeroSeVazio(document.getElementById('new-month-valor'));
    const cartaoEl=document.getElementById('new-month-cartao');
    const cartaoId=cartaoEl?cartaoEl.value:(data.cartoes[0]&&data.cartoes[0].id);
    if(salvarFatura({ano,mes,cartaoId,valor})){ mesesAbertos.add(chaveDoMes(ano,mes)); await persist(); render(); }
  });
}
