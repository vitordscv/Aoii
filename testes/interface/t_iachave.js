/* A chave do Gemini: por padrão só na sessão, no disco só se a pessoa pedir,
   escondida no campo, e apagada quando a IA é desligada.

   O caso que mais importa é o de quem JÁ usava: a chave dessa pessoa estava no
   localStorage porque era o único jeito que existia. Uma atualização não pode
   tirá-la debaixo dela. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
const CHAVE = 'AIzaSyFALSA-SO-PRA-TESTE-000000000000000';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

const abrirIA = cdp => avaliar(cdp, `
  document.getElementById('topbar-settings-btn').click();
  await new Promise(r=>setTimeout(r,600));
  document.getElementById('settings-tab-ia').click();
  await new Promise(r=>setTimeout(r,400));
  return 1;`);

const onde = cdp => avaliar(cdp, `
  const campo=document.getElementById('ia-chave-input');
  const lembrar=document.getElementById('ia-lembrar-check');
  const aviso=document.getElementById('ia-lembrar-aviso');
  return {
    noDisco:localStorage.getItem('financas-ia-chave')||null,
    naSessao:sessionStorage.getItem('financas-ia-chave')||null,
    marca:localStorage.getItem('financas-ia-lembrar'),
    tipoDoCampo:campo?campo.type:null,
    valorDoCampo:campo?campo.value:null,
    lembrarLigado:lembrar?lembrar.checked:null,
    avisoVisivel:aviso?!aviso.hidden:null,
    fabDaIa:(document.getElementById('ia-chat-fab')||{}).style?.display||null};`);

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 420, height: 860, deviceScaleFactor: 2, mobile: false });

  console.log('\n  \x1b[1mquem já usava não perde a chave\x1b[0m');
  /* o service worker guarda a pagina: sem limpar, o teste roda contra a
     versao anterior do app e mede o codigo errado */
  await cdp.enviar('Network.enable');
  await irPara(cdp, URL);
  await avaliar(cdp, `
    const regs=await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r=>r.unregister()));
    const ns=await caches.keys(); await Promise.all(ns.map(n=>caches.delete(n)));
    return 1;`).catch(()=>{});
  await cdp.enviar('Network.clearBrowserCache');

  await irPara(cdp, URL);
  await avaliar(cdp, `
    localStorage.clear(); sessionStorage.clear();
    /* estado do app antigo: chave no disco, sem marca nenhuma */
    localStorage.setItem('financas-ia-chave','${CHAVE}');
    localStorage.setItem('financas-data',JSON.stringify({iaAtiva:true,saldoAtual:100}));
    return 1;`);
  await irPara(cdp, URL); await esperar(1700);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,400)); return 1;`);
  await abrirIA(cdp);
  let e = await onde(cdp);
  conferir(e.noDisco === CHAVE, 'a chave que já estava no disco continua lá');
  conferir(e.lembrarLigado === true, 'e "lembrar" aparece ligado, que era o comportamento dela');
  conferir(e.avisoVisivel === true, 'com o custo de guardar dito ao lado');

  console.log('\n  \x1b[1mo campo não mostra a chave\x1b[0m');
  conferir(e.tipoDoCampo === 'password', `o campo é de senha (${e.tipoDoCampo})`);
  const revelou = await avaliar(cdp, `
    document.getElementById('ia-chave-ver').click();
    await new Promise(r=>setTimeout(r,200));
    const c=document.getElementById('ia-chave-input');
    const b=document.getElementById('ia-chave-ver');
    const t1={tipo:c.type,pressed:b.getAttribute('aria-pressed')};
    b.click(); await new Promise(r=>setTimeout(r,200));
    return {aoMostrar:t1,aoOcultar:{tipo:c.type,pressed:b.getAttribute('aria-pressed')}};`);
  conferir(revelou.aoMostrar.tipo === 'text' && revelou.aoMostrar.pressed === 'true',
    'dá pra revelar pra conferir o que se colou');
  conferir(revelou.aoOcultar.tipo === 'password' && revelou.aoOcultar.pressed === 'false',
    'e esconder de novo');

  console.log('\n  \x1b[1mdesligar "lembrar" tira do disco sem perder a sessão\x1b[0m');
  await avaliar(cdp, `
    const l=document.getElementById('ia-lembrar-check');
    l.checked=false; l.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400)); return 1;`);
  e = await onde(cdp);
  conferir(e.noDisco === null, 'saiu do disco');
  conferir(e.naSessao === CHAVE, 'mas continua valendo agora, sem colar de novo');
  conferir(e.avisoVisivel === false, 'e o aviso de risco some junto');

  console.log('\n  \x1b[1mfechar e abrir: a sessão acaba, o disco não\x1b[0m');
  await irPara(cdp, URL); await esperar(1600);
  await abrirIA(cdp);
  e = await onde(cdp);
  conferir(e.naSessao === CHAVE, 'recarregar a aba mantém (a sessão sobrevive ao reload)');
  /* uma aba nova de verdade: sessionStorage não é herdado */
  const noutraAba = await avaliar(cdp, `
    /* simula abrir do zero: e o que o sessionStorage perde ao fechar a aba */
    const guardado=sessionStorage.getItem('financas-ia-chave');
    sessionStorage.clear();
    return {tinha:guardado, agora:sessionStorage.getItem('financas-ia-chave'),
      noDisco:localStorage.getItem('financas-ia-chave')};`);
  conferir(noutraAba.agora === null && noutraAba.noDisco === null,
    'numa aba nova a chave não está em lugar nenhum — é o que "não lembrar" quer dizer');

  console.log('\n  \x1b[1mligar "lembrar" desce pro disco\x1b[0m');
  await irPara(cdp, URL); await esperar(1600);
  await abrirIA(cdp);
  await avaliar(cdp, `
    const c=document.getElementById('ia-chave-input');
    c.value='${CHAVE}'; c.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,300));
    const l=document.getElementById('ia-lembrar-check');
    l.checked=true; l.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400)); return 1;`);
  e = await onde(cdp);
  conferir(e.noDisco === CHAVE && e.naSessao === CHAVE, 'a chave desce pro disco quando se pede');
  conferir(e.avisoVisivel === true, 'e o custo passa a ser dito');

  console.log('\n  \x1b[1mdesligar a IA apaga a chave\x1b[0m');
  await avaliar(cdp, `
    const a=document.getElementById('ia-ativa-check');
    a.checked=false; a.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,600)); return 1;`);
  e = await onde(cdp);
  conferir(e.noDisco === null && e.naSessao === null,
    'nem no disco nem na sessão',
    'guardaria a credencial de um recurso que a pessoa acabou de dispensar');
  conferir(e.valorDoCampo === '', 'e o campo fica vazio na tela');

  console.log('\n  \x1b[1ma chave não vai pro backup\x1b[0m');
  await irPara(cdp, URL); await esperar(1600);
  const backup = await avaliar(cdp, `
    localStorage.setItem('financas-ia-chave','${CHAVE}');
    const d=JSON.parse(localStorage.getItem('financas-data')||'{}');
    return {temNoObjeto:JSON.stringify(d).includes('${CHAVE}')};`);
  conferir(!backup.temNoObjeto, 'o objeto que vai pra nuvem e pro arquivo não a contém');

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mA chave fica onde a pessoa mandou, e só enquanto ela quiser.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
