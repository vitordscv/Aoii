/* formato regional do idioma escolhido — usado em toda data e hora */
function localeAtual(){ return ({pt:'pt-BR',en:'en-US',es:'es-ES',fr:'fr-FR',it:'it-IT'})[data&&data.idioma||'pt']; }

function L(key){ const idi=data.idioma||'pt'; return (I18N[idi]&&I18N[idi][key])||I18N.pt[key]||key; }
