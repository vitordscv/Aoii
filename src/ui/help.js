/* ─── botõezinhos "?" de ajuda contextual: um popover compartilhado, posicionado perto do botão clicado ─── */
function setupInfoTips(){
  let pop=document.getElementById('info-tip-popover');
  if(!pop){
    pop=document.createElement('div');
    pop.className='info-tip-popover';
    pop.id='info-tip-popover';
    document.body.appendChild(pop);
  }
  function hide(){ pop.style.display='none'; }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.info-tip-btn');
    if(!btn){ if(!e.target.closest('.info-tip-popover')) hide(); return; }
    e.stopPropagation();
    const texto=btn.getAttribute('data-tip')||'';
    if(pop.style.display==='block'&&pop._openedBy===btn){ hide(); pop._openedBy=null; return; }
    pop.textContent=texto;
    pop.style.display='block';
    pop._openedBy=btn;
    const r=btn.getBoundingClientRect();
    const maxW=260;
    let left=Math.min(window.innerWidth-maxW-12,Math.max(12,r.left-maxW/2+r.width/2));
    pop.style.left=left+'px';
    const top=r.bottom+8;
    pop.style.top=(top+120>window.innerHeight?r.top-8-pop.offsetHeight:top)+'px';
  },true);
  window.addEventListener('scroll',hide,true);
}

async function init(){
  await loadData();
  if(ensurePatrimonioSnapshot()) await persist();
  if(aplicarAportesAutomaticos()) await persist();
  render(); bindStatic();
  setupInfoTips();
  setupOnboarding();
  if(data.onboardingCompleto && !data.tourCompleto) setTimeout(startTour,600);
  // sanitiza inputs numéricos globalmente: alguns teclados (principalmente no celular) deixam passar
  // letras/símbolos, e a vírgula do teclado brasileiro não era aceita; agora os campos são type="text"
  // com inputmode="decimal" (o navegador não briga mais com o valor) e o JS filtra os caracteres.
  document.addEventListener('input',e=>{
    const t=e.target;
    if(t&&t.tagName==='INPUT'&&t.getAttribute('inputmode')==='decimal'){
      const raw=t.value;
      /* tira só o que não é número nem separador; vírgula e ponto de milhar
         ficam como foram digitados — quem resolve é o parseNum na leitura */
      let cleaned=raw.replace(/[^0-9.,-]/g,'');
      cleaned=cleaned[0]==='-'?'-'+cleaned.slice(1).replace(/-/g,''):cleaned.replace(/-/g,'');
      if(cleaned!==raw) t.value=cleaned;
    }
  },true);
  if(syncConfigured()){
    /* Sem senha na sessão, não há o que ler nem o que escrever. Pergunta uma
       vez ao abrir; se a pessoa dispensar, o app segue inteiro em modo local e
       o status diz que está trancada. */
    if(await restaurarSessaoSync()) renderStatusSync();
    else {
      renderStatusSync();
      /* uma vez por código: quem dispensou não é interrompido de novo */
      if(!senhaFoiDispensada(getSyncCode())) destrancarSincronizacao();
    }
  }
  // O ciclo também atende quem ativar a sincronização depois de abrir o app.
  setInterval(async()=>{
    await puxarDaNuvem();
    if(sincronizacaoDestrancada()&&!espelhoPendente()&&!_espelhando&&!_abrindoSync) await ensureMonthlySnapshot();
  },20000);
  setupAutoUpdate();
  if('serviceWorker' in navigator){
    /* o app é montado DEPOIS que o 'load' da página já aconteceu (o
       empacotador desempacota o HTML e troca o documento), então um ouvinte
       de 'load' registrado aqui nunca seria chamado — o service worker
       nunca subia. Registra na hora quando a página já terminou. */
    const registrarSW=()=>{ navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{}); };
    if(document.readyState==='complete') registrarSW();
    else window.addEventListener('load',registrarSW);
  }
  setupBottomNav();
  document.addEventListener('keydown',e=>{
    if((e.key==='n'||e.key==='N'||e.key==='+')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!e.metaKey&&!e.ctrlKey){
      const fab=document.getElementById('gasto-fab');
      if(fab && getComputedStyle(fab).display!=='none'){ e.preventDefault(); fab.click(); }
    }
  });
  setupSettingsModal();
  setupCalculadoraSheet();
  setupConversorSheet();
  setupGastoSheet();
  setupIaChatSheet();
  setupGastoFixoSheet();
  setupCartaoSheet();
  setupInvSheet();
  setupRRSheet();
  animateBars(document);
}
