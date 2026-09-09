/* ── assistente com IA (Gemini, chave própria do usuário) ── */
/* Montagem e aplicação dos cinco dicionários na interface estática. Conteúdo
   dinâmico usa L() no ponto em que é criado. */
/* As traduções em si moram em i18n/<idioma>.js. Aqui só se junta tudo:
   a ordem no build.manifest.json garante que os dicionários já existam. */
const I18N={pt:I18N_PT,en:I18N_EN,es:I18N_ES,fr:I18N_FR,it:I18N_IT};
function applyIdiomaMonths(){
  const idioma=data.idioma||'pt';
  MONTH_NAMES.splice(0,12,...(MONTH_NAMES_I18N[idioma]||MONTH_NAMES_I18N.pt));
  MONTH_ABBR.splice(0,12,...(MONTH_ABBR_I18N[idioma]||MONTH_ABBR_I18N.pt));
  WEEKDAY_ABBR.splice(0,7,...(WEEKDAY_ABBR_I18N[idioma]||WEEKDAY_ABBR_I18N.pt));
}
function applyIdioma(){
  const idioma=data.idioma||'pt';
  document.documentElement.setAttribute('lang', idioma==='pt'?'pt-BR':idioma);
  const dict=I18N[idioma]||I18N.pt;
  const moeda=(typeof CURRENCY_INFO!=='undefined'&&CURRENCY_INFO[data.moeda])||CURRENCY_INFO.BRL;
  document.querySelectorAll('.curr').forEach(el=>{ el.textContent=moeda.symbol; });
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.getAttribute('data-i18n');
    if(dict[key]) el.textContent=dict[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const key=el.getAttribute('data-i18n-placeholder');
    if(dict[key]) el.setAttribute('placeholder',dict[key]);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{
    const key=el.getAttribute('data-i18n-title');
    if(dict[key]) el.setAttribute('title',dict[key]);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el=>{
    const key=el.getAttribute('data-i18n-aria-label');
    if(dict[key]) el.setAttribute('aria-label',dict[key]);
  });
  document.querySelectorAll('[data-i18n-tip]').forEach(el=>{
    const key=el.getAttribute('data-i18n-tip');
    if(dict[key]) el.setAttribute('data-tip',dict[key]);
  });
  applyIdiomaMonths();
}
