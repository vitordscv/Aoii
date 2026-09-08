/* Modal compartilhado: bloqueia o fundo, prende o foco e restaura o acionador.
   A pilha permite abrir uma confirmação por cima de Configurações. */
const dialogosAtivos=[];
function ativarDialogo(dg,bd,inicial,aoCancelar){
  const anterior=document.activeElement;
  const alterados=[];
  const registro={dg};
  dg.setAttribute('aria-modal','true');
  dg.setAttribute('tabindex','-1');
  // Percorre os ancestrais para funcionar também com diálogos aninhados.
  for(let atual=dg;atual&&atual!==document.body;atual=atual.parentElement){
    for(const irmao of atual.parentElement.children){
      if(irmao===atual||irmao===bd||irmao.contains(bd)) continue;
      alterados.push([irmao,irmao.inert]);
      irmao.inert=true;
    }
  }
  dialogosAtivos.push(registro);
  const noTopo=()=>dialogosAtivos[dialogosAtivos.length-1]===registro;
  function focaveis(){
    return Array.from(dg.querySelectorAll('button,input,select,textarea,a[href],[tabindex]'))
      .filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[inert]')&&el.getClientRects().length);
  }
  function focar(){
    const alvo=inicial&&inicial.getClientRects().length?inicial:focaveis()[0]||dg;
    alvo.focus();
  }
  function teclado(e){
    if(!noTopo()) return;
    if(e.key==='Escape'){
      e.preventDefault(); e.stopImmediatePropagation(); aoCancelar();
    }else if(e.key==='Tab'){
      const lista=focaveis(),primeiro=lista[0]||dg,ultimo=lista[lista.length-1]||dg;
      if(e.shiftKey&&(document.activeElement===primeiro||!dg.contains(document.activeElement))){
        e.preventDefault(); ultimo.focus();
      }else if(!e.shiftKey&&(document.activeElement===ultimo||!dg.contains(document.activeElement))){
        e.preventDefault(); primeiro.focus();
      }
    }
  }
  function foco(e){ if(noTopo()&&!dg.contains(e.target)) focar(); }
  document.addEventListener('keydown',teclado,true);
  document.addEventListener('focusin',foco,true);
  focar();
  let fechado=false;
  return ()=>{
    if(fechado) return;
    fechado=true;
    document.removeEventListener('keydown',teclado,true);
    document.removeEventListener('focusin',foco,true);
    dialogosAtivos.splice(dialogosAtivos.indexOf(registro),1);
    alterados.reverse().forEach(([el,inert])=>{ el.inert=inert; });
    if(anterior&&anterior.isConnected&&!anterior.closest('[inert]')) anterior.focus();
  };
}
