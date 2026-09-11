/* ─── helpers ─── */

function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function nomeCartao(id){ const c=(data.cartoes||[]).find(x=>x.id===id); return c?c.nome:''; }
/* Só o símbolo solto, pro rótulo que fica ao lado dos campos de valor. Como
   escrever a quantia é outra conversa e quem responde é o Intl, no idioma de
   quem lê — ver formatBRL(). Cada moeda já trouxe um locale colado aqui, o que
   fazia todo mundo que usa euro ver número escrito à alemã. */
const CURRENCY_INFO={
  BRL:{symbol:'R$'},
  USD:{symbol:'US$'},
  EUR:{symbol:'€'},
  GBP:{symbol:'£'},
};
