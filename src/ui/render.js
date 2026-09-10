/* ─── render ─── */

/* ── theme vars for presets (used by applyTheme + custom picker restore) ── */
const THEME_VARS={
  onda: {'--cream':'#F3EAD6','--white':'#FFFCF5','--disney-blue':'#3F6FB0','--disney-blue-deep':'#1E3F73','--ink-navy':'#1D3557','--num-color':'#1D3557','--line':'#DED0AC','--pos':'#3E6F5C','--neg':'#A23B2E','--gold':'#B8893F','--hero-grad1':'#24447C','--hero-text':'#F3EAD6'},
  noite:{'--cream':'#111B2E','--white':'#182742','--disney-blue':'#6C9BDB','--disney-blue-deep':'#4677BE','--ink-navy':'#EDEFF6','--num-color':'#EDEFF6','--line':'#2D3E5F','--pos':'#6FBE9C','--neg':'#E17E68','--gold':'#D8B579','--hero-grad1':'#132546','--hero-text':'#EDEFF6'},
  sakura:{'--cream':'#FBEFEF','--white':'#FFFAFA','--disney-blue':'#C77B93','--disney-blue-deep':'#9C4B66','--ink-navy':'#5C2E3F','--num-color':'#5C2E3F','--line':'#EBC9CE','--pos':'#4E8069','--neg':'#B23B4A','--gold':'#C79A5C','--hero-grad1':'#7A3B52','--hero-text':'#FBEFEF'},
  matcha:{'--cream':'#EFF1DE','--white':'#FAFBF2','--disney-blue':'#5C8259','--disney-blue-deep':'#3A5A3D','--ink-navy':'#33421F','--num-color':'#33421F','--line':'#CBD3AC','--pos':'#3E6F5C','--neg':'#A2482E','--gold':'#A78A3F','--hero-grad1':'#38512F','--hero-text':'#EFF1DE'},
  poupa:{'--cream':'#0F1E16','--white':'#17291F','--disney-blue':'#1FBE99','--disney-blue-deep':'#0E8E73','--ink-navy':'#E9F3EC','--num-color':'#E9F3EC','--line':'#23392C','--pos':'#3ECF8E','--neg':'#E6685A','--gold':'#1FBE99','--hero-grad1':'#12483B','--hero-text':'#E9F3EC'},
  grafite:{'--cream':'#131313','--white':'#1C1C1C','--disney-blue':'#B5B5B5','--disney-blue-deep':'#8A8A8A','--ink-navy':'#EDEDED','--num-color':'#EDEDED','--line':'#333333','--pos':'#8FBF9A','--neg':'#C97B72','--gold':'#A8A8A8','--hero-grad1':'#242424','--hero-text':'#F2F2F2'},
};

let customPanelHidden=false;
function applyTheme(tema){
  tema=tema||'onda';
  if(data.temaAutoNoite){
    const h=new Date().getHours();
    const noiteAgora=h>=19||h<6;
    if(noiteAgora && tema!=='custom') tema='grafite';
  }
  document.documentElement.setAttribute('data-theme', tema==='custom'?'':tema);
  // fundo ilustrado: opcional; hoje os temas onda e matcha têm arte, outros virão
  document.documentElement.classList.toggle('bg-ilustrado', data.fundoIlustrado!==false);
  applyBgArt(tema, data.fundoIlustrado!==false);
  const sel=document.getElementById('theme-select');
  if(sel) sel.value=data.tema||'onda';
  document.querySelectorAll('.theme-menu-item').forEach(it=>{
    it.classList.toggle('active', it.getAttribute('data-theme')===(data.tema||'onda'));
  });

  const panel=document.getElementById('custom-theme-panel');
  const reopenBtn=document.getElementById('ct-reopen-btn');
  if(!panel) return;

  if(tema==='custom'){
    panel.style.display=customPanelHidden?'none':'';
    if(reopenBtn) reopenBtn.style.display=customPanelHidden?'':'none';
    const custom=data.customTheme||{};
    // apply saved custom vars inline
    Object.entries(custom).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
    // populate pickers
    panel.querySelectorAll('input[type=color]').forEach(inp=>{
      const v=inp.getAttribute('data-var');
      inp.value=custom[v]||rgbToHex(getComputedStyle(document.documentElement).getPropertyValue(v).trim());
    });
  } else {
    panel.style.display='none';
    if(reopenBtn) reopenBtn.style.display='none';
    // remove any inline custom vars
    Object.keys(THEME_VARS.onda).forEach(k=>document.documentElement.style.removeProperty(k));
  }
}

function rgbToHex(rgb){
  if(rgb.startsWith('#')) return rgb.length===4?'#'+rgb[1]+rgb[1]+rgb[2]+rgb[2]+rgb[3]+rgb[3]:rgb;
  const m=rgb.match(/\d+/g); if(!m) return '#000000';
  return '#'+m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
}

function bindCustomTheme(){
  const panel=document.getElementById('custom-theme-panel'); if(!panel) return;
  panel.querySelectorAll('input[type=color]').forEach(inp=>{
    inp.addEventListener('input',async e=>{
      const v=e.target.getAttribute('data-var');
      if(!data.customTheme) data.customTheme={};
      data.customTheme[v]=e.target.value;
      document.documentElement.style.setProperty(v,e.target.value);
      await persist();
    });
  });
  panel.querySelectorAll('.ct-preset').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const preset=btn.getAttribute('data-preset');
      const vars=THEME_VARS[preset]||{};
      if(!data.customTheme) data.customTheme={};
      Object.entries(vars).forEach(([k,v])=>{
        data.customTheme[k]=v;
        document.documentElement.style.setProperty(k,v);
      });
      // update pickers
      panel.querySelectorAll('input[type=color]').forEach(inp=>{
        const v=inp.getAttribute('data-var');
        if(vars[v]) inp.value=vars[v];
      });
      await persist();
    });
  });
}

/* ── badge do PWA: dias até o fechamento da fatura mais próxima ── */
function updateAppBadge(){
  if(!('setAppBadge' in navigator)) return;
  const t=today();
  let melhorDias=null;
  (data.cartoes||[]).forEach(c=>{
    if(!c.diaFechamento) return;
    let fechamento=dataNoMes(t.getFullYear(),t.getMonth()+1,c.diaFechamento);
    if(fechamento<t) fechamento=dataNoMes(t.getFullYear(),t.getMonth()+2,c.diaFechamento);
    const dias=Math.round((fechamento-t)/86400000);
    if(melhorDias===null||dias<melhorDias) melhorDias=dias;
  });
  try{
    if(melhorDias!==null&&melhorDias<=3){ navigator.setAppBadge(Math.max(1,melhorDias)); }
    else{ navigator.clearAppBadge(); }
  }catch(e){}
}

const VIEW_RENDERERS={
  'view-resumo':()=>{
    renderHero();
    renderDailyBudget();
    renderChips();
    renderNegativeWarning();
    renderFaturaWarning();
    prepararFaixaCotacoes();
    renderRendaAtrasadaWarning();
    renderInsights();
    renderWeekSummary();
    renderRevisaoMensal();
    renderSaudeFinanceira();
    renderConselhos();
    renderIaPergunta();
    renderCalendarioMes();
    renderLimitCard();
    renderCategoryCard();
    renderCatDonut();
    renderMonthComparison();
    renderOrcamentos();
  },
  'view-diario':()=>{
    renderDiarioSummaryCard();
    renderTransacoesFiltro();
    renderTransacoesList();
  },
  'view-fixos':()=>{
    renderChart();
    renderGastosFixosTab();
    renderGfEvolucao();
    renderMonths();
  },
  'view-entradas':()=>{
    renderRendas();
    renderList('entradasExtras','extras-list','extras-total','feito','recebido');
    renderDividas();
    renderList('comprasPlanejadas','purchases-list','purchases-total','feito','comprado');
  },
  'view-economias':()=>{
    renderMetas();
    renderReservaCard();
    renderPatrimonio();
    renderInvestimentos();
  },
};
const viewsPendentes=new Set(Object.keys(VIEW_RENDERERS));

function marcarViewsPendentes(){
  Object.keys(VIEW_RENDERERS).forEach(id=>viewsPendentes.add(id));
}

function viewAtiva(){
  const atual=document.querySelector('.bn-item[aria-current="page"]');
  const alvo=atual&&atual.getAttribute('data-target');
  if(alvo&&VIEW_RENDERERS[alvo]) return alvo;
  const visivel=[...document.querySelectorAll('.tab-view')].find(v=>v.style.display!=='none');
  return visivel&&VIEW_RENDERERS[visivel.id]?visivel.id:'view-resumo';
}

function renderView(id,forcar=false){
  const desenhar=VIEW_RENDERERS[id];
  if(!desenhar||(!forcar&&!viewsPendentes.has(id))) return false;
  desenhar();
  viewsPendentes.delete(id);
  countUpAll(document.getElementById(id));
  return true;
}

function render(){
  invalidarTimeline();
  marcarViewsPendentes();
  applyIdiomaMonths();
  applyTheme(data.tema);
  updateAppBadge();
  const iaFab=document.getElementById('ia-chat-fab');
  if(iaFab) iaFab.style.display=iaAtiva()?'flex':'none';
  renderView(viewAtiva(),true);
  const settings=document.getElementById('settings-panel');
  if(settings&&settings.style.display==='block') renderSettings();
  applyIdioma();
  renderStatusSync();
}
