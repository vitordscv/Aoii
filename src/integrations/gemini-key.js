/* ── Onde a chave do Gemini fica ──────────────────────────────────────────

   Ela ficava em `localStorage`, sempre, sem a pessoa escolher — e em texto
   puro, num campo `type="text"` que a mostrava por inteiro na tela. Guardada
   assim, fica legível para qualquer extensão do navegador e para quem pegar o
   aparelho destrancado, e continua lá anos depois de a pessoa ter parado de
   usar a IA.

   Agora o padrão é a sessão: a chave vale enquanto a aba estiver aberta e some
   ao fechar. Quem não quer colar de novo a cada vez marca "lembrar", e aí sim
   ela desce para o `localStorage` — com o que isso custa dito ao lado do
   interruptor, antes da escolha.

   Em nenhum dos dois casos ela entra em backup ou em sincronização. */

const IA_CHAVE='financas-ia-chave';
const IA_LEMBRAR='financas-ia-lembrar';

function lerGuardado(onde,nome){ try{ return onde.getItem(nome)||''; }catch(e){ return ''; } }
function gravarGuardado(onde,nome,valor){ try{ onde.setItem(nome,valor); }catch(e){} }
function apagarGuardado(onde,nome){ try{ onde.removeItem(nome); }catch(e){} }

/* Quem já usava tinha a chave no localStorage sem ter marcado nada — era o
   único jeito que existia. Tirá-la debaixo dessa pessoa numa atualização seria
   quebrar o recurso sem aviso, então a presença antiga vale como escolha. */
function lembrarIaChave(){
  const marcado=lerGuardado(localStorage,IA_LEMBRAR);
  if(marcado==='1') return true;
  if(marcado==='0') return false;
  return !!lerGuardado(localStorage,IA_CHAVE);
}

function getIaChave(){
  return lerGuardado(sessionStorage,IA_CHAVE)||lerGuardado(localStorage,IA_CHAVE);
}

function setIaChave(v){
  const chave=String(v||'').trim();
  if(!chave){ esquecerIaChave(); return; }
  gravarGuardado(sessionStorage,IA_CHAVE,chave);
  if(lembrarIaChave()) gravarGuardado(localStorage,IA_CHAVE,chave);
  else apagarGuardado(localStorage,IA_CHAVE);
}

/* Ligar o "lembrar" desce pro disco o que já está na sessão; desligar sobe o
   caminho contrário — a chave continua valendo agora e some quando a aba
   fechar. Em nenhum dos dois a pessoa precisa colar de novo. */
function definirLembrarIaChave(lembrar){
  gravarGuardado(localStorage,IA_LEMBRAR,lembrar?'1':'0');
  const chave=getIaChave();
  if(lembrar){ if(chave) gravarGuardado(localStorage,IA_CHAVE,chave); }
  else{
    apagarGuardado(localStorage,IA_CHAVE);
    if(chave) gravarGuardado(sessionStorage,IA_CHAVE,chave);
  }
}

/* Desligar a IA apaga a chave dos dois lugares. Deixá-la para trás guardaria
   uma credencial de um recurso que a pessoa acabou de dispensar. */
function esquecerIaChave(){
  apagarGuardado(sessionStorage,IA_CHAVE);
  apagarGuardado(localStorage,IA_CHAVE);
}

function iaAtiva(){ return data.iaAtiva===true && !!getIaChave(); }
