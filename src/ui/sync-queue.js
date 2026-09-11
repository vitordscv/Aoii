/* A fila persiste só revisão e pendência; dados financeiros ficam no store.
   Nunca limpa a pendência antes da confirmação do envio. Uma geração salva
   durante a rede exige outra rodada, mesmo quando o primeiro timer já passou. */
const CHAVE_ESTADO_SYNC='financas-sync-estado:';
/* Pequena janela para agrupar dois cliques seguidos sem deixar a nuvem
   perceptivelmente atrasada. Se outra edição ocorrer durante a rede, a fila
   continua usando a geração mais recente. */
const ESPERA_ESPELHO=400;
let _espelhoAgendado=null;
let _espelhando=false;
let _recebendoNuvem=false;
let _abrindoSync=false;
/* Por que o espelho parou — antes era um booleano, e por isso não havia como
   saber se valia a pena voltar a tentar. Qualquer desfecho que não fosse
   "enviado" ou "sem conexão" parava a fila PARA SEMPRE: só uma visita às
   Configurações, que chama prepararSincronizacao(), destravava. Enquanto isso
   a barra do hero dizia "envio pendente", que promete que vai acontecer.

     'conflito' — a pessoa escolheu decidir depois. Só ela destrava, e está
                  certo: retomar sozinho reabriria o diálogo que ela fechou.
     'senha'    — a sessão está trancada. Destrava sozinho quando abrir.
     'erro'     — o servidor recusou. Retenta algumas vezes antes de desistir;
                  5xx e rede instável costumam passar sozinhos.             */
let _pausaEspelho=null;
let _falhasEspelho=0;
const MAX_TENTATIVAS_ERRO=5;
const _estadosEspelho=new Map();

function estadoEspelho(codigo){
  codigo=codigo||getSyncCode();
  const chave=CHAVE_ESTADO_SYNC+sufixoDeHomologacao()+':'+codigo;
  if(!_estadosEspelho.has(chave)){
    let estado=null;
    try{ estado=JSON.parse(localStorage.getItem(chave)); }catch(e){ /* sem estado anterior */ }
    if(!estado||!Number.isInteger(estado.geracao)||!Number.isInteger(estado.revisao)){
      estado={geracao:0,revisao:-1,pendente:false};
    }
    _estadosEspelho.set(chave,estado);
  }
  return _estadosEspelho.get(chave);
}

function guardarEstadoEspelho(codigo){
  try{
    localStorage.setItem(CHAVE_ESTADO_SYNC+sufixoDeHomologacao()+':'+codigo,
      JSON.stringify(estadoEspelho(codigo)));
  }catch(e){ setSaveStatus(L('st.erroAoSalvar')); }
}

function espelhoPendente(){ return !!getSyncCode()&&estadoEspelho().pendente; }

function confirmarRevisaoLocal(revisao){
  const estado=estadoEspelho();
  estado.revisao=revisao;
  guardarEstadoEspelho(getSyncCode());
}

function agendarEspelho(){
  const codigo=getSyncCode();
  if(!codigo) return;
  const estado=estadoEspelho(codigo);
  estado.geracao++;
  estado.pendente=true;
  guardarEstadoEspelho(codigo);
  renderStatusSync();
  retomarEspelho();
}

/* O que está IMPEDINDO o envio, se algo estiver — a chave de tradução, pra
   quem desenha decidir onde mostrar. Existe porque a barra do hero dizia
   "envio pendente" nos quatro casos, e três deles não saem do lugar sozinhos:
   sem a senha, nada será enviado por mais que se espere. */
function impedimentoDoEspelho(){
  if(!espelhoPendente()) return null;
  /* os dois: a sessão pode ter trancado agora, ou a fila já ter parado por
     isso numa rodada anterior — quem lê a barra quer o mesmo aviso nos dois */
  if(!sincronizacaoDestrancada()||_pausaEspelho==='senha') return 'sync.trancada';
  if(_pausaEspelho==='conflito') return 'sync.conflito';
  if(_pausaEspelho==='erro') return 'sync.falhou';
  if(sync.status==='sem-conexao') return 'sync.semConexao';
  return null;
}

function retomarEspelho(){
  if(_espelhoAgendado) clearTimeout(_espelhoAgendado);
  _espelhoAgendado=null;
  /* a sessão destrancou depois de a fila ter parado por falta de senha: não há
     mais o que esperar, e ninguém precisa passar pelas Configurações pra isso */
  if(_pausaEspelho==='senha'&&sincronizacaoDestrancada()){ _pausaEspelho=null; _falhasEspelho=0; }
  if(!espelhoPendente()||_espelhando||_recebendoNuvem||_abrindoSync||_pausaEspelho) return;
  if(!sincronizacaoDestrancada()) { _pausaEspelho='senha'; renderStatusSync(); return; }
  _espelhoAgendado=setTimeout(rodarEspelho,ESPERA_ESPELHO);
}

async function rodarEspelho(){
  if(_espelhoAgendado) clearTimeout(_espelhoAgendado);
  _espelhoAgendado=null;
  if(_espelhando||_recebendoNuvem||_abrindoSync||_pausaEspelho||!espelhoPendente()) return;
  if(!sincronizacaoDestrancada()) { _pausaEspelho='senha'; renderStatusSync(); return; }
  _espelhando=true;
  const codigo=getSyncCode();
  const estado=estadoEspelho(codigo);
  const geracao=estado.geracao;
  sync.status='sincronizando';
  renderStatusSync();
  let repetir=false;
  try{
    const r=await empurrarParaNuvem();
    if(r.resultado==='enviado'||r.resultado==='adotado'){
      estado.revisao=sync.revisao;
      estado.pendente=estado.geracao!==geracao;
      _falhasEspelho=0;
      repetir=estado.pendente;
    }else if(r.resultado==='sem-conexao'){
      _falhasEspelho++;
      repetir=true;
    }else if(r.resultado==='precisa-senha'){
      /* volta sozinho assim que a sessão abrir — ver retomarEspelho() */
      _pausaEspelho='senha';
    }else if(r.resultado==='erro'){
      /* Erro de servidor costuma passar sozinho: 5xx, rede que caiu no meio
         da gravação, uma recusa momentânea. Parar na primeira e só voltar se
         alguém abrisse as Configurações deixava a fila morta em silêncio, com
         a barra dizendo "envio pendente" por tempo indeterminado. */
      _falhasEspelho++;
      if(_falhasEspelho>=MAX_TENTATIVAS_ERRO) _pausaEspelho='erro';
      else repetir=true;
    }else{
      /* 'adiado': a pessoa escolheu decidir depois no diálogo de conflito.
         Esta é a única pausa que deve mesmo esperar por ela — retomar sozinho
         reabriria a janela que ela acabou de fechar. */
      _pausaEspelho='conflito';
    }
  }catch(e){
    sync.status='erro';
    _falhasEspelho++;
    if(_falhasEspelho>=MAX_TENTATIVAS_ERRO) _pausaEspelho='erro';
    else repetir=true;
    setSaveStatus(L('st.syncErro'));
  }finally{
    guardarEstadoEspelho(codigo);
    _espelhando=false;
    renderStatusSync();
    if(repetir&&sincronizacaoDestrancada()){
      const espera=_falhasEspelho?Math.min(60000,3000*2**Math.min(_falhasEspelho,5)):ESPERA_ESPELHO;
      _espelhoAgendado=setTimeout(rodarEspelho,espera);
    }
  }
}

function prepararSincronizacao(){
  if(_espelhando||_recebendoNuvem||_abrindoSync) return false;
  _abrindoSync=true;
  /* abrir a sincronização é a ação explícita que destrava qualquer pausa,
     inclusive a do conflito adiado: quem chegou aqui está decidindo de novo */
  _pausaEspelho=null;
  _falhasEspelho=0;
  if(_espelhoAgendado) clearTimeout(_espelhoAgendado);
  _espelhoAgendado=null;
  return true;
}

function concluirAberturaSync(){
  _abrindoSync=false;
  retomarEspelho();
  renderStatusSync();
}

avisarQuandoSalvar(agendarEspelho);
/* Voltar pra rede limpa a pausa por erro — o que derrubou o envio quase sempre
   foi a própria queda. Não limpa a de conflito: aquela é decisão de gente. */
window.addEventListener('online',()=>{
  _falhasEspelho=0;
  if(_pausaEspelho==='erro') _pausaEspelho=null;
  retomarEspelho();
});
