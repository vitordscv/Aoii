/* ── static bindings ── */
function bindStatic(){
  const syncInput=document.getElementById('sync-code-input');
  function refreshSyncUI(){
    const code=getSyncCode();
    if(syncInput) syncInput.value=code;
    renderStatusSync();
  }
  refreshSyncUI();
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
    vibrate(8);
    await persist(); render();
  });
  document.getElementById('ia-chave-input')?.addEventListener('input',e=>{
    setIaChave(e.target.value.trim());
    render();
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
  document.getElementById('metas-add').addEventListener('click',async()=>{
    const nEl=document.getElementById('metas-nome'), vEl=document.getElementById('metas-valor'), dEl=document.getElementById('metas-data'), aEl=document.getElementById('metas-aporte');
    const nome=nEl.value.trim(), valor=parseNum(vEl.value);
    const aporte=parseNum(aEl&&aEl.value);
    const meta=criarMeta({nome,valorAlvo:valor,dataAlvo:dEl&&dEl.value,aporteMensal:isNaN(aporte)?0:aporte});
    if(!meta) return;
    vibrate(10);
    nEl.value=''; vEl.value=''; if(dEl) dEl.value=''; if(aEl) aEl.value='';
    await persist(); render();
  });
  document.getElementById('export-relatorio-btn')?.addEventListener('click',()=>{
    const t=today();
    const {entries,total}=computeCategoryBreakdown();
    const tot=computeTotals();
    const detalhe=computeCategoryDetalhe();
    const prevMes=computeCategoryPrevMonth();
    const rowsDetalhadas=entries.map(([cat,v])=>{
      const itens=(detalhe[cat]||[]).map(it=>`<tr><td class="sub">${esc(it.nome)}${it.data?` <span class="muted">· ${it.data}</span>`:''} <span class="muted" style="font-size:10.5px;">${esc(it.origem||'')}</span></td><td class="num sub">${formatBRL(it.val)}</td></tr>`).join('');
      const antes=prevMes[cat]||0;
      let delta='';
      if(antes>0){
        const pct=Math.round(((v-antes)/antes)*100);
        if(pct!==0) delta=`<span class="${pct>0?'up':'down'}"> ${pct>0?'▲':'▼'} ${Math.abs(pct)}%</span>`;
      }
      return `<tr><td class="cat-head">${catIcon(cat)} ${esc(categoriaLabel(cat))}${delta}</td><td class="num cat-head">${formatBRL(v)}</td></tr>${itens}`;
    }).join('')||`<tr><td colspan="2" class="muted">${L('rp.semDespesa')}</td></tr>`;

    const receitaItens=computeReceitasMesDetalhe();
    const totalReceitas=receitaItens.reduce((s,i)=>s+i.val,0);
    const rowsReceitas=receitaItens.map(i=>`<tr><td>${esc(i.nome)} <span class="muted" style="font-size:10.5px;">${esc(i.tag)}</span></td><td class="num">${formatBRL(i.val)}</td></tr>`).join('')||`<tr><td colspan="2" class="muted">${L('rp.semReceita')}</td></tr>`;

    const resultado=totalReceitas-total;

    const cartaoRows=(data.cartoes||[]).map(c=>{
      const info=computeCartao(c.id);
      return `<tr><td>${esc(c.nome)}</td><td class="num">${formatBRL(info.comprometido)}</td><td class="num">${formatBRL(info.limite)}</td><td class="num">${info.pct.toFixed(0)}%</td></tr>`;
    }).join('')||`<tr><td colspan="4" class="muted">${L('rp.semCartao')}</td></tr>`;

    const fixosRows=(data.gastosMensais||[]).map(g=>{
      const ativo=gastoFixoAtivoEm(g,t.getFullYear(),t.getMonth()+1);
      return `<tr><td>${esc(g.nome)}</td><td class="num">${L('rp.dia')} ${g.diaDoMes}</td><td class="num">${formatBRL(g.valor)}</td><td class="num">${ativo?L('rp.ativo'):L('rp.inativo')}</td></tr>`;
    }).join('')||`<tr><td colspan="4" class="muted">${L('rp.semConta')}</td></tr>`;

    const metaRows=(data.metas||[]).map(m=>
      `<tr><td>${esc(m.nome)}</td><td class="num">${formatBRL(m.valorGuardado||0)}</td><td class="num">${formatBRL(m.valorAlvo||0)}</td></tr>`
    ).join('')||`<tr><td colspan="3" class="muted">${L('rp.semMeta')}</td></tr>`;

    const geradoEm=`${t.toLocaleDateString(localeAtual())} ${L('rp.as')} ${t.toLocaleTimeString(localeAtual(),{hour:'2-digit',minute:'2-digit'})}`;
    const nomeMes=t.toLocaleDateString(localeAtual(),{month:'long',year:'numeric'});

    const doc=`<!DOCTYPE html><html lang="${localeAtual()}"><head><meta charset="utf-8"><title>${L('rp.tituloDoc')} ${nomeMes}</title>
    <style>
      *{box-sizing:border-box;}
      body{font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;padding:40px 44px;margin:0;font-size:13px;}
      .rp-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1a1a;padding-bottom:14px;margin-bottom:22px;}
      h1{font-size:20px;margin:0 0 4px;font-weight:700;letter-spacing:.01em;}
      .rp-doc-sub{font-size:11.5px;color:#555;font-family:Arial,sans-serif;}
      .rp-meta{text-align:right;font-family:Arial,sans-serif;font-size:10.5px;color:#666;line-height:1.5;}
      h2{font-size:13px;margin:28px 0 10px;padding:6px 0 6px;background:#1a1a1a;color:#fff;padding-left:10px;font-family:Arial,sans-serif;font-weight:700;letter-spacing:.03em;text-transform:uppercase;}
      .rp-sub{font-size:12px;color:#555;margin-bottom:6px;font-family:Arial,sans-serif;}
      .muted{color:#888;font-family:Arial,sans-serif;}
      table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:4px;}
      td{padding:6px 4px;border-bottom:1px solid #ddd;font-family:Arial,sans-serif;}
      td.num{text-align:right;font-family:'Courier New',monospace;white-space:nowrap;}
      td.cat-head{font-weight:700;}
      td.sub{padding-left:18px;font-size:11.5px;color:#555;border-bottom:none;line-height:1.6;}
      .up{color:#8a2e22;font-size:10.5px;font-weight:700;}
      .down{color:#295c46;font-size:10.5px;font-weight:700;}
      .rp-total{font-weight:700;font-size:13.5px;border-top:1.5px solid #1a1a1a;margin-top:2px;padding-top:8px;display:flex;justify-content:space-between;font-family:Arial,sans-serif;}
      .rp-resultado{margin-top:26px;padding:16px 18px;border:2px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;font-family:Arial,sans-serif;}
      .rp-resultado .lbl{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}
      .rp-resultado .val{font-family:'Courier New',monospace;font-size:22px;font-weight:700;}
      .rp-resultado .val.neg{color:#8a2e22;}
      .rp-footer{margin-top:34px;padding-top:12px;border-top:1px solid #ccc;font-family:Arial,sans-serif;font-size:10px;color:#888;line-height:1.6;}
      @media print{ h2{page-break-after:avoid;} tr{page-break-inside:avoid;} }
    </style></head><body>
      <div class="rp-header">
        <div>
          <h1>${L('rp.tituloDoc')}</h1>
          <div class="rp-doc-sub">${L('rp.subDoc')} — ${nomeMes}</div>
        </div>
        <div class="rp-meta">${L('rp.geradoEm')}<br>${geradoEm}</div>
      </div>

      <h2>1. ${L('rp.s1')}</h2>
      <table>${rowsReceitas}</table>
      <div class="rp-total"><span>${L('rp.totalReceitas')}</span><span>${formatBRL(totalReceitas)}</span></div>

      <h2>2. ${L('rp.s2')}</h2>
      <table>${rowsDetalhadas}</table>
      <div class="rp-total"><span>${L('rp.totalDespesas')}</span><span>${formatBRL(total)}</span></div>

      <div class="rp-resultado">
        <span class="lbl">${L('rp.resultado')}</span>
        <span class="val${resultado<0?' neg':''}">${formatBRL(resultado)}</span>
      </div>

      <h2>3. ${L('rp.s3')}</h2>
      <table>
        <tr><td>${L('rp.saldoConta')}</td><td class="num">${formatBRL(data.saldoAtual||0)}</td></tr>
        <tr><td>${L('rp.dinheiroEspecie')}</td><td class="num">${formatBRL(data.dinheiroVivo||0)}</td></tr>
        <tr><td class="cat-head">${L('rp.saldoProjetado').replace('{data}',new Date(data.dataAlvo+'T12:00:00').toLocaleDateString(localeAtual()))}</td><td class="num cat-head">${formatBRL(tot.projetado)}</td></tr>
      </table>

      <h2>4. ${L('rp.s4')}</h2>
      <table>
        <tr><td class="muted">${L('rp.cartao')}</td><td class="num muted">${L('rp.comprometido')}</td><td class="num muted">${L('rp.limite')}</td><td class="num muted">${L('rp.pctUsado')}</td></tr>
        ${cartaoRows}
      </table>

      <h2>5. ${L('rp.s5')}</h2>
      <table>
        <tr><td class="muted">${L('rp.descricao')}</td><td class="num muted">${L('rp.vencimento')}</td><td class="num muted">${L('rp.valor')}</td><td class="num muted">${L('rp.situacao')}</td></tr>
        ${fixosRows}
      </table>

      <h2>6. ${L('rp.s6')}</h2>
      <table>
        <tr><td class="muted">${L('rp.meta')}</td><td class="num muted">${L('rp.guardado')}</td><td class="num muted">${L('rp.alvo')}</td></tr>
        ${metaRows}
      </table>

      <div class="rp-footer">
        ${L('rp.rodape')}
      </div>
    </body></html>`;
    const ifr=document.createElement('iframe');
    ifr.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(ifr);
    const idoc=ifr.contentWindow.document;
    idoc.open(); idoc.write(doc); idoc.close();
    setTimeout(()=>{
      ifr.contentWindow.focus();
      ifr.contentWindow.print();
      setTimeout(()=>ifr.remove(),1000);
    },250);
  });
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
      cartaoSelEl.style.display=(data.cartoes||[]).length>1?'':'none';
    }
    document.getElementById(prefix+'-add').addEventListener('click',async()=>{
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
      await persist(); render();
    });
  }
  document.getElementById('dividas-add').addEventListener('click',async()=>{
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
