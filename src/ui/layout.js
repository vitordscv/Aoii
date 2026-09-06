/* ─── posiciona o "+" flutuante em relação à nav real (funciona em qualquer largura) ───
   - No celular: flutua acima da nav, perto da borda direita (estilo do app de referência).
   - No PC: fica ao lado direito da nav (mesma altura), com uma distância — não solto acima dela. */
function positionGastoFab(){
  const fab=document.getElementById('gasto-fab');
  const nav=document.getElementById('bottom-nav');
  if(!fab||!nav) return;
  const navRect=nav.getBoundingClientRect();
  const FAB_SIZE=54;
  const isDesktop = window.matchMedia('(min-width:760px)').matches;
  if(isDesktop){
    const GAP_LATERAL=22; // distância horizontal entre a nav e o botão
    const navCenterY = navRect.top + navRect.height/2;
    fab.style.left = Math.round(navRect.right + GAP_LATERAL) + 'px';
    fab.style.right = 'auto';
    fab.style.top = Math.round(navCenterY - FAB_SIZE/2) + 'px';
    fab.style.bottom = 'auto';
  } else {
    const MARGEM_DIREITA=16;   // distância da borda direita da nav até a borda direita do botão
    const GAP_ACIMA=15;        // distância entre o topo da nav e a base do botão
    fab.style.left='auto';
    fab.style.top='auto';
    fab.style.right = Math.round(window.innerWidth - navRect.right + MARGEM_DIREITA) + 'px';
    fab.style.bottom = Math.round(window.innerHeight - navRect.top + GAP_ACIMA) + 'px';
  }
}
window.addEventListener('resize', positionGastoFab);
window.addEventListener('orientationchange', positionGastoFab);

