/* ── Onde a chave do Pierre fica ───────────────────────────────────────────

   Mesma mecânica da chave do Gemini — sessão por padrão, disco só se a pessoa
   pedir — e aqui ela importa mais. A documentação do Pierre é direta: a chave
   dá **acesso completo aos dados financeiros**, e manda guardá-la em variável
   de ambiente, não no cliente. A do Gemini, vazando, custa dinheiro; esta abre
   o extrato bancário de quem a criou.

   Como o Aoii não tem servidor por usuário, a chave vive no aparelho. O que dá
   pra fazer é não deixá-la no disco sem alguém ter escolhido, não mostrá-la na
   tela, e apagá-la quando a integração é desligada.

   Ela não entra em backup nem em sincronização — como a do Gemini, mora fora
   do objeto `data`. */

const PIERRE_CHAVE = 'financas-pierre-chave';
const PIERRE_LEMBRAR = 'financas-pierre-lembrar';

function lembrarPierreChave(){
  const marcado=lerGuardado(localStorage,PIERRE_LEMBRAR);
  if(marcado==='1') return true;
  if(marcado==='0') return false;
  /* quem já tinha a chave no disco antes desta escolha existir continua com
     ela: tirá-la numa atualização quebraria o recurso sem aviso */
  return !!lerGuardado(localStorage,PIERRE_CHAVE);
}

function getPierreChave(){
  return lerGuardado(sessionStorage,PIERRE_CHAVE)||lerGuardado(localStorage,PIERRE_CHAVE);
}

function setPierreChave(v){
  const chave=String(v||'').trim();
  if(!chave){ esquecerPierreChave(); return; }
  gravarGuardado(sessionStorage,PIERRE_CHAVE,chave);
  if(lembrarPierreChave()) gravarGuardado(localStorage,PIERRE_CHAVE,chave);
  else apagarGuardado(localStorage,PIERRE_CHAVE);
}

function definirLembrarPierreChave(lembrar){
  gravarGuardado(localStorage,PIERRE_LEMBRAR,lembrar?'1':'0');
  const chave=getPierreChave();
  if(lembrar){ if(chave) gravarGuardado(localStorage,PIERRE_CHAVE,chave); }
  else{
    apagarGuardado(localStorage,PIERRE_CHAVE);
    if(chave) gravarGuardado(sessionStorage,PIERRE_CHAVE,chave);
  }
}

function esquecerPierreChave(){
  apagarGuardado(sessionStorage,PIERRE_CHAVE);
  apagarGuardado(localStorage,PIERRE_CHAVE);
}

/* O formato que o Pierre emite. Conferir aqui evita uma ida à rede só pra
   descobrir que faltou colar metade. */
function chavePierreParece(v){ return /^sk-\S{8,}$/.test(String(v||'').trim()); }

function pierreAtivo(){ return data.pierreAtivo===true && !!getPierreChave(); }
