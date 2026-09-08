/* ═══════════════════════════════════════════════════════════════════════════
   A parte da sincronização que aparece na tela.

   O motor (storage/sync-ciclo.js) decide; aqui a gente pergunta, mostra e
   registra. A divisão existe para o ciclo inteiro poder ser ensaiado sem
   navegador — e é ensaiado, em testes/ciclo-sync.test.js e, contra o banco de
   verdade, em testes/ciclo-homologacao.js.

   Duas coisas que a tela precisa fazer e o motor não faz:

   - **exigir o backup local antes de cifrar.** Não existe recuperar senha. Se
     a pessoa esquecer, a cópia da nuvem vira ruído; o arquivo baixado é o que
     sobra. Por isso o botão de exportar vem antes do campo de senha, e não é
     sugestão: sem confirmar, a senha nem é pedida.
   - **nunca escolher um lado num conflito.** Somar dois saldos sem regra é
     pior do que perguntar.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Os sete estados. `sync.status` guarda a chave; isto vira texto. */
function textoDoStatusSync(){
  switch(sync.status){
    case 'desligada':     return L('sync.desligada');
    case 'nova':          return L('sync.pronta');
    case 'precisa-senha': return L('sync.trancada');
    case 'migrar':        return L('sync.aMigrar');
    case 'sincronizando': return L('sync.sincronizando');
    case 'sincronizada':  return L('sync.emDia');
    case 'sem-conexao':   return L('sync.semConexao');
    case 'conflito':      return L('sync.conflito');
    case 'erro':          return L('sync.falhou');
    default:              return '';
  }
}

function renderStatusSync(){
  const el=document.getElementById('sync-status-text');
  if(!el) return;
  const codigo=getSyncCode();
  if(!SUPABASE_URL||!SUPABASE_ANON_KEY){ el.textContent=L('sync.naoConfigurada'); return; }
  if(!codigo){ el.textContent=L('sync.gereCodigo'); return; }
  const pendente=espelhoPendente();
  if(codigo&&!sincronizacaoDestrancada()&&!_abrindoSync) sync.status='precisa-senha';
  el.textContent=L('sync.ativa').replace('{codigo}',codigo)+' · '+textoDoStatusSync()+
    (pendente?' · '+L('sync.pendente'):'')+
    (emHomologacao()?'  ⚠️ HOMOLOGAÇÃO':'');
  if(pendente) setSaveStatus(L('sync.pendente'));
  else if(sync.status==='sincronizada') setSaveStatus(L('sync.emDia'));
}

/* ── a caixa de senha ──
   Devolve a senha, ou null se a pessoa desistiu. Com `confirmar`, pede duas
   vezes e não aceita divergência nem senha curta demais. */
function pedirSenhaSync(opcoes){
  opcoes=opcoes||{};
  return new Promise(resolve=>{
    const bd=document.getElementById('senha-backdrop');
    const dg=document.getElementById('senha-dialog');
    const campo=document.getElementById('senha-input');
    const campo2=document.getElementById('senha-input-2');
    const linha2=document.getElementById('senha-linha-2');
    const erroEl=document.getElementById('senha-erro');
    const olho=document.getElementById('senha-olho');
    const okBtn=document.getElementById('senha-ok');
    const cancelBtn=document.getElementById('senha-cancelar');
    if(!bd||!dg||!campo){ resolve(null); return; }

    document.getElementById('senha-titulo').textContent=opcoes.titulo||L('senha.titulo');
    document.getElementById('senha-texto').textContent=opcoes.texto||'';
    campo.value=''; campo2.value=''; erroEl.textContent='';
    campo.setAttribute('aria-invalid','false'); campo2.setAttribute('aria-invalid','false');
    campo.setAttribute('aria-label',L('senha.campo'));
    campo2.setAttribute('aria-label',L('senha.repita'));
    olho.setAttribute('aria-label',L('senha.mostrar'));
    campo.type='password'; campo2.type='password';
    olho.setAttribute('aria-pressed','false');
    linha2.style.display=opcoes.confirmar?'flex':'none';
    campo.setAttribute('autocomplete',opcoes.confirmar?'new-password':'current-password');
    okBtn.textContent=opcoes.okLabel||L('btn.confirmar');
    bd.style.display='block'; dg.style.display='block';
    const restaurar=ativarDialogo(dg,bd,campo,cancelar);

    function fechar(v){
      bd.style.display='none'; dg.style.display='none';
      okBtn.removeEventListener('click',confirmar);
      cancelBtn.removeEventListener('click',cancelar);
      bd.removeEventListener('click',cancelar);
      olho.removeEventListener('click',alternar);
      dg.removeEventListener('keydown',tecla);
      campo.value=''; campo2.value='';   /* não deixa a senha no DOM */
      restaurar();
      resolve(v);
    }
    function alternar(){
      const mostrando=campo.type==='text';
      campo.type=campo2.type=mostrando?'password':'text';
      olho.setAttribute('aria-pressed',mostrando?'false':'true');
      olho.setAttribute('aria-label',L(mostrando?'senha.mostrar':'senha.ocultar'));
    }
    function confirmar(){
      const s=campo.value;
      campo.setAttribute('aria-invalid','false'); campo2.setAttribute('aria-invalid','false');
      if(s.length<8){ erroEl.textContent=L('senha.curta'); campo.setAttribute('aria-invalid','true'); campo.focus(); return; }
      if(opcoes.confirmar&&s!==campo2.value){ erroEl.textContent=L('senha.naoBate'); campo2.setAttribute('aria-invalid','true'); campo2.focus(); return; }
      fechar(s);
    }
    function cancelar(){ fechar(null); }
    function tecla(e){
      if(e.key==='Enter'&&(e.target===campo||e.target===campo2)){ e.preventDefault(); confirmar(); }
    }
    okBtn.addEventListener('click',confirmar);
    cancelBtn.addEventListener('click',cancelar);
    bd.addEventListener('click',cancelar);
    olho.addEventListener('click',alternar);
    dg.addEventListener('keydown',tecla);
  });
}

/* ── a tela de conflito ──
   Devolve 'local' | 'nuvem' | null (decidir depois). Exportar não fecha:
   a pessoa baixa os dois e continua escolhendo. */
function mostrarConflitoSync(daNuvem){
  return new Promise(resolve=>{
    const bd=document.getElementById('conflito-backdrop');
    const dg=document.getElementById('conflito-dialog');
    if(!bd||!dg){ resolve(null); return; }

    const resumo=(rotulo,d)=>{
      const t=(d&&d.transacoes||[]).length;
      const saldo=(d&&d.saldoAtual||0)+(d&&d.dinheiroVivo||0);
      const el=document.createElement('div');
      el.className='conflito-lado';
      const h=document.createElement('h4'); h.textContent=rotulo; el.appendChild(h);
      const dl=document.createElement('dl');
      const linha=(k,v,classe)=>{
        const d1=document.createElement('div');
        d1.textContent=k+': ';
        const s=document.createElement('span');
        if(classe) s.className=classe;
        s.textContent=v; d1.appendChild(s); dl.appendChild(d1);
      };
      linha(L('conflito.saldo'),formatBRL(saldo),'num');
      linha(L('conflito.lancamentos'),String(t));
      el.appendChild(dl);
      return el;
    };

    const lados=document.getElementById('conflito-lados');
    lados.innerHTML='';
    lados.appendChild(resumo(L('conflito.esteAparelho'),data));
    lados.appendChild(resumo(L('conflito.naNuvem'),daNuvem));

    const bExportar=document.getElementById('conflito-exportar');
    const bManter=document.getElementById('conflito-manter');
    const bUsar=document.getElementById('conflito-usar');
    const bDepois=document.getElementById('conflito-depois');

    bd.style.display='block'; dg.style.display='block';
    vibrate([10,40,10]);
    const restaurar=ativarDialogo(dg,bd,bDepois,depois);

    function fechar(v){
      bd.style.display='none'; dg.style.display='none';
      bExportar.removeEventListener('click',exportar);
      bManter.removeEventListener('click',manter);
      bUsar.removeEventListener('click',usar);
      bDepois.removeEventListener('click',depois);
      restaurar();
      resolve(v);
    }
    function baixar(obj,nome){
      try{
        const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));
        const a=document.createElement('a'); a.href=url; a.download=nome;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(e){}
    }
    function exportar(){
      const dia=todayISO();
      baixar(data,'aoii-'+dia+'-este-aparelho.json');
      baixar(daNuvem,'aoii-'+dia+'-nuvem.json');
      setSaveStatus(L('st.doisBackups'));
    }
    function manter(){ fechar('local'); }
    function usar(){ fechar('nuvem'); }
    function depois(){ fechar(null); }

    bExportar.addEventListener('click',exportar);
    bManter.addEventListener('click',manter);
    bUsar.addEventListener('click',usar);
    bDepois.addEventListener('click',depois);
  });
}

/* ── destrancar ──
   Chamada quando há código configurado mas a sessão ainda não tem a senha.
   Devolve true se abriu. */
async function destrancarSincronizacao(codigo){
  codigo=codigo||getSyncCode();
  if(!codigo) return false;
  if(!prepararSincronizacao()) return false;
  try{ return await abrirSyncPelaInterface(codigo); }
  finally{ concluirAberturaSync(); }
}

async function abrirSyncPelaInterface(codigo){
  if(codigo!==getSyncCode()&&espelhoPendente()){
    await alertDialog(L('sync.trocaPendente'));
    return false;
  }
  const anterior=getSyncCode();
  const revisaoLocal=estadoEspelho(codigo).revisao;

  const senha=await pedirSenhaSync({
    titulo:L('senha.destrancarTitulo'),
    texto:L('senha.destrancarTexto').replace('{codigo}',codigo),
  });
  if(!senha) return false;

  sync.status='sincronizando'; renderStatusSync();
  const r=await abrirSincronizacao(codigo,senha);

  if(r.resultado==='senha-errada'){
    await alertDialog(L('senha.erradaTexto'),L('senha.erradaTitulo'));
    sync.status='precisa-senha'; renderStatusSync();
    return false;
  }
  if(r.resultado==='erro'){
    sync.status='erro';
    setSaveStatus(L('st.syncErro'));
    renderStatusSync();
    return false;
  }
  // A pessoa pode editar depois de fechar a senha, enquanto a rede responde.
  if(codigo!==anterior&&espelhoPendente()){
    esquecerSenha();
    await alertDialog(L('sync.trocaPendente'));
    return false;
  }
  const pendente=codigo===anterior&&espelhoPendente();
  setSyncCode(codigo);
  if(r.resultado==='migrar'){ return await conduzirMigracao(r.dados); }
  if(r.resultado==='nova'){
    confirmarRevisaoLocal(0);
    agendarEspelho();
    return true;
  }
  if(pendente){
    // O servidor pode ter mudado durante a ausência. Reusar a revisão local
    // faz a próxima gravação receber conflito, sem substituir o aparelho.
    sync.revisao=revisaoLocal;
    retomarEspelho();
    return true;
  }
  /* aberta: adota o que veio, passando pela validação como qualquer dado externo */
  const adotado=adotarDadosDeFora(r.dados,'nuvem');
  if(!adotado.ok){ setSaveStatus(L('st.syncRecusado')); renderStatusSync(); return false; }
  data=adotado.data;
  await persist({remoto:true}); render();
  confirmarRevisaoLocal(sync.revisao);
  setSaveStatus(L('st.syncDados'));
  renderStatusSync();
  return true;
}

/* ── migração do registro antigo ── */
async function conduzirMigracao(dadosDaNuvem){
  /* A armadilha daqui: o que está na nuvem e o que está neste aparelho podem
     ser diferentes. Cifrar os da nuvem sem adotá-los localmente faz o app
     continuar mostrando os de cá — e o espelho automático, logo depois, grava
     os de cá por cima. O que estava na nuvem some sem ninguém ver.

     Então: se os dois lados diferem, quem escolhe é a pessoa; e o lado
     escolhido vai pra nuvem E pro aparelho. */
  let escolhidos=dadosDaNuvem||data;

  if(dadosDaNuvem&&JSON.stringify(dadosDaNuvem)!==JSON.stringify(data)){
    const escolha=await mostrarConflitoSync(dadosDaNuvem);
    if(escolha===null){ esquecerSenha(); sync.status='migrar'; renderStatusSync(); return false; }
    escolhidos=escolha==='nuvem'?dadosDaNuvem:data;
  }

  const ok=await confirmDialog({
    title:L('migrar.titulo'),
    text:L('migrar.texto'),
    okLabel:L('migrar.okLabel'),
  });
  if(!ok){ esquecerSenha(); sync.status='migrar'; renderStatusSync(); return false; }

  const geracaoAntes=estadoEspelho().geracao;
  const revisaoAntes=sync.revisao;
  sync.status='sincronizando'; renderStatusSync();
  const r=await migrarParaCifrado(escolhidos);
  if(r.resultado!=='enviado'){
    await alertDialog(L('migrar.falhou').replace('{motivo}',r.motivo||r.resultado));
    renderStatusSync();
    return false;
  }

  if(estadoEspelho().geracao!==geracaoAntes){
    // Uma edição feita durante a migração precisa de nova decisão, pois a
    // cópia cifrada pode ter sido a da nuvem, escolhida antes dessa edição.
    sync.revisao=revisaoAntes;
    confirmarRevisaoLocal(revisaoAntes);
    renderStatusSync();
    return true;
  }

  /* o lado escolhido também passa a valer aqui — senão o espelho automático
     desfaz a migração no primeiro salvamento */
  if(escolhidos!==data){
    const adotado=adotarDadosDeFora(escolhidos,'nuvem');
    if(adotado.ok){ data=adotado.data; await persist({remoto:true}); render(); }
  }

  estadoEspelho().pendente=false;
  confirmarRevisaoLocal(sync.revisao);

  setSaveStatus(L('st.migrada'));
  renderStatusSync();
  return true;
}

/* ── empurrar ──
   Chamada depois de salvar. Silenciosa quando dá certo; só fala quando algo
   precisa da pessoa. */
async function empurrarParaNuvem(){
  if(!getSyncCode()||!sincronizacaoDestrancada()){
    sync.status='precisa-senha'; renderStatusSync(); return {resultado:'precisa-senha'};
  }

  const r=await enviarParaNuvem(data);
  if(r.resultado==='enviado') return r;

  if(r.resultado==='conflito'){
    let remoto=null,lido=null;
    try{
      lido=await nuvemLer(getSyncCode());
      if(lido&&ehEnvelopeCifrado(lido.envelope)) remoto=await decifrarDaNuvem(lido.envelope,sync.senha);
    }catch(e){ sync.status='erro'; }
    if(!remoto){ setSaveStatus(L('st.syncErro')); renderStatusSync(); return {resultado:'erro'}; }

    const escolha=await mostrarConflitoSync(remoto);
    if(escolha==='nuvem'){
      const adotado=adotarDadosDeFora(remoto,'nuvem');
      if(adotado.ok){
        data=adotado.data;
        sync.revisao=lido.revision;
        sync.status='sincronizada';
        await persist({remoto:true}); render();
        setSaveStatus(L('st.syncDados'));
        return {resultado:'adotado'};
      }
      return {resultado:'erro'};
    }else if(escolha==='local'){
      // Só autoriza substituir a revisão que a pessoa realmente viu.
      sync.revisao=lido.revision;
      const segundaTentativa=await enviarParaNuvem(data);
      setSaveStatus(segundaTentativa.resultado==='enviado'?L('st.syncDados'):L('st.syncErro'));
      return segundaTentativa;
    }
    renderStatusSync();
    return {resultado:'adiado'};
  }

  if(r.resultado==='sem-conexao'){ setSaveStatus(L('st.semConexao')); renderStatusSync(); return r; }
  setSaveStatus(L('st.syncErro'));
  renderStatusSync();
  return r;
}

/* ── puxar ── */
async function puxarDaNuvem(){
  if(!sincronizacaoDestrancada()||_espelhando||_recebendoNuvem||_abrindoSync||espelhoPendente()) return;
  _recebendoNuvem=true;
  const revisaoAntes=sync.revisao;
  try{
  const r=await receberDaNuvem();
  if(espelhoPendente()){
    // Houve edição enquanto a leitura estava em voo: não adota nem avança.
    sync.revisao=revisaoAntes;
    return;
  }
  if(r.resultado==='novidade'){
    const adotado=adotarDadosDeFora(r.dados,'nuvem');
    if(!adotado.ok){ sync.revisao=revisaoAntes; sync.status='erro'; setSaveStatus(L('st.syncRecusado')); renderStatusSync(); return; }
    data=adotado.data;
    await persist({remoto:true});
    confirmarRevisaoLocal(sync.revisao);
    render();
    setSaveStatus(L('st.outroAparelho'));
  }
  }catch(e){ sync.status='erro'; setSaveStatus(L('st.syncErro')); }
  finally{ _recebendoNuvem=false; retomarEspelho(); renderStatusSync(); }
}
