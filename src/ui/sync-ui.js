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
     sugestão: sem confirmar, nenhuma cópia local é cifrada ou enviada.
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

function ligarBotaoEsquecerSenha(){
  const btn=document.getElementById('senha-esquecer-btn');
  if(!btn) return;
  btn.addEventListener('click',async()=>{
    if(!(await confirmDialog({
      title:L('senha.esquecerTitulo'),
      text:L('senha.esquecerTexto'),
      okLabel:L('senha.esquecerOk'),
    }))) return;
    esquecerSenha();
    renderStatusSync();
  });
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
  /* A barra do hero recebe a versão curta. A longa — "Salvo neste aparelho ·
     envio pendente" — repete o que o persist() acabou de escrever ali mesmo,
     duas atualizações antes. Ela continua inteira acima, em #sync-status-text,
     dentro das Configurações, onde há espaço e onde ela explica alguma coisa.

     E quando há algo IMPEDINDO o envio, é o impedimento que aparece. Dizer
     "envio pendente" com a sessão trancada é prometer uma coisa que não vai
     acontecer: nada será enviado por mais que se espere, e quem lia ficava
     olhando a mesma frase sem entender por que ela não mudava. */
  if(pendente) setSaveStatus(L(impedimentoDoEspelho()||'sync.pendenteCurto'));
  else if(sync.status==='sincronizada') setSaveStatus(L('sync.emDia'));
  renderSenhaLembrada();
}

/* Preferências visuais não são uma divergência financeira. Elas ficam no
   mesmo envelope para viajarem entre aparelhos, mas não devem abrir um
   conflito quando o saldo e os lançamentos continuam iguais. */
function conteudoFinanceiroParaConflito(valor){
  const copia=JSON.parse(JSON.stringify(valor||{}));
  ['tema','customTheme','fundoIlustrado','temaAutoNoite'].forEach(chave=>delete copia[chave]);
  return JSON.stringify(copia);
}

/* A senha derivada fica num cofre do navegador; esta linha conta se ela está
   lá e se o navegador prometeu não descartá-la. São duas coisas diferentes:
   guardada é o que o app faz; durável é o que o navegador concede. Dizer só a
   primeira faria a pessoa achar que está resolvido quando não está. */
async function renderSenhaLembrada(){
  const bloco=document.getElementById('senha-lembrada');
  if(!bloco) return;
  const lembrada=getSyncCode()?await senhaLembradaAqui():false;
  bloco.hidden=!lembrada;
  if(!lembrada) return;
  const duravel=await armazenamentoEhDuravel();
  document.getElementById('senha-lembrada-titulo').textContent=L('senha.lembradaTitulo');
  document.getElementById('senha-lembrada-sub').textContent=
    L(duravel?'senha.lembradaDuravel':'senha.lembradaFragil');
}

async function exigirBackupAntesDeCifrar(){
  const confirmado=await confirmDialog({
    title:L('sync.backupTitulo'),
    text:L('sync.backupTexto'),
    okLabel:L('sync.backupOk'),
  });
  if(!confirmado) document.getElementById('download-json-btn')?.click();
  return confirmado;
}

/* Quem já dispensou o pedido de senha deste código não é perguntado de novo
   na abertura seguinte. A sincronização fica trancada, o status diz isso, e
   destrancar vira escolha — o botão "Usar este código" nas Configurações
   continua ali. Um diálogo que volta sozinho depois de dispensado ensina a
   fechar sem ler. */
function chaveSenhaDispensada(){ return 'financas-senha-dispensada'; }
function senhaFoiDispensada(codigo){
  try{ return localStorage.getItem(chaveSenhaDispensada())===codigo; }catch(e){ return false; }
}
function marcarSenhaDispensada(codigo){
  try{ localStorage.setItem(chaveSenhaDispensada(),codigo||''); }catch(e){}
}
function limparSenhaDispensada(){
  try{ localStorage.removeItem(chaveSenhaDispensada()); }catch(e){}
}

/* ── destrancar ──
   Chamada quando há código configurado mas a sessão ainda não tem a chave.
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
  const sessaoAnterior={...sync};
  const revisaoLocal=estadoEspelho(codigo).revisao;
  const restaurarAnterior=()=>{
    Object.assign(sync,sessaoAnterior);
    setSyncCode(anterior);
    renderStatusSync();
  };

  const consulta=await consultarSincronizacao(codigo);
  if(consulta.resultado==='erro'){
    sync.status='erro';
    setSaveStatus(L('st.syncErro'));
    renderStatusSync();
    return false;
  }
  const criando=consulta.resultado==='nova'||consulta.resultado==='migrar';
  if(criando&&!await exigirBackupAntesDeCifrar()){ marcarSenhaDispensada(codigo); return false; }
  const senha=await pedirSenhaSync(criando?{
    titulo:consulta.resultado==='migrar'?L('senha.migrarTitulo'):L('senha.novaTitulo'),
    texto:consulta.resultado==='migrar'?L('senha.migrarTexto'):L('senha.novaTexto'),
    confirmar:true,
    okLabel:consulta.resultado==='migrar'?L('senha.migrarOk'):L('senha.criarOk'),
  }:{
    titulo:L('senha.destrancarTitulo'),
    texto:L('senha.destrancarTexto').replace('{codigo}',codigo),
  });
  if(!senha){ marcarSenhaDispensada(codigo); return false; }
  limparSenhaDispensada();

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
  if(r.resultado==='migrar'){
    const concluiu=await conduzirMigracao(r.dados);
    if(!concluiu) restaurarAnterior();
    return concluiu;
  }
  if(r.resultado==='nova'){
    confirmarRevisaoLocal(0);
    /* Grava agora, não daqui a 1,5 s: com espelho adiado, fechar o app antes
       do prazo deixava a senha criada no aparelho e NENHUMA linha na nuvem —
       e a próxima abertura pedia pra criar a senha de novo. */
    const primeira=await enviarParaNuvem(data);
    if(primeira.resultado!=='enviado'){
      setSaveStatus(L(primeira.resultado==='sem-conexao'?'st.semConexao':'st.syncErro'));
      renderStatusSync();
      /* a sessão continua aberta: a próxima gravação tenta de novo */
      agendarEspelho();
      return true;
    }
    setSaveStatus(L('st.syncAtivada'));
    renderStatusSync();
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
      if(lido&&ehEnvelopeCifrado(lido.envelope)) remoto=await decifrarDaNuvem(lido.envelope,sync.chave);
    }catch(e){ sync.status='erro'; }
    if(!remoto){ setSaveStatus(L('st.syncErro')); renderStatusSync(); return {resultado:'erro'}; }

    /* Revisão divergente não é conteúdo divergente. Antes de tomar o tempo da
       pessoa, vê se existe mesmo uma escolha a fazer. */
    const remotoTexto=JSON.stringify(remoto);

    if(remotoTexto===JSON.stringify(data)){
      /* os dois lados são o mesmo texto: escolher entre eles não muda nada.
         Acontece quando dois aparelhos aplicam o mesmo automático no mesmo
         dia e chegam ao mesmo conteúdo por caminhos diferentes. */
      sync.revisao=lido.revision;
      sync.ultimoConhecido=remotoTexto;
      sync.status='sincronizada';
      renderStatusSync();
      return {resultado:'enviado',revisao:lido.revision};
    }

    if(conteudoFinanceiroParaConflito(remoto)===conteudoFinanceiroParaConflito(data)){
      /* Só a aparência mudou de um lado para o outro. Mantém a escolha feita
         neste aparelho e atualiza a revisão antes de reenviar, sem diálogo. */
      sync.revisao=lido.revision;
      const reenvio=await enviarParaNuvem(data);
      if(reenvio.resultado==='enviado'){ setSaveStatus(L('st.syncDados')); renderStatusSync(); }
      return reenvio;
    }

    if(sync.ultimoConhecido&&remotoTexto===sync.ultimoConhecido){
      /* a nuvem está como este aparelho a deixou: ninguém mexeu lá, só o nosso
         contador ficou atrasado. Não há nada a perder ao mandar por cima. */
      sync.revisao=lido.revision;
      const reenvio=await enviarParaNuvem(data);
      if(reenvio.resultado==='enviado'){ setSaveStatus(L('st.syncDados')); renderStatusSync(); }
      return reenvio;
    }

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
