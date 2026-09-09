/* formato regional do idioma escolhido — usado em toda data e hora */
function localeAtual(){ return ({pt:'pt-BR',en:'en-US',es:'es-ES',fr:'fr-FR',it:'it-IT'})[data&&data.idioma||'pt']; }

function L(key){ const idi=data.idioma||'pt'; return (I18N[idi]&&I18N[idi][key])||I18N.pt[key]||key; }

/* Categorias padrão têm identificadores históricos em português nos backups.
   Traduz somente a apresentação; categorias criadas pela pessoa ficam intactas. */
const CATEGORIA_I18N_KEYS={Mercado:'category.market',Transporte:'category.transport',Lazer:'category.leisure','Saúde':'category.health',Casa:'category.home',Outros:'category.other'};
function categoriaLabel(c){ const chave=CATEGORIA_I18N_KEYS[c]; return chave?L(chave):c; }
