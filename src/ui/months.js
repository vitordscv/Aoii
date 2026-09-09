/* ── months ── */
function renderMonths(){
  /* agrupa as faturas por mês: compras em cartões diferentes ficam no MESMO card,
     e a renda + gastos fixos do mês contam uma única vez no acumulado */
  const grupos=faturasPorMes();
  let maxVal=1;
  const mList=grupos.map(fs=>{
    const m=mesMetrics(fs);
    maxVal=Math.max(maxVal,data.tipoRenda?m.renda:0,m.despesas);
    return {fs,m};
  });

  /* acumulado e listas vêm do motor, pra bater com o hero e com o gráfico */
  const linha=new Map();
  buildTimeline().forEach(p=>linha.set(p.k,p));
  mList.forEach(item=>{
    const p=linha.get(chaveMes(item.fs[0].ano,item.fs[0].mes));
    item.saldoConta=p?p.value:0;
    item.extras=p?p.extras:0;
    item.compras=p?p.compras:0;
    item.aportes=p?(p.aportes||0):0;
  });

  // meses futuros/atual primeiro, meses passados no final (mais recente primeiro) — só ordem de exibição, o saldo acumulado acima já é cronológico
  const anosDisponiveis=[...new Set(mList.map(({fs})=>fs[0].ano))].sort((a,b)=>a-b);
  const filtroAtual=timelineFiltroAno;
  const mListFiltrada=filtroAtual==='todos'?mList:mList.filter(({fs})=>fs[0].ano===parseInt(filtroAtual,10));
  const futuros=mListFiltrada.filter(({m})=>!m.isPast);
  const passados=mListFiltrada.filter(({m})=>m.isPast).slice().reverse();
  const mListOrdenado=[...futuros,...passados];

  const multiCartao=(data.cartoes||[]).length>1;
  const nomeCartao=id=>esc((data.cartoes.find(c=>c.id===id)||{}).nome||'');

  const cardFn=({fs,m,saldoConta,extras,compras,aportes})=>{
    const f0=fs[0];
    const saldoMesTotal=m.saldoMes+(extras||0)-(compras||0)-(aportes||0);
    const rendaPct=Math.min(100,(m.renda/maxVal)*100);
    const despPct =Math.min(100,(m.despesas/maxVal)*100);

    const gastosHtml=fs.map(f=>(f.gastos||[]).map(g=>`
      <div class="gasto-row">
        <input type="checkbox" class="gasto-pago-check" data-action="gasto-pago" data-fid="${f.id}" data-gid="${g.id}" ${g.pago?'checked':''}>
        <input type="text" class="gasto-nome${g.pago?' riscado':''}" data-action="gasto-nome" data-fid="${f.id}" data-gid="${g.id}" value="${esc(g.nome)}" placeholder="nome">
        <input type="text" inputmode="decimal" class="gasto-valor-input" step="0.01" data-action="gasto-valor" data-fid="${f.id}" data-gid="${g.id}" value="${g.valor}">
        ${g.parcelamentoId?`<button class="gasto-del-parc" data-action="del-parcelamento" data-pid="${g.parcelamentoId}" title="${esc(L('tt.removerParcelaTodas'))}">🗑︎</button>`:''}
        <button class="gasto-del" data-action="del-gasto" data-fid="${f.id}" data-gid="${g.id}" title="${esc(L('tt.removerSoParcela'))}">✕</button>
      </div>`).join('')).join('');
    const todosGastos=fs.flatMap(f=>f.gastos||[]);
    const totalGastosCard=todosGastos.reduce((s,g)=>s+g.valor,0);
    const gastosColapsaveis=todosGastos.length>4;

    const gastosMensaisHtml=(m.gastosMensaisDetalhe||[]).map(g=>`
      <div class="month-row"><span>${esc(g.nome)}</span><span class="v">${formatBRL(g.custo)}</span></div>`).join('');

    const faturaRows=fs.map(f=>`
        <div class="month-row month-row-fatura">
          <label class="month-fatura-check" title="${esc(L('cal.paga'))}">
            <input type="checkbox" data-action="fatura-pago" data-id="${f.id}" ${f.pago?'checked':''}>
          </label>
          <span>${L('cal.fatura')}${multiCartao&&f.cartaoId?` <span class="month-cartao-tag">${nomeCartao(f.cartaoId)}</span>`:''}</span>
          <span class="month-fatura-edit">
            <input type="text" inputmode="decimal" step="0.01" value="${f.valor}" data-action="fatura-valor" data-id="${f.id}">
          </span>
        </div>`).join('');

    const temGastos=fs.some(f=>(f.gastos||[]).length>0);
    const cartoesFaltantes=multiCartao?(data.cartoes||[]).filter(c=>!fs.some(f=>f.cartaoId===c.id)):[];
    const addFaturaKey=`${f0.ano}-${f0.mes}`;

    return `
      <div class="month-card${m.isPast?' passado':''}${modoCompactoAtivo?' compacto':''}"${m.isAtual?' id="month-atual"':''}>
        <button class="month-del" data-action="del-month" data-id="${fs.map(f=>f.id).join(',')}" title="${esc(L('tt.removerMes'))}">✕</button>
        <div class="month-name">${MONTH_NAMES[f0.mes-1]} <span style="font-weight:400;color:var(--muted);">${f0.ano}</span></div>

        <div class="mini-bars">
          <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${rendaPct}%;background:var(--disney-blue);"></div></div>
          <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${despPct}%;background:var(--ink-navy);opacity:.55;"></div></div>
        </div>

        <div class="month-row"><span>${L('cal.rendaPrevista')}</span><span class="v">${formatBRL(m.renda)}</span></div>
        ${gastosMensaisHtml||faturaRows?`<div class="month-section-label">${L('cal.fixasEFatura')}</div>`:''}
        ${gastosMensaisHtml}
        ${faturaRows}
        ${cartoesFaltantes.length?`
        <button class="add-gasto-btn" data-action="show-add-fatura" data-key="${addFaturaKey}">${L('cal.faturaOutroCartao')}</button>
        <div class="add-gasto-form" id="af-${addFaturaKey}">
          <select data-role="af-cartao">${cartoesFaltantes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>
          <input type="text" inputmode="decimal" placeholder="${esc(L('ph.valorFatura'))}" step="0.01" data-role="af-valor">
          <button class="add-gasto-confirm" data-action="add-fatura" data-ano="${f0.ano}" data-mes="${f0.mes}" data-key="${addFaturaKey}">${L('btn.confirmar')}</button>
        </div>`:''}

        ${temGastos?`<div class="month-section-label gastos-toggle-label">
          <span>${L('cal.comprasDoCartao')}</span>
          ${gastosColapsaveis?`<button type="button" class="gastos-toggle-btn" data-action="toggle-gastos-card" data-key="${addFaturaKey}">${L('cal.verDetalhes')} (${todosGastos.length} · ${formatBRL(totalGastosCard)})</button>`:''}
        </div>`:''}
        <div class="gastos-wrap${gastosColapsaveis?' colapsado':''}" id="gw-${addFaturaKey}">${gastosHtml}</div>

        ${extras?`<div class="month-row"><span>${L('main.entradasExtras')}</span><span class="v">+${formatBRL(extras)}</span></div>`:''}
        ${compras?`<div class="month-row"><span>${L('main.comprasPlanejadas')}</span><span class="v">−${formatBRL(compras)}</span></div>`:''}
        ${aportes?`<div class="month-row"><span>${L('cal.aporteMetas')}</span><span class="v">−${formatBRL(aportes)}</span></div>`:''}

        <div class="month-saldo">
          <span class="label">${L('cal.saldoDoMes')}</span>
          <span class="v ${saldoMesTotal<0?'neg':'pos'}">${saldoMesTotal<0?'':'+'}${formatBRL(saldoMesTotal)}</span>
        </div>
        <div class="month-conta">
          <span>${L('cal.naConta')}</span>
          <span class="${saldoConta<0?'neg':''}">${formatBRL(saldoConta)}</span>
        </div>
      </div>`;
  };
  const cardsFuturos=futuros.map(cardFn).join('');
  const cardsPassados=passados.map(cardFn).join('');
  const addCard=`
    <div class="add-month-card">
      <select id="new-month-mes">${MONTH_NAMES.map((n,i)=>`<option value="${i+1}"${(i+1)===(new Date().getMonth()+1)?' selected':''}>${n}</option>`).join('')}</select>
      <input type="text" inputmode="decimal" class="num" id="new-month-ano" value="${new Date().getFullYear()}" placeholder="${esc(L('ph.ano'))}" aria-label="${esc(L('ph.ano'))}">
      <input type="text" inputmode="decimal" class="num" id="new-month-valor" step="0.01" placeholder="${esc(L('ph.valorFatura'))}" aria-label="${esc(L('ph.valorFatura'))}">
      ${(data.cartoes||[]).length>1?`<select id="new-month-cartao">${data.cartoes.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')}</select>`:''}
      <button id="add-month-btn">${L('btn.adicionarMes')}</button>
    </div>`;
  const cards=cardsFuturos+addCard+(passados.length?`
    <button type="button" class="csv-btn" id="toggle-passados-btn" data-count="${passados.length}"></button>
    <div class="month-grid-passados" id="mes-passados-wrap" style="display:none;">${cardsPassados}</div>`:'');

  document.getElementById('month-grid').innerHTML=cards;
  bindMonthEvents();
  const toggleBtn=document.getElementById('toggle-passados-btn');
  if(toggleBtn){
    const n=toggleBtn.getAttribute('data-count');
    const labelMostrar=L('main.mostrarMesesPassados').replace('{n}',n);
    toggleBtn.innerHTML=`<span class="tp-chevron">▾</span> ${labelMostrar}`;
    toggleBtn.setAttribute('data-open','0');
    toggleBtn.addEventListener('click',()=>{
      const wrap=document.getElementById('mes-passados-wrap');
      const aberto=wrap.style.display!=='none';
      wrap.style.display=aberto?'none':'grid';
      toggleBtn.setAttribute('data-open',aberto?'0':'1');
      toggleBtn.innerHTML=`<span class="tp-chevron">▾</span> ${aberto?labelMostrar:L('main.esconderMesesPassados')}`;
    });
  }
  const compactoCheck=document.getElementById('modo-compacto-check');
  if(compactoCheck){
    compactoCheck.checked=modoCompactoAtivo;
    if(!compactoCheck.dataset.bound){
      compactoCheck.dataset.bound='1';
      compactoCheck.addEventListener('change',()=>{
        modoCompactoAtivo=compactoCheck.checked;
        try{ localStorage.setItem('financas-modo-compacto',modoCompactoAtivo?'1':'0'); }catch(e){}
        renderMonths();
      });
    }
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
let _monthsAutoScrolled=false;
let timelineFiltroAno='todos';
let modoCompactoAtivo=false;
try{ modoCompactoAtivo=localStorage.getItem('financas-modo-compacto')==='1'; }catch(e){}

function bindMonthEvents(){
  const grid=document.getElementById('month-grid');
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
      const f=data.faturas.find(x=>x.id===e.target.getAttribute('data-id'));
      if(f){ fn(f,e); await persist(); render(); }
    }));
  }
  onFatura('[data-action="fatura-valor"]',(f,e)=>{ f.valor=parseNum(e.target.value)||0; });
  onFatura('[data-action="fatura-pago"]', (f,e)=>{
    f.pago=e.target.checked;
    if(f.pago){ (f.gastos||[]).forEach(g=>{ g.pago=true; }); }
  });

  grid.querySelectorAll('[data-action="del-month"]').forEach(el=>el.addEventListener('click',async e=>{
    const ids=(e.target.getAttribute('data-id')||'').split(',');
    data.faturas=data.faturas.filter(x=>!ids.includes(x.id));
    await persist(); render();
  }));

  /* gastos */
  function findGasto(fid,gid){ const f=data.faturas.find(x=>x.id===fid); return f?(f.gastos||[]).find(x=>x.id===gid):null; }

  grid.querySelectorAll('[data-action="gasto-pago"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=findGasto(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'));
    if(g){ g.pago=e.target.checked; await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="gasto-nome"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=findGasto(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'));
    if(g){ g.nome=e.target.value; await persist(); }
  }));
  grid.querySelectorAll('[data-action="gasto-valor"]').forEach(el=>el.addEventListener('change',async e=>{
    const g=findGasto(e.target.getAttribute('data-fid'),e.target.getAttribute('data-gid'));
    if(g){ g.valor=parseNum(e.target.value)||0; await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="del-gasto"]').forEach(el=>el.addEventListener('click',async e=>{
    const fid=e.target.getAttribute('data-fid'), gid=e.target.getAttribute('data-gid');
    const f=data.faturas.find(x=>x.id===fid);
    if(f){ f.gastos=(f.gastos||[]).filter(x=>x.id!==gid); await persist(); render(); }
  }));
  grid.querySelectorAll('[data-action="del-parcelamento"]').forEach(el=>el.addEventListener('click',async e=>{
    const pid=e.target.getAttribute('data-pid');
    if(!(await confirmDialog({title:L('confirm.removerParcTitulo'),text:L('confirm.removerParcTexto'),okLabel:L('btn.remover')}))) return;
    data.faturas.forEach(f=>{ f.gastos=(f.gastos||[]).filter(x=>x.parcelamentoId!==pid); });
    await persist(); render();
  }));
  grid.querySelectorAll('[data-action="show-add-fatura"]').forEach(el=>el.addEventListener('click',e=>{
    const form=document.getElementById('af-'+e.target.getAttribute('data-key'));
    if(form) form.classList.toggle('visible');
  }));
  grid.querySelectorAll('[data-action="add-fatura"]').forEach(el=>el.addEventListener('click',async e=>{
    const ano=parseInt(e.target.getAttribute('data-ano'),10);
    const mes=parseInt(e.target.getAttribute('data-mes'),10);
    const form=document.getElementById('af-'+e.target.getAttribute('data-key')); if(!form) return;
    const cartaoEl=form.querySelector('[data-role="af-cartao"]');
    const valorEl=form.querySelector('[data-role="af-valor"]');
    const cartaoId=cartaoEl?cartaoEl.value:null;
    const valor=parseNum(valorEl.value)||0;
    if(!cartaoId) return;
    const f=ensureFatura(ano,mes,cartaoId);
    f.valor=valor;
    await persist(); render();
  }));

  /* add month */
  document.getElementById('add-month-btn').addEventListener('click',async()=>{
    const mes =parseInt(document.getElementById('new-month-mes').value,10);
    const ano =parseInt(document.getElementById('new-month-ano').value,10)||new Date().getFullYear();
    const valor=parseNum(document.getElementById('new-month-valor').value)||0;
    const cartaoEl=document.getElementById('new-month-cartao');
    const cartaoId=cartaoEl?cartaoEl.value:(data.cartoes[0]&&data.cartoes[0].id);
    const existente=data.faturas.find(x=>x.ano===ano&&x.mes===mes&&x.cartaoId===cartaoId);
    if(existente){ existente.valor=valor||existente.valor; }
    else data.faturas.push({id:uid(),mes,ano,valor,pago:false,gastos:[],cartaoId});
    await persist(); render();
  });
}

