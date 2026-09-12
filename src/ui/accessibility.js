/* Modal compartilhado: bloqueia o fundo, prende o foco e restaura o acionador.
   A pilha permite abrir uma confirmação por cima de Configurações. */
const dialogosAtivos=[];
function ativarDialogo(dg,bd,inicial,aoCancelar){
  const anterior=document.activeElement;
  const alterados=[];
  const registro={dg};
  /* Um diálogo aberto por cima de outro era irmão inerte do primeiro. Ele e o
     próprio backdrop precisam ser liberados enquanto estiverem no topo. */
  alterados.push([dg,dg.inert],[bd,bd.inert]);
  dg.inert=false; bd.inert=false;
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
    // No iOS, focar um campo logo após abrir o sheet pode rolar o documento
    // inteiro antes de o teclado terminar de redimensionar a viewport.
    try{ alvo.focus({preventScroll:true}); }catch(e){ alvo.focus(); }
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
  /* A roda do mouse nao passa por `touch-action`, que so governa gesto de
     dedo. Com a folha aberta, rolar o trackpad sobre o pano de fundo levava a
     pagina de tras junto — 1112px de deslocamento medidos, e ao fechar a folha
     a pessoa estava em outro lugar da tela. Fora do dialogo que esta no topo,
     rolagem nao vale. Dentro dele, `overscroll-behavior:contain` ja impede o
     encadeamento ao chegar no fim. */
  function roda(e){ if(noTopo()&&!dg.contains(e.target)) e.preventDefault(); }
  document.addEventListener('keydown',teclado,true);
  document.addEventListener('focusin',foco,true);
  document.addEventListener('wheel',roda,{passive:false,capture:true});
  focar();
  let fechado=false;
  return ()=>{
    if(fechado) return;
    fechado=true;
    document.removeEventListener('keydown',teclado,true);
    document.removeEventListener('focusin',foco,true);
    document.removeEventListener('wheel',roda,{capture:true});
    dialogosAtivos.splice(dialogosAtivos.indexOf(registro),1);
    alterados.reverse().forEach(([el,inert])=>{ el.inert=inert; });
    if(anterior&&anterior.isConnected&&!anterior.closest('[inert]')) anterior.focus();
  };
}

/* Painéis inferiores também são modais para teclado e leitor de tela. */
const restauradoresSheet=new WeakMap();
function ativarSheet(sheet,backdrop,inicial,aoCancelar){
  desativarSheet(sheet);
  restauradoresSheet.set(sheet,ativarDialogo(sheet,backdrop,inicial,aoCancelar));
}
function desativarSheet(sheet){
  const restaurar=restauradoresSheet.get(sheet);
  if(!restaurar) return;
  restauradoresSheet.delete(sheet);
  restaurar();
}

/* Linhas visualmente clicáveis precisam oferecer a mesma ação ao teclado. */
function ativarComoBotao(el,acao,rotulo){
  el.setAttribute('role','button'); el.setAttribute('tabindex','0');
  if(rotulo) el.setAttribute('aria-label',rotulo);
  el.addEventListener('click',acao);
  el.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ') return;
    e.preventDefault(); acao(e);
  });
}
