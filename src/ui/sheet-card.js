/* ─── bottom sheet "Novo cartão" — Configurações ─── */
let _openCartaoSheet=null;
function openCartaoSheet(id){ if(_openCartaoSheet) _openCartaoSheet(id); }

function setupCartaoSheet(){
  const backdrop=document.getElementById('cartao-sheet-backdrop');
  const sheet=document.getElementById('cartao-sheet');
  const cancelBtn=document.getElementById('cartao-sheet-cancel');
  const delBtn=document.getElementById('cartao-sheet-del');
  const submitBtn=document.getElementById('cartao-sheet-submit');
  const titleEl=document.getElementById('cartao-sheet-title');
  if(!backdrop||!sheet) return;

  let editingId=null;

  function resetForm(c){
    editingId=c?c.id:null;
    titleEl.textContent=c?L('cartao.editar'):L('sheet.novocartao');
    document.getElementById('cartao-nome').value=c?c.nome:'';
    document.getElementById('cartao-fechamento').value=c&&c.diaFechamento?c.diaFechamento:'';
    document.getElementById('cartao-vencimento').value=c&&c.diaVencimento?c.diaVencimento:'';
    document.getElementById('cartao-limite').value=c&&c.limite?c.limite:'';
    submitBtn.textContent=c?L('card.save'):L('cartao.adicionar');
    delBtn.style.display=c?'block':'none';
  }

  function open(id){
    const c=id?(data.cartoes||[]).find(x=>x.id===id):null;
    resetForm(c);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,document.getElementById('cartao-nome'),close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openCartaoSheet=open;

  document.getElementById('cartao-new-btn')?.addEventListener('click',()=>open(null));
  /* ── o emoji da categoria nova ──────────────────────────────────────────
     Uma grade curta, não um teclado de emoji inteiro: são ~30 símbolos que
     cobrem o que as pessoas criam de categoria (pet, academia, filho, carro,
     presente). Quem quiser outro cola no campo — `definirEmojiDeCategoria()`
     aceita qualquer um, a grade é só o caminho rápido. */
  /* a grade mora em ui/effects.js: a lista de categorias usa a mesma */
  let emojiEscolhido='';

  function pintarGradeDeEmoji(){
    const grade=document.getElementById('categoria-emoji-grade');
    if(!grade||grade.childElementCount) return;
    EMOJIS_DE_CATEGORIA.forEach(e=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='cat-emoji-opcao';
      b.setAttribute('role','option');
      b.setAttribute('aria-selected','false');
      b.textContent=e;
      b.addEventListener('click',()=>{
        const igual=emojiEscolhido===e;
        emojiEscolhido=igual?'':e;
        [...grade.children].forEach(o=>o.setAttribute('aria-selected',
          !igual&&o.textContent===e?'true':'false'));
        const botao=document.getElementById('categoria-emoji-btn');
        if(botao) botao.textContent=emojiEscolhido||'\u{1F4E6}';
        grade.hidden=true;
        const abre=document.getElementById('categoria-emoji-btn');
        if(abre) abre.setAttribute('aria-expanded','false');
        const campo=document.getElementById('categoria-nova-nome');
        if(campo) campo.focus();
      });
      grade.appendChild(b);
    });
  }

  document.getElementById('categoria-emoji-btn')?.addEventListener('click',e=>{
    const grade=document.getElementById('categoria-emoji-grade');
    if(!grade) return;
    pintarGradeDeEmoji();
    grade.hidden=!grade.hidden;
    e.currentTarget.setAttribute('aria-expanded',grade.hidden?'false':'true');
  });

  umEnvioPorVez(document.getElementById('categoria-add-btn'),async()=>{
    const inp=document.getElementById('categoria-nova-nome');
    const nome=inp.value.trim();
    if(!nome) return;
    /* limpar o campo e não fazer nada era o pior desfecho: parecia que tinha
       dado certo. O único motivo de recusa que a pessoa pode corrigir é o
       nome repetido — os outros (vazio, longo demais) ela vê no campo. */
    if(!adicionarCategoria(nome,emojiEscolhido)){ await alertDialog(L('erro.categoriaRepetida')); inp.select(); return; }
    inp.value='';
    /* volta ao estado neutro: o emoji escolhido era daquela categoria, e
       deixá-lo grudado faria a próxima nascer com o ícone da anterior */
    emojiEscolhido='';
    const botao=document.getElementById('categoria-emoji-btn');
    if(botao) botao.textContent='\u{1F4E6}';
    const grade=document.getElementById('categoria-emoji-grade');
    if(grade){ grade.hidden=true; [...grade.children].forEach(o=>o.setAttribute('aria-selected','false')); }
    await persist(); render();
  });
  umEnvioPorVez(document.getElementById('viagem-add-btn'),async()=>{
    const nInp=document.getElementById('viagem-nova-nome'), oInp=document.getElementById('viagem-novo-orcamento');
    const nome=nInp.value.trim();
    if(!nome) return;
    if(!criarViagem({nome,orcamento:parseNumOpcional(oInp.value)})){ await alertDialog(L('erro.viagemInvalida')); return; }
    nInp.value=''; oInp.value='';
    await persist(); render();
  });
  function atualizarSimulador(){
    const resEl=document.getElementById('sim-resultado');
    const alvo=parseNum(document.getElementById('sim-valor-alvo').value);
    const aporte=parseNum(document.getElementById('sim-aporte-mensal').value);
    if(isNaN(alvo)||alvo<=0||isNaN(aporte)||aporte<=0){ resEl.textContent=''; return; }
    const meses=Math.ceil(alvo/aporte);
    const dataFinal=new Date(); dataFinal.setMonth(dataFinal.getMonth()+meses);
    resEl.textContent=L('goal.simulationResult')
      .replace('{n}',meses)
      .replace('{period}',meses===1?L('inv.mes'):L('inv.meses'))
      .replace('{month}',MONTH_NAMES[dataFinal.getMonth()])
      .replace('{year}',dataFinal.getFullYear());
  }
  document.getElementById('sim-valor-alvo')?.addEventListener('input',atualizarSimulador);
  document.getElementById('sim-aporte-mensal')?.addEventListener('input',atualizarSimulador);
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheet.style.display==='block') close(); });

  delBtn.addEventListener('click',async()=>{
    if(!editingId) return;
    if(!(await confirmDialog({text:L('confirm.removerCartao')}))) return;
    if(!removerCartao(editingId)) return;
    await persist(); render();
    close();
  });

  umEnvioPorVez(submitBtn,async()=>{
    const nomeEl=document.getElementById('cartao-nome');
    const nome=nomeEl.value.trim();
    if(!nome){ nomeEl.focus(); return; }
    const entrada={
      nome,
      diaFechamento:document.getElementById('cartao-fechamento').value,
      diaVencimento:document.getElementById('cartao-vencimento').value,
      /* "Limite (opcional)": em branco vale zero. Com parseNum puro vinha NaN
         e o cartão inteiro era recusado — ver parseNumOpcional() */
      limite:parseNumOpcional(document.getElementById('cartao-limite').value),
    };
    const salvo=editingId?atualizarCartao(editingId,entrada):criarCartao(entrada);
    /* recusa sem aviso é o pior desfecho possível: o botão não faz nada e a
       pessoa não tem como saber qual campo está errado */
    if(!salvo){ await alertDialog(L('cartao.erroCampos')); return; }
    await persist(); render();
    close();
  });
}
