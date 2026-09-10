/* ── abas das Configurações ──
   Seis assuntos, um painel por vez. A escolha fica no topo, sempre à vista.

   É uma tablist de verdade e não seis botões que trocam de cor, porque a
   diferença aparece pra quem não usa o mouse: com role/aria-selected, o leitor
   de tela anuncia "aba 3 de 6, selecionada", e o foco anda com ← e → em vez de
   exigir seis Tabs pra chegar na última. A regra é essa: só a aba ativa fica
   no caminho do Tab (tabindex 0); as outras respondem às setas. */

const SETTINGS_ABAS = ['renda', 'dados', 'preferencias', 'personalizacao', 'ia', 'zona'];
const SETTINGS_ABA_SUB = {
  renda: 'settings.rendaSub',
  dados: 'settings.dadosSub',
  preferencias: 'settings.preferenciasSub',
  personalizacao: 'settings.personalizacaoSub',
  ia: 'settings.iaSub',
  zona: 'settings.zonaSub',
};
const SETTINGS_ABA_CHAVE = 'financas-settings-tab';

function abaSalva(){
  try{ const v=localStorage.getItem(SETTINGS_ABA_CHAVE); return SETTINGS_ABAS.includes(v)?v:null; }
  catch(e){ return null; }
}

function mostrarAbaConfig(id,mover){
  if(!SETTINGS_ABAS.includes(id)) id=SETTINGS_ABAS[0];
  SETTINGS_ABAS.forEach(x=>{
    const aba=document.getElementById('settings-tab-'+x);
    const painel=document.getElementById('settings-pane-'+x);
    if(!aba||!painel) return;
    const ativa=x===id;
    aba.setAttribute('aria-selected',ativa?'true':'false');
    aba.setAttribute('tabindex',ativa?'0':'-1');
    aba.classList.toggle('ativa',ativa);
    painel.hidden=!ativa;
  });
  const sub=document.getElementById('settings-tab-sub');
  if(sub) sub.textContent=L(SETTINGS_ABA_SUB[id]||'');
  /* o painel novo começa do topo: manter a rolagem do anterior faz a pessoa
     cair no meio de um assunto que ela não escolheu */
  const corpo=document.querySelector('.settings-body');
  if(corpo&&corpo.parentElement) corpo.parentElement.scrollTop=0;
  if(mover) document.getElementById('settings-tab-'+id)?.focus();
  try{ localStorage.setItem(SETTINGS_ABA_CHAVE,id); }catch(e){}
}

function ligarAbasConfig(){
  const barra=document.querySelector('.settings-tabs');
  if(!barra) return;

  barra.querySelectorAll('.settings-tab').forEach(b=>{
    b.addEventListener('click',()=>mostrarAbaConfig(b.getAttribute('data-pane')));
  });

  /* ← → andam entre as abas; Home e End vão às pontas. É o que o teclado
     espera de uma aba, e é de graça depois que a marcação está certa. */
  barra.addEventListener('keydown',e=>{
    const atual=SETTINGS_ABAS.indexOf(document.activeElement?.getAttribute?.('data-pane'));
    if(atual<0) return;
    let alvo=null;
    if(e.key==='ArrowRight') alvo=(atual+1)%SETTINGS_ABAS.length;
    else if(e.key==='ArrowLeft') alvo=(atual-1+SETTINGS_ABAS.length)%SETTINGS_ABAS.length;
    else if(e.key==='Home') alvo=0;
    else if(e.key==='End') alvo=SETTINGS_ABAS.length-1;
    if(alvo===null) return;
    e.preventDefault();
    mostrarAbaConfig(SETTINGS_ABAS[alvo],true);
  });

  mostrarAbaConfig(abaSalva()||SETTINGS_ABAS[0]);
}
