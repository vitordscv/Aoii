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
    submitBtn.textContent=c?'✓ Salvar cartão':'✓ Adicionar';
    delBtn.style.display=c?'block':'none';
  }

  function open(id){
    const c=id?(data.cartoes||[]).find(x=>x.id===id):null;
    resetForm(c);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openCartaoSheet=open;

  document.getElementById('cartao-new-btn')?.addEventListener('click',()=>open(null));
  document.getElementById('categoria-add-btn')?.addEventListener('click',async()=>{
    const inp=document.getElementById('categoria-nova-nome');
    const nome=inp.value.trim();
    if(!nome) return;
    if(CATS().some(c=>c.toLowerCase()===nome.toLowerCase())){ inp.value=''; return; }
    data.categorias=[...CATS(),nome];
    inp.value='';
    await persist(); render();
  });
  document.getElementById('viagem-add-btn')?.addEventListener('click',async()=>{
    const nInp=document.getElementById('viagem-nova-nome'), oInp=document.getElementById('viagem-novo-orcamento');
    const nome=nInp.value.trim();
    if(!nome) return;
    if(!data.viagens) data.viagens=[];
    data.viagens.push({id:uid(),nome,orcamento:parseNum(oInp.value)||0});
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
    resEl.textContent=`Em ${meses} ${meses===1?'mês':'meses'} (~${MONTH_NAMES[dataFinal.getMonth()]} ${dataFinal.getFullYear()}) você chega lá.`;
  }
  document.getElementById('sim-valor-alvo')?.addEventListener('input',atualizarSimulador);
  document.getElementById('sim-aporte-mensal')?.addEventListener('input',atualizarSimulador);
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheet.style.display==='block') close(); });

  delBtn.addEventListener('click',async()=>{
    if(!editingId) return;
    if(!(await confirmDialog({text:L('confirm.removerCartao')}))) return;
    data.cartoes=(data.cartoes||[]).filter(c=>c.id!==editingId);
    const novoPrimeiro=data.cartoes.length?data.cartoes[0].id:null;
    // reatribui as faturas do cartão removido; se já existir uma fatura do mesmo mês no cartão de destino, funde os dois em vez de duplicar
    (data.faturas||[]).filter(f=>f.cartaoId===editingId).forEach(f=>{
      const destino=data.faturas.find(x=>x!==f&&x.cartaoId===novoPrimeiro&&x.ano===f.ano&&x.mes===f.mes);
      if(destino){
        destino.valor=(destino.valor||0)+(f.valor||0);
        destino.gastos=[...(destino.gastos||[]),...(f.gastos||[])];
        data.faturas=data.faturas.filter(x=>x!==f);
      }else{
        f.cartaoId=novoPrimeiro;
      }
    });
    (data.comprasPlanejadas||[]).forEach(c=>{ if(c.cartaoId===editingId) c.cartaoId=novoPrimeiro; });
    await persist(); render();
    close();
  });

  submitBtn.addEventListener('click',async()=>{
    const nomeEl=document.getElementById('cartao-nome');
    const nome=nomeEl.value.trim();
    if(!nome){ nomeEl.focus(); return; }
    const fEl=document.getElementById('cartao-fechamento').value;
    const vEl=document.getElementById('cartao-vencimento').value;
    const diaFechamento=fEl?Math.min(31,Math.max(1,parseInt(fEl,10)||1)):null;
    const diaVencimento=vEl?Math.min(31,Math.max(1,parseInt(vEl,10)||1)):null;
    const limite=parseNum(document.getElementById('cartao-limite').value)||0;

    if(editingId){
      const c=(data.cartoes||[]).find(x=>x.id===editingId);
      if(c){ Object.assign(c,{nome,diaFechamento,diaVencimento,limite}); }
    }else{
      if(!data.cartoes) data.cartoes=[];
      data.cartoes.push({id:uid(),nome,diaFechamento,diaVencimento,limite});
    }
    await persist(); render();
    close();
  });
}

