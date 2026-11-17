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

const IA_LEMBRAR='financas-ia-lembrar';

/* Dois serviços, uma chave para cada. A do Gemini continua no nome antigo:
   quem já usava não precisa colar de novo. A escolha do serviço é deste
   aparelho, como a chave — não vai para o backup nem para a nuvem. */
const IA_PROVEDORES=['gemini','nvidia'];
const IA_PROVEDOR='financas-ia-provedor';
const IA_CHAVES={gemini:'financas-ia-chave',nvidia:'financas-ia-chave-nvidia'};
function iaProvedor(){
  const p=lerGuardado(localStorage,IA_PROVEDOR);
  return IA_PROVEDORES.includes(p)?p:'gemini';
}
function definirIaProvedor(p){
  if(!IA_PROVEDORES.includes(p)) return false;
  gravarGuardado(localStorage,IA_PROVEDOR,p);
  return true;
}
/* o nome do lugar onde mora a chave do serviço escolhido agora */
function nomeIaChave(){ return IA_CHAVES[iaProvedor()]; }

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
  return Object.values(IA_CHAVES).some(n=>!!lerGuardado(localStorage,n));
}

function getIaChave(){
  const nome=nomeIaChave();
  return lerGuardado(sessionStorage,nome)||lerGuardado(localStorage,nome);
}

function setIaChave(v){
  const chave=String(v||'').trim();
  const nome=nomeIaChave();
  if(!chave){ apagarGuardado(sessionStorage,nome); apagarGuardado(localStorage,nome); return; }
  gravarGuardado(sessionStorage,nome,chave);
  if(lembrarIaChave()) gravarGuardado(localStorage,nome,chave);
  else apagarGuardado(localStorage,nome);
}

/* Ligar o "lembrar" desce pro disco o que já está na sessão; desligar sobe o
   caminho contrário — a chave continua valendo agora e some quando a aba
   fechar. Em nenhum dos dois a pessoa precisa colar de novo. */
function definirLembrarIaChave(lembrar){
  gravarGuardado(localStorage,IA_LEMBRAR,lembrar?'1':'0');
  for(const nome of Object.values(IA_CHAVES)){
    const chave=lerGuardado(sessionStorage,nome)||lerGuardado(localStorage,nome);
    if(lembrar){ if(chave) gravarGuardado(localStorage,nome,chave); }
    else{
      apagarGuardado(localStorage,nome);
      if(chave) gravarGuardado(sessionStorage,nome,chave);
    }
  }
}

/* Desligar a IA apaga as chaves dos dois serviços, dos dois lugares. Deixá-la para trás guardaria
   uma credencial de um recurso que a pessoa acabou de dispensar. */
function esquecerIaChave(){
  for(const nome of Object.values(IA_CHAVES)){
    apagarGuardado(sessionStorage,nome);
    apagarGuardado(localStorage,nome);
  }
}

function iaAtiva(){ return data.iaAtiva===true && !!getIaChave(); }
