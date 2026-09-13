/* ═══ MELHORIAS: helpers de animação, haptics, ícones, undo, swipe, taxas ═══ */

/* respeita a preferência do sistema por menos movimento */
const REDUCED_MOTION=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* feedback tátil leve em ações-chave (só vibra onde o navegador suporta) */
function vibrate(pattern){ try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){} }

/* ícone consistente por categoria (pills, listas e grids de seleção) */
const CATEGORIA_ICONES={'Mercado':'🛒','Transporte':'🚌','Lazer':'🎮','Saúde':'💊','Casa':'🏠','Assinaturas':'🔁','Outros':'📦'};
/* a escolha da pessoa ganha do padrao; a caixa so aparece pra quem nao
   escolheu nada */
function catIcon(c){
  const escolhido=(data&&data.categoriaEmojis)?data.categoriaEmojis[c]:null;
  return escolhido||CATEGORIA_ICONES[c]||'📦';
}
function nomeViagem(id){ const v=(data.viagens||[]).find(x=>x.id===id); return v?v.nome:''; }

/* ── count-up animado: anima do valor anterior até o novo ── */
const _countPrev={};
function countUpAll(scope){
  (scope||document).querySelectorAll('[data-countup]').forEach(el=>{
    const key=el.getAttribute('data-countkey'); if(!key) return;
    const to=parseFloat(el.getAttribute('data-countup')); if(isNaN(to)) return;
    const fmt=el.getAttribute('data-countfmt')||'moeda';
    const from=_countPrev[key];
    _countPrev[key]=to;
    if(REDUCED_MOTION||from===undefined||from===to) return; // o texto final já está renderizado
    const D=550, t0=performance.now();
    function frame(now){
      const p=Math.min(1,(now-t0)/D);
      const e=1-Math.pow(1-p,3); // easeOutCubic
      const v=from+(to-from)*e;
      el.textContent=fmt==='int'?String(Math.round(v)):formatBRL(v);
      if(p<1&&document.body.contains(el)) requestAnimationFrame(frame);
      else el.textContent=fmt==='int'?String(Math.round(to)):formatBRL(to);
    }
    requestAnimationFrame(frame);
  });
}

/* ── barras de progresso: anima o preenchimento ao aparecer ── */
function animateBars(scope){
  if(REDUCED_MOTION) return;
  (scope||document).querySelectorAll('.limit-bar-fill,.meta-bar-fill,.cat-bar-fill,.gf-health-bar-fill,.orc-bar-fill,.mini-bar-fill,.mp-fill').forEach(el=>{
    const w=el.style.width; if(!w) return;
    el.style.transition='none'; el.style.width='0%';
    void el.offsetWidth;
    el.style.transition=''; el.style.width=w;
  });
}

/* ── tooltip interativo nos gráficos SVG (toque/hover + linha guia) ── */
function attachChartTooltip(container){
  const svg=container.querySelector('svg'); if(!svg) return;
  const dots=[...svg.querySelectorAll('circle[data-tt]')];
  if(!dots.length) return;
  const NS='http://www.w3.org/2000/svg';
  const vb=svg.viewBox.baseVal;
  const guide=document.createElementNS(NS,'line');
  guide.setAttribute('class','tt-guide');
  guide.setAttribute('y1',String(vb.height*0.08));
  guide.setAttribute('y2',String(vb.height*0.87));
  svg.appendChild(guide);
  let tip=container.querySelector('.chart-tooltip');
  if(!tip){ tip=document.createElement('div'); tip.className='chart-tooltip'; container.appendChild(tip); }
  function hide(){ tip.classList.remove('visible'); guide.classList.remove('visible'); }
  function move(e){
    const rect=svg.getBoundingClientRect();
    if(!rect.width) return;
    const sx=(e.clientX-rect.left)*(vb.width/rect.width);
    let best=null,bd=Infinity;
    dots.forEach(d=>{
      const cx=parseFloat(d.getAttribute('cx'));
      const dist=Math.abs(cx-sx);
      if(dist<bd){ bd=dist; best=d; }
    });
    if(!best) return;
    const cx=parseFloat(best.getAttribute('cx')), cy=parseFloat(best.getAttribute('cy'));
    guide.setAttribute('x1',String(cx)); guide.setAttribute('x2',String(cx));
    guide.classList.add('visible');
    tip.innerHTML=`<span class="tt-date">${esc(best.getAttribute('data-tt')||'')}</span>${esc(best.getAttribute('data-tt-val')||'')}`;
    const contRect=container.getBoundingClientRect();
    tip.style.left=(rect.left-contRect.left+cx*(rect.width/vb.width))+'px';
    tip.style.top =(rect.top -contRect.top +cy*(rect.height/vb.height))+'px';
    tip.classList.add('visible');
  }
  svg.addEventListener('pointermove',move);
  svg.addEventListener('pointerdown',move);
  svg.addEventListener('pointerleave',hide);
}

/* ── um envio por vez ───────────────────────────────────────────────────────
   Todo botão que cria registro tinha o mesmo furo: o tratador é `async`, e
   entre o começo dele e o `close()` do fim há um `await persist()`. O segundo
   toque cai nessa fresta, com a folha ainda aberta e os campos ainda cheios —
   e grava de novo.

   Custa caro porque não parece erro: a pessoa toca duas vezes quando o dedo
   escorrega, ou quando acha que o primeiro toque não pegou. No Diário saem
   dois lançamentos iguais, e o saldo desconta duas vezes.

   O ferrolho é síncrono, e é isso que resolve: ele fecha ANTES do primeiro
   `await`, então o segundo toque já encontra ocupado. Liberar no `finally`
   garante que uma exceção não deixe o botão morto pro resto da sessão. */
function umEnvioPorVez(botao,acao){
  if(!botao) return;
  let ocupado=false;
  botao.addEventListener('click',async ev=>{
    if(ocupado) return;
    ocupado=true;
    try{ await acao(ev); }
    finally{ ocupado=false; }
  });
}

/* ── toast "Desfazer": a remoção só é persistida depois do prazo ── */
let _undoTimer=null,_undoRestore=null;
function showUndoToast(msg,restoreFn){
  const toast=document.getElementById('undo-toast');
  const msgEl=document.getElementById('undo-toast-msg');
  if(!toast||!msgEl){ persist(); return; }
  if(_undoTimer){ clearTimeout(_undoTimer); _undoTimer=null; persist(); } // compromete a remoção anterior
  _undoRestore=restoreFn;
  msgEl.textContent=msg;
  toast.style.display='flex'; toast.classList.remove('closing');
  _undoTimer=setTimeout(async()=>{
    _undoTimer=null; _undoRestore=null;
    toast.classList.add('closing');
    setTimeout(()=>{ toast.style.display='none'; toast.classList.remove('closing'); },200);
    await persist(); // remoção definitiva
  },5000);
}
function bindUndoToast(){
  const btn=document.getElementById('undo-toast-btn'); if(!btn) return;
  btn.addEventListener('click',async()=>{
    const toast=document.getElementById('undo-toast');
    if(_undoTimer){ clearTimeout(_undoTimer); _undoTimer=null; }
    const fn=_undoRestore; _undoRestore=null;
    if(toast){
      toast.classList.add('closing');
      setTimeout(()=>{ toast.style.display='none'; toast.classList.remove('closing'); },200);
    }
    if(fn){ fn(); vibrate(12); await persist(); render(); }
  });
}

/* ── swipe pra revelar editar/excluir, com retorno elástico ── */

/* Os dois botões que o arrastar revela. Ficam num painel absoluto, coberto
   pelo conteúdo da linha: com o dedo só aparecem depois do arrasto, mas para
   o teclado estavam sempre lá, duas paradas de tabulação por item, antes do
   texto da linha e repetindo ações que já têm botão visível (✎/✕ no Diário)
   ou caminho próprio (abrir a linha e usar "Excluir", nos fixos).

   tabindex -1 e aria-hidden tiram os dois da navegação sem tirar o gesto:
   attachSwipe() liga os cliques do mesmo jeito. Onde nem gesto existe — as
   compras no crédito, que só se editam dentro da fatura — quem chama não
   desenha o painel, em vez de deixar dois botões ligados a nada. */
function acoesDeSwipeHtml(){
  return `<div class="swipe-actions" aria-hidden="true">`+
    `<button type="button" class="swipe-act-edit" tabindex="-1" title="${esc(L('btn.editar'))}">✏️</button>`+
    `<button type="button" class="swipe-act-del" tabindex="-1" title="${esc(L('btn.excluir'))}">🗑</button>`+
  `</div>`;
}

function attachSwipe(item,handlers){
  const content=item.querySelector('.swipe-content'); if(!content) return;
  const MAX=(handlers.onEdit?64:0)+(handlers.onDelete?64:0);
  if(!MAX) return;
  let startX=0,startY=0,dx=0,dragging=false,horizontal=null,open=false;
  function setX(v){ content.style.transform=v?`translateX(${v}px)`:''; }
  content.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,input,select,a')) return;
    dragging=true; horizontal=null; startX=e.clientX; startY=e.clientY; dx=open?-MAX:0;
  });
  content.addEventListener('pointermove',e=>{
    if(!dragging) return;
    const mx=e.clientX-startX,my=e.clientY-startY;
    if(horizontal===null){
      if(Math.abs(mx)<4&&Math.abs(my)<4) return;
      horizontal=Math.abs(mx)>Math.abs(my);
      if(horizontal){ content.classList.add('dragging'); content.setPointerCapture&&content.setPointerCapture(e.pointerId); }
    }
    if(!horizontal) return;
    dx=Math.max(-MAX*1.25,Math.min(0,(open?-MAX:0)+mx)); // resistência elástica no fim
    setX(dx);
  });
  function end(){
    if(!dragging) return;
    dragging=false;
    if(horizontal){
      content.classList.remove('dragging');
      const moved=Math.abs(dx-(open?-MAX:0))>4;
      open=dx<-MAX/2;
      setX(open?-MAX:0);
      if(open&&moved) vibrate(8);
      if(moved){
        const swallow=ev=>{ ev.stopPropagation(); ev.preventDefault(); };
        content.addEventListener('click',swallow,true);
        setTimeout(()=>content.removeEventListener('click',swallow,true),350);
      }
    }
    horizontal=null;
  }
  content.addEventListener('pointerup',end);
  content.addEventListener('pointercancel',end);
  const editBtn=item.querySelector('.swipe-act-edit');
  if(editBtn) editBtn.addEventListener('click',e=>{ e.stopPropagation(); setX(0); open=false; handlers.onEdit&&handlers.onEdit(); });
  const delBtn=item.querySelector('.swipe-act-del');
  if(delBtn) delBtn.addEventListener('click',e=>{ e.stopPropagation(); handlers.onDelete&&handlers.onDelete(); });
}

/* ── export CSV das transações do diário ── */
function exportTransacoesCSV(){
  const rows=[[L('csv.date'),L('csv.type'),L('csv.name'),L('csv.category'),L('csv.method'),L('csv.value')]];
  (data.transacoes||[]).slice().reverse().forEach(t=>{
    const metodo=t.metodo?L('pay.'+t.metodo):'';
    const valor=Number(t.valor||0).toLocaleString(localeAtual(),{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2});
    rows.push([t.data||'',L(t.tipo==='receita'?'csv.income':'csv.expense'),t.nome||'',categoriaLabel(t.categoria||''),metodo,valor]);
  });
  const csv='\ufeff'+rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='transacoes-aoii-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  vibrate(10);
  setSaveStatus(L('st.csvExportado'));
}

/* ── celebração sutil quando uma meta chega a 100% ── */
const _metaDoneState={};
let _metaFirstRender=true;
function celebrateMeta(rowEl){
  if(!rowEl) return;
  vibrate([12,40,18]);
  if(REDUCED_MOTION) return;
  rowEl.classList.add('meta-celebrate','meta-row-glow');
  const burst=document.createElement('div');
  burst.className='celebrate-burst';
  const colors=['var(--gold)','var(--pos)','var(--disney-blue)','var(--disney-blue-deep)'];
  for(let i=0;i<14;i++){
    const p=document.createElement('span');
    p.className='celebrate-piece';
    const ang=(Math.PI*2*i)/14+Math.random()*0.5;
    const dist=40+Math.random()*70;
    p.style.setProperty('--cx',(Math.cos(ang)*dist).toFixed(1)+'px');
    p.style.setProperty('--cy',(Math.sin(ang)*dist-30).toFixed(1)+'px');
    p.style.setProperty('--cr',(Math.random()*360-180).toFixed(0)+'deg');
    p.style.background=colors[i%colors.length];
    p.style.animationDelay=(Math.random()*0.12).toFixed(2)+'s';
    burst.appendChild(p);
  }
  rowEl.appendChild(burst);
  setTimeout(()=>{ burst.remove(); rowEl.classList.remove('meta-row-glow'); },1600);
}

