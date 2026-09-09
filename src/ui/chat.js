/* ─── chat flutuante do consultor de IA ─── */
function setupIaChatSheet(){
  const fab=document.getElementById('ia-chat-fab');
  const backdrop=document.getElementById('ia-chat-backdrop');
  const sheet=document.getElementById('ia-chat-sheet');
  const msgsEl=document.getElementById('ia-chat-messages');
  const input=document.getElementById('ia-chat-input');
  const sendBtn=document.getElementById('ia-chat-send');
  if(!fab||!backdrop||!sheet) return;
  let historico=[];

  function addMsg(role,texto){
    const div=document.createElement('div');
    div.className='ia-chat-msg '+role;
    div.textContent=texto;
    msgsEl.appendChild(div);
    msgsEl.scrollTop=msgsEl.scrollHeight;
    return div;
  }

  async function enviar(){
    const pergunta=input.value.trim();
    if(!pergunta) return;
    input.value='';
    addMsg('user',pergunta);
    historico.push({role:'user',texto:pergunta});
    const loadingEl=addMsg('bot loading',L('ia.analisando'));
    sendBtn.disabled=true;
    try{
      const resposta=await perguntarIAComHistorico(historico);
      loadingEl.className='ia-chat-msg bot';
      loadingEl.textContent=resposta;
      historico.push({role:'bot',texto:resposta});
    }catch(err){
      loadingEl.className='ia-chat-msg bot';
      loadingEl.textContent='⚠️ '+(err.message||L('ia.erroGenerico'));
    }finally{ sendBtn.disabled=false; input.focus(); }
  }

  function open(){
    if(msgsEl.children.length===0){
      addMsg('bot',L('ia.saudacao'));
    }
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='flex';
    ativarSheet(sheet,backdrop,input,close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  fab.addEventListener('click',()=>{ vibrate(8); open(); });
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheet.style.display==='flex') close(); });
  sendBtn.addEventListener('click',enviar);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') enviar(); });
}

function setupGastoSheet(){
  const fab=document.getElementById('gasto-fab');
  const backdrop=document.getElementById('gasto-sheet-backdrop');
  const sheet=document.getElementById('gasto-sheet');
  const cancelBtn=document.getElementById('gasto-sheet-cancel');
  const submitBtn=document.getElementById('gasto-sheet-submit');
  if(!fab||!backdrop||!sheet) return;

  let metodoAtual='pix';
  let categoriaAtual=null;
  let editingTransacaoId=null;
  let tipoAtual='gasto';

  function renderPayGrid(){
    sheet.querySelectorAll('.pay-method-btn').forEach(btn=>{
      const ativo=btn.getAttribute('data-metodo')===metodoAtual;
      btn.classList.toggle('active',ativo); btn.setAttribute('aria-pressed',ativo?'true':'false');
    });
    document.getElementById('gasto-credito-fields').style.display = metodoAtual==='credito' ? 'block' : 'none';
    document.querySelector('.gasto-dividir-toggle').style.display = metodoAtual==='credito' ? 'none' : 'block';
  }
  document.getElementById('gasto-tipo-toggle')?.querySelectorAll('.gasto-tipo-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      tipoAtual=btn.getAttribute('data-tipo');
      document.querySelectorAll('.gasto-tipo-btn').forEach(b=>{ const ativo=b===btn; b.classList.toggle('active',ativo); b.setAttribute('aria-pressed',ativo?'true':'false'); });
      const isReceita=tipoAtual==='receita';
      document.getElementById('gasto-sheet-title').textContent=editingTransacaoId?(isReceita?L('gasto.editarEntrada'):L('gasto.editarGasto')):(isReceita?L('gasto.novaEntrada'):L('sheet.novogasto'));
      const creditoBtn=document.querySelector('.pay-method-btn[data-metodo="credito"]');
      if(creditoBtn) creditoBtn.style.display=isReceita?'none':'';
      if(isReceita&&metodoAtual==='credito'){ metodoAtual='pix'; renderPayGrid(); }
      document.querySelector('.gasto-dividir-toggle').style.display = (metodoAtual==='credito'||isReceita) ? 'none' : 'block';
      updateAlertaMedia();
    });
  });
  sheet.querySelectorAll('.pay-method-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ metodoAtual=btn.getAttribute('data-metodo'); renderPayGrid(); });
  });

  function renderCatGrid(){
    const grid=document.getElementById('gasto-cat-grid');
    grid.innerHTML=CATS().map(c=>`<button type="button" class="cat-pill${c===categoriaAtual?' active':''}" aria-pressed="${c===categoriaAtual}" data-cat="${esc(c)}">${catIcon(c)} ${esc(categoriaLabel(c))}</button>`).join('');
    grid.querySelectorAll('.cat-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{ categoriaAtual=btn.getAttribute('data-cat'); renderCatGrid(); updateAlertaMedia(); });
    });
  }

  function updateAlertaMedia(){
    const el=document.getElementById('gasto-alerta-media');
    const valor=parseNum(document.getElementById('gasto-valor').value);
    if(!el||isNaN(valor)||valor<=0||!categoriaAtual){ if(el) el.style.display='none'; return; }
    const historico=transacoesGasto().filter(t=>t.categoria===categoriaAtual&&t.id!==editingTransacaoId);
    if(historico.length<3){ el.style.display='none'; return; }
    const media=historico.reduce((s,t)=>s+(t.valorTotal||t.valor),0)/historico.length;
    if(media<=0||valor<media*2){ el.style.display='none'; return; }
    const vezes=(valor/media).toFixed(1).replace(/\.0$/,'');
    el.style.display='block';
    el.textContent='⚠️ '+L('gasto.acimaDaMedia').replace('{vezes}',vezes).replace('{cat}',categoriaLabel(categoriaAtual)).replace('{media}',formatBRL(media));
  }
  document.getElementById('gasto-valor').addEventListener('input',updateAlertaMedia);

  const dividirCheck=document.getElementById('gasto-dividir-check');
  const dividirFields=document.getElementById('gasto-dividir-fields');
  function updateDividirPreview(){
    const hint=document.getElementById('gasto-valor-hint');
    const preview=document.getElementById('gasto-dividir-preview');
    hint.style.display=dividirCheck.checked?'block':'none';
    if(!dividirCheck.checked){ preview.textContent=''; return; }
    const valor=parseNum(document.getElementById('gasto-valor').value);
    const pct=Math.min(99,Math.max(1,parseInt(document.getElementById('gasto-dividir-pct').value,10)||50));
    if(isNaN(valor)||valor<=0){ preview.textContent=''; return; }
    preview.textContent=L('gasto.vocePaga')
      .replace('{parte}',formatBRL(Math.round(valor*pct/100*100)/100))
      .replace('{pct}',pct+'%').replace('{total}',formatBRL(valor));
  }
  dividirCheck.addEventListener('change',()=>{ dividirFields.style.display=dividirCheck.checked?'block':'none'; updateDividirPreview(); });
  document.getElementById('gasto-dividir-pct').addEventListener('input',updateDividirPreview);
  document.getElementById('gasto-valor').addEventListener('input',updateDividirPreview);

  function refreshViagemSelect(){
    const wrap=document.getElementById('gasto-viagem-field');
    const sel=document.getElementById('gasto-viagem');
    const ativas=(data.viagens||[]);
    if(!ativas.length){ wrap.style.display='none'; return; }
    wrap.style.display='block';
    sel.innerHTML=`<option value="">${L('viagem.nenhuma')}</option>`+ativas.map(v=>`<option value="${v.id}">${esc(v.nome)}</option>`).join('');
  }

  function resetForm(t){
    editingTransacaoId=t?t.id:null;
    tipoAtual=t?(t.tipo==='receita'?'receita':'gasto'):'gasto';
    document.getElementById('gasto-tipo-toggle')?.querySelectorAll('.gasto-tipo-btn').forEach(b=>{ const ativo=b.getAttribute('data-tipo')===tipoAtual; b.classList.toggle('active',ativo); b.setAttribute('aria-pressed',ativo?'true':'false'); });
    const creditoBtn=document.querySelector('.pay-method-btn[data-metodo="credito"]');
    if(creditoBtn) creditoBtn.style.display=tipoAtual==='receita'?'none':'';
    metodoAtual=t?(t.metodo||'debito'):'pix';
    categoriaAtual=t?(t.categoria||CATS()[0]):(CATS()[0]||null);
    const titleEl=document.getElementById('gasto-sheet-title');
    document.getElementById('gasto-sheet-title').textContent=editingTransacaoId?(tipoAtual==='receita'?L('gasto.editarEntrada'):L('gasto.editarGasto')):(tipoAtual==='receita'?L('gasto.novaEntrada'):L('sheet.novogasto'));
    const submitEl=document.getElementById('gasto-sheet-submit');
    if(submitEl) submitEl.textContent=t?L('gasto.salvarAlteracoes'):L('gasto.lancar');
    const credBtn=sheet.querySelector('.pay-method-btn[data-metodo="credito"]');
    if(credBtn) credBtn.style.display=t?'none':'';
    document.getElementById('gasto-valor').value=t?(t.valorTotal||t.valor):'';
    document.getElementById('gasto-descricao').value=t?t.nome:'';
    document.getElementById('gasto-parcelas').value='1';
    const dataEl=document.getElementById('gasto-data');
    dataEl.value=t?(t.data||todayISO()):todayISO();
    const cartaoEl=document.getElementById('gasto-cartao');
    cartaoEl.innerHTML=(data.cartoes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    refreshViagemSelect();
    const viagemEl=document.getElementById('gasto-viagem');
    if(viagemEl) viagemEl.value=t&&t.viagemId?t.viagemId:'';
    dividirCheck.checked=!!(t&&t.percentual&&t.percentual<100);
    dividirFields.style.display=dividirCheck.checked?'block':'none';
    document.getElementById('gasto-dividir-pct').value=t&&t.percentual?t.percentual:50;
    document.getElementById('gasto-tags').value=t&&t.tags?t.tags.join(', '):'';
    document.getElementById('gasto-nota').value=t&&t.nota?t.nota:'';
    renderPayGrid(); renderCatGrid();
    updateSubtitle();
    updateAlertaMedia();
    updateDividirPreview();
  }

  function updateSubtitle(){
    const dataEl=document.getElementById('gasto-data');
    const hoje=todayISO();
    const sub=document.getElementById('gasto-sheet-subtitle');
    if(dataEl.value===hoje){ sub.textContent=`${L('gasto.hoje')} · ${new Date().toLocaleDateString(localeAtual())}`; }
    else{ sub.textContent=new Date(dataEl.value+'T12:00:00').toLocaleDateString(localeAtual()); }
  }
  document.getElementById('gasto-data').addEventListener('change',updateSubtitle);

  function open(t){
    resetForm(t||null);
    backdrop.classList.remove('closing'); sheet.classList.remove('closing');
    backdrop.style.display='block'; sheet.style.display='block';
    ativarSheet(sheet,backdrop,document.getElementById('gasto-valor'),close);
  }
  function close(){ closeSheetWithAnim(sheet,backdrop); }
  attachSheetDragToClose(sheet,backdrop,sheet.querySelector('.sheet-handle'));
  _openGastoEdit=id=>{ const t=(data.transacoes||[]).find(x=>x.id===id); if(t){ vibrate(8); open(t); } };
  fab.addEventListener('click',()=>{ vibrate(8); open(null); });
  cancelBtn.addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && sheet.style.display==='block') close(); });

  submitBtn.addEventListener('click',async()=>{
    const valor=parseNum(document.getElementById('gasto-valor').value);
    if(isNaN(valor)||valor<=0){ document.getElementById('gasto-valor').focus(); return; }
    const categoria=categoriaAtual||'Outros';
    const descricaoEl=document.getElementById('gasto-descricao');
    const nome=descricaoEl.value.trim()||categoria;
    const dataISO=document.getElementById('gasto-data').value||todayISO();
    const viagemEl=document.getElementById('gasto-viagem');
    const viagemId=viagemEl&&viagemEl.value?viagemEl.value:null;
    const dividir=metodoAtual!=='credito'&&dividirCheck.checked;
    const pct=dividir?Math.min(99,Math.max(1,parseInt(document.getElementById('gasto-dividir-pct').value,10)||50)):100;
    const valorEfetivo=dividir?Math.round(valor*pct/100*100)/100:valor;
    const tagsRaw=document.getElementById('gasto-tags').value.trim();
    const tags=tagsRaw?tagsRaw.split(',').map(s=>s.trim()).filter(Boolean):[];
    const nota=document.getElementById('gasto-nota').value.trim();

    if(editingTransacaoId){
      atualizarTransacao(editingTransacaoId,{
        nome,valor:valorEfetivo,categoria,metodo:metodoAtual,data:dataISO,
        viagemId,tags,nota,tipo:tipoAtual==='receita'?'receita':null,
        percentual:tipoAtual!=='receita'&&dividir?pct:null,
        valorTotal:tipoAtual!=='receita'&&dividir?valor:null,
      });
    }else if(tipoAtual==='receita'){
      registrarMovimento({tipo:'receita',nome,valor,categoria,metodo:metodoAtual,data:dataISO,viagemId,tags,nota});
    }else if(metodoAtual==='credito'){
      const parcelas=Math.max(1,parseInt(document.getElementById('gasto-parcelas').value,10)||1);
      const cartaoEl=document.getElementById('gasto-cartao');
      const cid=cartaoEl?cartaoEl.value:undefined;
      const d=new Date(dataISO+'T12:00:00');
      let anoCompra=d.getFullYear(), mesCompra=d.getMonth()+1;
      // se a compra foi feita depois do dia de fechamento do cartão, ela cai na fatura do mês seguinte (como no cartão de verdade)
      const cartaoObj=(data.cartoes||[]).find(c=>c.id===cid);
      if(cartaoObj&&cartaoObj.diaFechamento&&d.getDate()>cartaoObj.diaFechamento){
        const nx=nextMonth(anoCompra,mesCompra); anoCompra=nx.ano; mesCompra=nx.mes;
      }
      lancarParcelamento(nome,valor,parcelas,anoCompra,mesCompra,categoria,cid,dataISO);
    }else{
      // dinheiro, débito e pix passam pelo mesmo comando que atualiza o saldo
      registrarMovimento({
        nome,valor:valorEfetivo,categoria,metodo:metodoAtual,data:dataISO,
        viagemId,tags,nota,percentual:dividir?pct:null,valorTotal:dividir?valor:null,
      });
    }
    vibrate([10,30,10]);
    await persist(); render();
    close();
  });
}
