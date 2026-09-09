/* ─── helpers ─── */

function uid(){ return 'id-'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nomeCartao(id){ const c=(data.cartoes||[]).find(x=>x.id===id); return c?c.nome:''; }
const CURRENCY_INFO={
  BRL:{symbol:'R$',locale:'pt-BR'},
  USD:{symbol:'US$',locale:'en-US'},
  EUR:{symbol:'€',locale:'de-DE'},
  GBP:{symbol:'£',locale:'en-GB'},
};
