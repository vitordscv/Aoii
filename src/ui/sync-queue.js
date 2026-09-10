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
let _espelhoPausado=false;
let _falhasEspelho=0;
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
  if(_espelhoPausado) return;
  retomarEspelho();
}

function retomarEspelho(){
  if(_espelhoAgendado) clearTimeout(_espelhoAgendado);
  _espelhoAgendado=null;
  if(!espelhoPendente()||_espelhando||_recebendoNuvem||_abrindoSync||_espelhoPausado) return;
  if(!sincronizacaoDestrancada()) { renderStatusSync(); return; }
  _espelhoAgendado=setTimeout(rodarEspelho,ESPERA_ESPELHO);
}

async function rodarEspelho(){
  if(_espelhoAgendado) clearTimeout(_espelhoAgendado);
  _espelhoAgendado=null;
  if(_espelhando||_recebendoNuvem||_abrindoSync||_espelhoPausado||!espelhoPendente()) return;
  if(!sincronizacaoDestrancada()) { renderStatusSync(); return; }
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
    }else{
      // Conflito adiado, senha ou erro permanente aguardam ação explícita.
      _espelhoPausado=true;
    }
  }catch(e){
    sync.status='erro';
    _espelhoPausado=true;
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
  _espelhoPausado=false;
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
window.addEventListener('online',()=>{ _falhasEspelho=0; retomarEspelho(); });
