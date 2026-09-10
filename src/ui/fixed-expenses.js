/* ── aba Fixos: card de saúde + lista de gastos fixos por categoria ── */
function renderGastosFixosTab(){
  const healthEl=document.getElementById('gf-health-card');
  const groupsEl=document.getElementById('gf-groups-list');
  const emptyEl=document.getElementById('gf-empty-state');
  const expandBtn=document.getElementById('gf-expand-toggle');
  if(!healthEl||!groupsEl) return;

  const hoje=new Date();
  const anoAtual=hoje.getFullYear(), mesAtual=hoje.getMonth()+1;
  const list=data.gastosMensais||[];
  const ativos=list.filter(g=>gastoFixoAtivoEm(g,anoAtual,mesAtual));
  const totalFixos=ativos.reduce((s,g)=>s+g.valor,0);
  const renda=rendaMediaMensal();
  const pct=renda>0?Math.min(999,(totalFixos/renda)*100):0;
  const pctShown=Math.min(100,pct);

  let badge=L('gf.recomendado'), barColor='#fff', hint=L('gf.hintRecomendado');
  if(renda<=0){
    badge=L('gf.semRendaBadge'); hint=L('gf.hintSemRenda');
  }else if(pct>45){
    badge=L('gf.atencao'); hint=L('gf.hintAtencao');
  }else if(pct>20){
    badge=L('gf.moderado'); hint=L('gf.hintModerado');
  }

  healthEl.innerHTML=`
    <div class="gf-health-top">
      <div>
        <div class="gf-health-label" data-i18n="gf.saudeGastosFixos">Saúde dos seus gastos fixos</div>
        <div class="gf-health-value" data-countup="${totalFixos}" data-countkey="gf-total">${formatBRL(totalFixos)}</div>
      </div>
      <div class="gf-health-badge">${badge}</div>
    </div>
    <div class="gf-health-sub">${renda>0?`${pct.toFixed(0)}% ${L('gf.daRendaComprometida')}`:L('gf.semRendaMedia')}</div>
    <div class="gf-health-bar-track"><div class="gf-health-bar-fill" style="width:${pctShown}%;"></div></div>
    <div class="gf-health-hint">${hint}</div>`;

  if(list.length===0){
    groupsEl.innerHTML='';
    if(emptyEl) emptyEl.style.display='block';
    if(expandBtn) expandBtn.style.display='none';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  if(expandBtn){ expandBtn.style.display=''; expandBtn.textContent=L(gfExpandAll?'main.recolherTudo':'main.expandirTudo'); }

  const byCat={};
  list.forEach(g=>{ const c=g.categoria||'Outros'; (byCat[c]=byCat[c]||[]).push(g); });
  const cats=CATS().filter(c=>byCat[c]).concat(Object.keys(byCat).filter(c=>!CATS().includes(c)));

  groupsEl.innerHTML=cats.map(cat=>{
    const items=byCat[cat];
    const subtotal=items.filter(g=>gastoFixoAtivoEm(g,anoAtual,mesAtual)).reduce((s,g)=>s+g.valor,0);
    const itemsHtml=items.map(g=>{
      const ativo=gastoFixoAtivoEm(g,anoAtual,mesAtual);
      const pausado=g.ativo===false;
      const futuro=!pausado&&g.inicioAno&&(g.inicioAno>anoAtual||(g.inicioAno===anoAtual&&g.inicioMes>mesAtual));
      let subTxt=`${L('cal.dia')} ${g.diaDoMes}`;
      if(pausado) subTxt+=' · '+L('gf.pausado');
      else if(futuro) subTxt+=` · ${L('gf.apartirDe')} ${MONTH_NAMES[g.inicioMes-1]}/${g.inicioAno}`;
      return `
        <div class="swipe-item" data-id="${g.id}">
          <div class="swipe-actions">
            <button type="button" class="swipe-act-edit" title="${esc(L('btn.editar'))}" aria-label="${esc(L('a11y.editItem').replace('{name}',g.nome))}">✏️</button>
            <button type="button" class="swipe-act-del" title="${esc(L('btn.excluir'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',g.nome))}">🗑</button>
          </div>
          <div class="swipe-content">
            <div class="gf-item-row${ativo?'':' paused'}" data-action="edit-gasto-fixo" data-id="${g.id}">
              <div class="gf-item-main">
                <div class="gf-item-nome">${esc(g.nome)}${g.criadoEm&&(Date.now()-new Date(g.criadoEm).getTime())>18*30*24*60*60*1000?` <span class="gf-stale-badge" title="${esc(L('gf.semReajusteHelp'))}">⏳</span>`:''}</div>
                <div class="gf-item-sub">${esc(subTxt)}</div>
              </div>
              <div class="gf-item-valor">${formatBRL(g.valor)}</div>
            </div>
          </div>
        </div>`;
    }).join('');
    return `
      <div class="gf-group${gfExpandAll?' open':''}">
        <div class="gf-group-head" data-action="toggle-gf-group">
          <div class="gf-group-title">${catIcon(cat)} ${esc(categoriaLabel(cat))}</div>
          <div class="gf-group-total">${formatBRL(subtotal)}</div>
        </div>
        <div class="gf-group-items">${itemsHtml}</div>
      </div>`;
  }).join('');

  groupsEl.querySelectorAll('[data-action="toggle-gf-group"]').forEach(head=>{
    head.addEventListener('click',()=>{ head.closest('.gf-group').classList.toggle('open'); });
  });
  groupsEl.querySelectorAll('[data-action="edit-gasto-fixo"]').forEach(row=>{
    ativarComoBotao(row,e=>{
      e.stopPropagation();
      openGastoFixoSheet(row.getAttribute('data-id'));
    },L('a11y.editItem').replace('{name}',row.querySelector('.gf-item-nome')?.textContent||''));
  });
  groupsEl.querySelectorAll('.swipe-item').forEach(item=>{
    const id=item.getAttribute('data-id');
    attachSwipe(item,{
      onEdit:()=>openGastoFixoSheet(id),
      onDelete:()=>{
        const removido=removerGastoFixo(id); if(!removido) return;
        vibrate(15); render();
        showUndoToast(L('undo.removido').replace('{nome}',removido.item.nome),()=>{ restaurarGastoFixo(removido.item,removido.indice); });
      },
    });
  });
}

function renderMetaWarning(){
  const el=document.getElementById('metas-warning'); if(!el) return;
  const list=(data.metas||[]).filter(m=>!(m.valorAlvo>0&&(m.valorGuardado||0)>=m.valorAlvo));

  // ── banner de alertas de prazo ──
  const alerts=list
    .filter(m=>m.dataAlvo)
    .map(m=>{
      const alvo=m.valorAlvo||0, guardado=m.valorGuardado||0;
      const days=metaDaysRemaining(m.dataAlvo);
      return {m,alvo,guardado,days};
    })
    .filter(a=>a.days!==null&&a.days<=30&&a.days>=-60)
    .sort((a,b)=>a.days-b.days);

  const alertsHtml=alerts.map(a=>{
    const pct=a.alvo>0?Math.round((a.guardado/a.alvo)*100):0;
    let txt;
    if(a.days<0) txt=L('goal.overdueAlert').replace('{name}',a.m.nome).replace('{n}',Math.abs(a.days)).replace('{days}',Math.abs(a.days)===1?L('common.day'):L('common.days')).replace('{pct}',pct);
    else if(a.days===0) txt=L('goal.dueTodayAlert').replace('{name}',a.m.nome).replace('{pct}',pct);
    else txt=L('goal.dueInAlert').replace('{name}',a.m.nome).replace('{n}',a.days).replace('{days}',a.days===1?L('common.day'):L('common.days')).replace('{pct}',pct);
    return `<div class="warn-banner">⏳ ${esc(txt)}</div>`;
  }).join('');

  // ── painel: necessário/mês vs sobra real ──
  const sobra=sobraMensalMedia();
  const metasComPrazo=list.filter(m=>m.dataAlvo&&m.valorAlvo>0);
  const totalNecessario=metasComPrazo.reduce((s,m)=>{
    const meses=Math.max(1,metaMonthsRemaining(m.dataAlvo));
    const falta=Math.max(0,(m.valorAlvo||0)-(m.valorGuardado||0));
    return s+falta/meses;
  },0);

  let comparadorHtml='';
  if(sobra!==null&&metasComPrazo.length>0){
    const livreAposGuardar=sobra-totalNecessario;
    const ok=livreAposGuardar>=0;
    comparadorHtml=`
      <div class="meta-comparador ${ok?'ok':'tight'}">
        <div class="mc-row">
          <span>${L('goal.averageMonthlySurplus')}</span>
          <strong>${formatBRL(sobra)}</strong>
        </div>
        <div class="mc-row">
          <span>${L('goal.monthlyNeeded')}</span>
          <strong class="${ok?'':'neg'}">− ${formatBRL(totalNecessario)}</strong>
        </div>
        <div class="mc-divider"></div>
        <div class="mc-row mc-result">
          <span>${ok?'💚 '+L('goal.freeToSpend'):'⚠️ '+L('goal.shortfall')}</span>
          <strong class="${ok?'pos':'neg'}">${ok?'':'-'}${formatBRL(Math.abs(livreAposGuardar))}/${L('daily.mes')}</strong>
        </div>
        ${!ok?`<div class="mc-hint">${L('goal.shortfallHint')}</div>`:`<div class="mc-hint">${L('goal.freeHint')}</div>`}
      </div>`;
  }

  el.innerHTML=alertsHtml+comparadorHtml;
}
