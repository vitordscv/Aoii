/* ── static bindings ── */
function bindStatic(){
  const syncInput=document.getElementById('sync-code-input');
  function refreshSyncUI(){
    const code=getSyncCode();
    if(syncInput) syncInput.value=code;
    renderStatusSync();
  }
  refreshSyncUI();
  ligarBotaoEsquecerSenha();
  ligarAbasDeVisao();
  iniciarSombraDeRolagemGenerica();
  /* Ligar a sincronização pela primeira vez. A ordem aqui É a proteção:
     backup local exigido → senha (duas vezes) → só então o código nasce.
     Não existe recuperar senha; se ela se perder, o arquivo baixado é o que
     sobra. Por isso ele vem ANTES, e não como sugestão depois. */
  document.getElementById('sync-gen-btn')?.addEventListener('click',async()=>{
    if(!SUPABASE_URL||!SUPABASE_ANON_KEY){ setSaveStatus(L('st.syncErroAtivar')); return; }
    if(espelhoPendente()){ await alertDialog(L('sync.trocaPendente')); return; }
    if(!prepararSincronizacao()) return;
    try{

    if(!await exigirBackupAntesDeCifrar()) return;

    const senha=await pedirSenhaSync({
      titulo:L('senha.novaTitulo'),
      texto:L('senha.novaTexto'),
      confirmar:true,
      okLabel:L('senha.criarOk'),
    });
    if(!senha) return;

    let code;
    try{ code=gerarCodigoSync(); }
    catch(e){ setSaveStatus(L('st.syncErroAtivar')); return; }
    setSyncCode(code);
    refreshSyncUI();
    sync.status='sincronizando'; renderStatusSync();

    const abriu=await abrirSincronizacao(code,senha);
    if(abriu.resultado!=='nova'){ setSaveStatus(L('st.syncErroAtivar')); renderStatusSync(); return; }
    confirmarRevisaoLocal(0);
    agendarEspelho();
    }finally{ concluirAberturaSync(); }
  });

  /* Entrar num código que já existe: pede a senha e deixa o motor descobrir se
     é cópia cifrada, registro antigo a migrar, ou código que ainda não existe. */
  document.getElementById('sync-use-btn')?.addEventListener('click',async()=>{
    const code=(syncInput?.value||'').trim().toUpperCase();
    if(!code) return;
    if(!SUPABASE_URL||!SUPABASE_ANON_KEY){ setSaveStatus(L('st.syncErroAtivar')); return; }
    if(await destrancarSincronizacao(code)) refreshSyncUI();
  });
  document.querySelectorAll('#cfg-tipo-renda .segmented-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      if(definirTipoRenda(btn.getAttribute('data-tipo'))) { await persist(); render(); }
    });
  });
  document.getElementById('cfg-renda-diaria').addEventListener('change',async e=>{
    if(atualizarRendaDiaria(parseNum(e.target.value))!==null){ await persist(); render(); }
  });
  document.getElementById('cfg-renda-mensal-valor').addEventListener('change',async e=>{
    if(atualizarRendaMensal(parseNum(e.target.value),data.rendaMensal.diaDoMes)){ await persist(); render(); }
  });
  document.getElementById('cfg-renda-mensal-dia').addEventListener('change',async e=>{
    if(atualizarRendaMensal(data.rendaMensal.valor,parseInt(e.target.value,10))){ await persist(); render(); }
  });
  document.getElementById('cfg-fundo-ilustrado').addEventListener('change',async e=>{
    if(definirPreferenciaBooleana('fundoIlustrado',e.target.checked)===null) return;
    vibrate(8);
    await persist(); render();
  });
  document.getElementById('cfg-tema-auto-noite')?.addEventListener('change',async e=>{
    if(definirPreferenciaBooleana('temaAutoNoite',e.target.checked)===null) return;
    vibrate(8);
    await persist(); render();
  });
  document.getElementById('cfg-gasto-diario').addEventListener('change',async e=>{
    if(definirPreferenciaBooleana('gastoDiario',e.target.checked)===null) return;
    vibrate(8);
    await persist(); render();
  });
  document.getElementById('ia-ativa-check')?.addEventListener('change',async e=>{
    if(definirPreferenciaBooleana('iaAtiva',e.target.checked)===null) return;
    /* desligar apaga a chave: guardar a credencial de um recurso que a pessoa
       acabou de dispensar nao serve a ninguem */
    if(!e.target.checked){
      esquecerIaChave();
      const campo=document.getElementById('ia-chave-input');
      if(campo) campo.value='';
    }
    vibrate(8);
    await persist(); render();
  });
  document.getElementById('ia-chave-input')?.addEventListener('input',e=>{
    setIaChave(e.target.value.trim());
    render();
  });
  document.getElementById('ia-lembrar-check')?.addEventListener('change',e=>{
    definirLembrarIaChave(e.target.checked);
    vibrate(6);
    render();
  });
  /* mostrar/ocultar: quem cola uma chave precisa conferir se colou inteira */
  document.getElementById('ia-chave-ver')?.addEventListener('click',e=>{
    const campo=document.getElementById('ia-chave-input');
    if(!campo) return;
    const mostrando=campo.type==='text';
    campo.type=mostrando?'password':'text';
    const b=e.currentTarget;
    b.setAttribute('aria-pressed',mostrando?'false':'true');
    b.title=L(mostrando?'tt.mostrarChave':'tt.ocultarChave');
    campo.focus();
  });
  document.getElementById('cfg-moeda').addEventListener('change',async e=>{
    if(definirMoeda(e.target.value)){ await persist(); render(); }
  });
  document.getElementById('cfg-idioma')?.addEventListener('change',async e=>{
    if(definirIdioma(e.target.value)){ await persist(); render(); }
  });
  document.getElementById('theme-select').addEventListener('change',async e=>{
    if(!definirTema(e.target.value)) return;
    if(data.tema==='custom') customPanelHidden=false;
    applyTheme(data.tema); await persist();
  });
  (function bindThemeMenu(){
    const btn=document.getElementById('theme-menu-btn');
    const menu=document.getElementById('theme-menu');
    const sel=document.getElementById('theme-select');
    if(!btn||!menu||!sel) return;
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const open=menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open?'true':'false');
    });
    menu.querySelectorAll('.theme-menu-item').forEach(item=>{
      item.addEventListener('click',()=>{
        sel.value=item.getAttribute('data-theme');
        sel.dispatchEvent(new Event('change'));
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
      });
    });
    document.addEventListener('click',e=>{
      if(menu.classList.contains('open') && !menu.contains(e.target) && e.target!==btn){
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
      }
    });
  })();
  document.getElementById('ct-close-btn')?.addEventListener('click',()=>{
    customPanelHidden=true; applyTheme(data.tema);
  });
  document.getElementById('ct-reopen-btn')?.addEventListener('click',()=>{
    customPanelHidden=false; applyTheme(data.tema);
  });
  bindCustomTheme();
  umEnvioPorVez(document.getElementById('metas-add'),async()=>{
    const nEl=document.getElementById('metas-nome'), vEl=document.getElementById('metas-valor'), dEl=document.getElementById('metas-data'), aEl=document.getElementById('metas-aporte');
    const nome=nEl.value.trim(), valor=parseNum(vEl.value);
    const aporte=parseNum(aEl&&aEl.value);
    const meta=criarMeta({nome,valorAlvo:valor,dataAlvo:dEl&&dEl.value,aporteMensal:isNaN(aporte)?0:aporte});
    if(!meta) return;
    vibrate(10);
    nEl.value=''; vEl.value=''; if(dEl) dEl.value=''; if(aEl) aEl.value='';
    await persist(); render();
  });
  document.getElementById('export-relatorio-btn')?.addEventListener('click',imprimirRelatorioDoMes);
  document.getElementById('export-csv-mes-btn')?.addEventListener('click',exportarMovimentosDoMesCSV);
  document.getElementById('download-json-btn')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='aoii-backup-'+todayISO()+'.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  });
  document.getElementById('export-btn').addEventListener('click',()=>{
    const code=btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const out=document.getElementById('export-output');
    out.style.display='block'; out.value=code;
    document.getElementById('copy-code-btn').style.display='inline-block';
  });
  document.getElementById('copy-code-btn').addEventListener('click',async()=>{
    const out=document.getElementById('export-output');
    try{
      await navigator.clipboard.writeText(out.value);
      setSaveStatus(L('st.codigoCopiado'));
    }catch(e){
      out.select();
    }
  });
  document.getElementById('upload-json-btn')?.addEventListener('click',()=>{
    document.getElementById('upload-json-input')?.click();
  });
  document.getElementById('upload-json-input')?.addEventListener('change',async(e)=>{
    const file=e.target.files&&e.target.files[0]; if(!file) return;
    try{
      const text=await file.text();
      const r=adotarDadosDeFora(JSON.parse(text),'arquivo',{bytes:text.length});
      if(!r.ok){ await alertDialog(L('erro.backupRecusado').replace('{motivo}',r.problemas[0]||'')); return; }
      if(!(await confirmDialog({text:L('confirm.importarCodigo')}))) return;
      data=r.data;
      await persist(); render();
      if(r.descartados.length) setSaveStatus(L('st.backupAjustado').replace('{n}',r.descartados.length));
    }catch(err){
      await alertDialog(L('erro.arquivoInvalido'));
    }
    e.target.value='';
  });
  document.getElementById('import-btn').addEventListener('click',async()=>{
    const input=document.getElementById('import-input');
    const raw=input.value.trim();
    if(!raw) return;
    let texto;
    try{
      texto=decodeURIComponent(escape(atob(raw)));
    }catch(e){
      await alertDialog(L('erro.codigoInvalido'));
      return;
    }
    let r;
    try{ r=adotarDadosDeFora(JSON.parse(texto),'codigo',{bytes:texto.length}); }
    catch(e){ await alertDialog(L('erro.codigoInvalido')); return; }
    if(!r.ok){ await alertDialog(L('erro.backupRecusado').replace('{motivo}',r.problemas[0]||'')); return; }
    if(!(await confirmDialog({text:L('confirm.importarCodigo')}))) return;
    data=r.data;
    await persist(); render();
    if(r.descartados.length) setSaveStatus(L('st.backupAjustado').replace('{n}',r.descartados.length));
    input.value='';
  });
  document.getElementById('reset-btn').addEventListener('click',async()=>{
    const ok=await confirmDialog({
      title:L('reset.titulo'),
      text:L('reset.texto'),
      okLabel:L('reset.okLabel')
    });
    if(ok){ data=defaultData(); await persist(); render(); vibrate([20,60,20]); }
  });
  document.getElementById('skip-day-add').addEventListener('click',async()=>{
    const input=document.getElementById('skip-day-input');
    const ds=input.value; if(!ds) return;
    if(adicionarDiaNaoTrabalhado(ds)){ await persist(); render(); }
    input.value='';
  });

  function bindAdd(prefix,key,doneField){
    const cartaoSelEl=document.getElementById(prefix+'-cartao-select');
    if(cartaoSelEl){
      cartaoSelEl.innerHTML=(data.cartoes||[]).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
      /* com um cartão só não há o que escolher: some o campo inteiro, não só
         o select, pra não deixar um rótulo órfão */
      const rotulo=document.getElementById(prefix+'-cartao-select-label');
      if(rotulo) rotulo.hidden=(data.cartoes||[]).length<2;
    }
    /* parcelas e cartão só fazem sentido depois do sim */
    const marcaCartao=document.getElementById(prefix+'-cartao');
    const extraCartao=document.getElementById(prefix+'-cartao-extra');
    const mostrarExtra=()=>{ if(extraCartao) extraCartao.hidden=!(marcaCartao&&marcaCartao.checked); };
    if(marcaCartao&&extraCartao){ marcaCartao.addEventListener('change',mostrarExtra); mostrarExtra(); }
    umEnvioPorVez(document.getElementById(prefix+'-add'),async()=>{
      const nEl=document.getElementById(prefix+'-nome');
      const vEl=document.getElementById(prefix+'-valor');
      const dEl=document.getElementById(prefix+'-data');
      const cEl=document.getElementById(prefix+'-cartao');
      const pEl=document.getElementById(prefix+'-parcelas');
      const cartaoSelEl2=document.getElementById(prefix+'-cartao-select');
      const nome=nEl.value.trim(), valor=parseNum(vEl.value);
      if(!nome||isNaN(valor)) return;
      const entrada={nome,valor,nota:'',feito:false,dataPrevista:dEl&&dEl.value?dEl.value:null};
      const item=key==='entradasExtras'?criarPlanejado('entrada',entrada):criarPlanejado('compra',{
        ...entrada,cartao:cEl&&cEl.checked,parcelas:Math.max(1,parseInt(pEl&&pEl.value,10)||1),parcelasLancadas:false,
        cartaoId:cartaoSelEl2?cartaoSelEl2.value:(data.cartoes[0]&&data.cartoes[0].id),
      });
      if(!item) return;
      nEl.value=''; vEl.value=''; if(dEl) dEl.value='';
      if(cEl) cEl.checked=false; if(pEl) pEl.value='1';
      mostrarExtra();   // a caixa voltou pro não; o bloco tem que voltar junto
      await persist(); render();
    });
  }
  umEnvioPorVez(document.getElementById('dividas-add'),async()=>{
    const nEl=document.getElementById('dividas-nome');
    const cEl=document.getElementById('dividas-credor');
    const vEl=document.getElementById('dividas-valor');
    const nome=nEl.value.trim(), valor=parseNum(vEl.value);
    if(!nome||isNaN(valor)) return;
    /* nasce sem previsão: prometer um mês que ninguém combinou seria
       inventar número na projeção. A pessoa escolhe depois, na linha. */
    if(!criarPlanejado('divida',{nome,credor:cEl.value.trim(),valor,modo:'semPrevisao',dataPrevista:null})) return;
    nEl.value=''; cEl.value=''; vEl.value='';
    await persist(); render();
  });
  bindAdd('extras','entradasExtras','feito');
  bindAdd('purchases','comprasPlanejadas','feito');
