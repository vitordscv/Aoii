/* ── insights automáticos do Resumo: apresentação ── */
function renderInsights(){
  const el=document.getElementById('insights-cards'); if(!el) return;
  const html=computeInsights().map((i,idx)=>`
    <div class="insight-card" style="animation-delay:${(idx*0.09).toFixed(2)}s;">
      <div class="insight-icon">${esc(i.categoria?catIcon(i.categoria):i.icon)}</div>
      <div class="insight-title">${esc(i.title)}</div>
      <div class="insight-value">${i.value}</div>
      <div class="insight-sub">${esc(i.categoria?categoriaLabel(i.categoria):i.sub)}</div>
    </div>`).join('');
  if(el._lastHtml!==html){ el._lastHtml=html; el.innerHTML=html; }
}
