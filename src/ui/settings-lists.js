/* ── lista de viagens/eventos com orçamento próprio ── */
function renderViagensList(){
  const el=document.getElementById('viagens-list'); if(!el) return;
  const viagens=data.viagens||[];
  if(!viagens.length){ el.innerHTML=`<div class="cat-empty">${L('empty.nenhumaViagem')}</div>`; return; }
  el.innerHTML=viagens.map(v=>{
    const gasto=gastoDaViagem(v.id);
    return `
    <div class="cat-manage-row">
      <span>✈️ ${esc(v.nome)} — ${formatBRL(gasto)}${v.orcamento>0?` / ${formatBRL(v.orcamento)}`:''}</span>
      <button type="button" class="cat-manage-del" data-id="${v.id}" title="${esc(L('btn.remover'))}" aria-label="${esc(L('a11y.deleteItem').replace('{name}',v.nome))}">✕</button>
    </div>`;
  }).join('');
  el.querySelectorAll('.cat-manage-del').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.getAttribute('data-id');
    if(!(await confirmDialog({text:L('confirm.removerViagem')}))) return;
    if(!removerViagem(id)) return;
    await persist(); render();
  }));
}

/* ── lista de categorias nas configurações ──────────────────────────────────

   Duas espécies de linha, e a diferença é de propósito:

   - **as que vêm com o app** não se apagam nem se renomeiam. O nome delas é
     identificador: traduz a apresentação nos cinco idiomas, recebe o De-Para do
     banco, e está gravado em backup antigo. O ÍCONE, esse é livre — ele não
     identifica nada.
   - **as que a pessoa criou** se renomeiam, trocam de ícone e se apagam.

   Renomear leva junto lançamento, gasto fixo, gasto de fatura e orçamento; é
   `renomearCategoria()` quem faz, e não esta tela. */
function pintarGradeDeEmojiEm(caixa,atual,aoEscolher){
  caixa.innerHTML='';
  EMOJIS_DE_CATEGORIA.forEach(e=>{
    const b=document.createElement('button');
    b.type='button';
    b.className='cat-emoji-opcao';
    b.setAttribute('role','option');
    b.setAttribute('aria-selected',e===atual?'true':'false');
    b.textContent=e;
    b.addEventListener('click',()=>aoEscolher(e===atual?'':e));
    caixa.appendChild(b);
  });
}

function renderCategoriasList(){
  const el=document.getElementById('categorias-list'); if(!el) return;
  el.innerHTML='';

  CATS().forEach(cat=>{
    const padrao=categoriaEhPadrao(cat);
    const linha=document.createElement('div');
    linha.className='cat-manage-row';

    /* o ícone é botão em toda linha, inclusive nas padrão */
    const icone=document.createElement('button');
    icone.type='button';
    icone.className='cat-linha-emoji';
    icone.textContent=catIcon(cat);
    icone.title=L('cat.escolherEmoji');
    icone.setAttribute('aria-label',L('cat.escolherEmoji')+': '+categoriaLabel(cat));
    icone.setAttribute('aria-expanded','false');
    linha.appendChild(icone);

    const nome=document.createElement('span');
    nome.className='cat-linha-nome';
    nome.textContent=categoriaLabel(cat);
    linha.appendChild(nome);

    if(padrao){
      const selo=document.createElement('span');
      selo.className='cat-linha-selo';
      selo.textContent=L('cat.padrao');
      selo.title=L('cat.padraoPorque');
      linha.appendChild(selo);
    }else{
      const editar=document.createElement('button');
      editar.type='button';
      editar.className='cat-linha-editar';
      editar.textContent='✎';
      editar.title=L('cat.renomear');
      editar.setAttribute('aria-label',L('cat.renomear')+': '+cat);
      linha.appendChild(editar);

      const apagar=document.createElement('button');
      apagar.type='button';
      apagar.className='cat-manage-del';
      apagar.textContent='✕';
      apagar.title=L('btn.remover');
      apagar.setAttribute('aria-label',L('a11y.deleteItem').replace('{name}',cat));
      linha.appendChild(apagar);

      editar.addEventListener('click',()=>{
        const campo=document.createElement('input');
        campo.type='text';
        campo.className='cat-linha-campo';
        campo.value=cat;
        campo.setAttribute('aria-label',L('cat.renomear'));
        linha.replaceChild(campo,nome);
        editar.style.display='none';
        campo.focus();
        campo.select();

        const salvar=async()=>{
          const novo=campo.value.trim();
          if(!novo||novo===cat){ render(); return; }
          if(!renomearCategoria(cat,novo)){
            await alertDialog(L('erro.categoriaRepetida'));
            render();
            return;
          }
          await persist(); render();
        };
        campo.addEventListener('keydown',e=>{
          if(e.key==='Enter'){ e.preventDefault(); salvar(); }
          else if(e.key==='Escape'){ e.preventDefault(); render(); }
        });
        campo.addEventListener('blur',salvar);
      });

      apagar.addEventListener('click',async()=>{
        if(CATS().length<=1) return;
        if(!(await confirmDialog({text:L('confirm.removerCategoria').replace('{cat}',categoriaLabel(cat))}))) return;
        if(!removerCategoria(cat)) return;
        await persist(); render();
      });
    }

    el.appendChild(linha);

    const grade=document.createElement('div');
    grade.className='cat-emoji-grade';
    grade.hidden=true;
    grade.setAttribute('role','listbox');
    grade.setAttribute('aria-label',L('cat.escolherEmoji'));
    el.appendChild(grade);

    icone.addEventListener('click',()=>{
      const abrindo=grade.hidden;
      /* uma grade por vez: duas abertas viram um paredão de emoji */
      el.querySelectorAll('.cat-emoji-grade').forEach(g=>{ g.hidden=true; });
      el.querySelectorAll('.cat-linha-emoji').forEach(b=>b.setAttribute('aria-expanded','false'));
      if(!abrindo) return;
      pintarGradeDeEmojiEm(grade,(data.categoriaEmojis||{})[cat]||'',async escolhido=>{
        definirEmojiDeCategoria(cat,escolhido);
        await persist(); render();
      });
      grade.hidden=false;
      icone.setAttribute('aria-expanded','true');
    });
  });
}

/* ── lista de cartões nas configurações (nomear + múltiplos) ── */
function renderCartoesList(){
  const el=document.getElementById('cartoes-list'); if(!el) return;
  const list=data.cartoes||[];
  const emptyEl=document.getElementById('cartoes-empty-state');
  if(list.length===0){
    el.innerHTML='';
    if(emptyEl) emptyEl.style.display='block';
  }else{
    if(emptyEl) emptyEl.style.display='none';
    el.innerHTML=list.map(c=>{
      const subParts=[];
      if(c.diaFechamento) subParts.push(`${L('cartao.fechaDia')} ${c.diaFechamento}`);
      if(c.diaVencimento) subParts.push(`${L('cartao.venceDia')} ${c.diaVencimento}`);
      const sub=subParts.length?subParts.join(' · '):L('cartao.semDiasConfig');
      return `
      <div class="gf-item-row" data-action="edit-cartao" data-id="${c.id}" role="button" tabindex="0" aria-label="${esc(L('a11y.editItem').replace('{name}',c.nome))}">
        <div class="gf-item-main">
          <div class="gf-item-nome">${esc(c.nome)}</div>
          <div class="gf-item-sub">${esc(sub)}</div>
        </div>
        <div class="gf-item-valor">${c.limite>0?formatBRL(c.limite):L('cartao.semLimite')}</div>
      </div>`;
    }).join('');
    el.querySelectorAll('[data-action="edit-cartao"]').forEach(row=>{
      ativarComoBotao(row,()=>openCartaoSheet(row.getAttribute('data-id')),row.getAttribute('aria-label'));
    });
  }
  refreshCartaoSelects();
}

/* mantém os seletores "em qual cartão" atualizados sempre que a lista de cartões mudar */
function refreshCartaoSelects(){
  const purchasesCartaoEl=document.getElementById('purchases-cartao-select');
  if(purchasesCartaoEl){
    purchasesCartaoEl.innerHTML=(data.cartoes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    purchasesCartaoEl.style.display=(data.cartoes||[]).length>1?'':'none';
  }
}

/* ── limite do cartão ── */
function renderLimitCard(){
  const el=document.getElementById('limit-card'); if(!el) return;
  const cartoes=data.cartoes||[];
  if(!cartoes.length||!cartoes.some(c=>c.limite>0)){
    el.innerHTML=`<div class="limit-empty">${L('cartao.definaLimite')}</div>`;
    return;
  }
  el.innerHTML=cartoes.map(cartao=>{
    const c=computeCartao(cartao.id);
    if(!c.limite) return '';
    const barClass=c.pct>=90?'danger':(c.pct>=70?'warn':'');
    return `
    <div class="limit-card-item">
      <div class="limit-card-nome">${esc(cartao.nome)}</div>
      <div class="limit-top">
        <span class="lbl" data-i18n="cartao.comprometidoLbl">Comprometido</span>
        <span class="val">${formatBRL(c.comprometido)}</span>
      </div>
      <div class="limit-bar-track"><div class="limit-bar-fill ${barClass}" style="width:${c.pct}%;"></div></div>
      <div class="limit-foot">
        <span>${c.pct.toFixed(0)}% ${L('cartao.doLimite')}</span>
        <span>${L('cartao.disponivel')}: ${formatBRL(c.disponivel)}</span>
      </div>
      ${c.faturaAberta>0?`<div class="limit-fatura-aberta">🧾 ${L('cartao.faturaDe')} ${c.faturaAbertaMes} ${L('cartao.emAberto')}: ${formatBRL(c.faturaAberta)}</div>`:''}
    </div>`;
  }).join('');
}
