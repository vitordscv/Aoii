/* ── Uma pergunta por vez, também pelo teclado ──────────────────────────────

   O botão de enviar ficava desabilitado durante a resposta, e isso parecia
   bastar. Não bastava: o Enter não passa pelo botão — chamava `enviar()`
   direto. Digitar uma segunda pergunta enquanto a primeira está em voo e
   apertar Enter disparava as duas.

   Duas em voo dão resposta fora de ordem (a segunda pode chegar antes), o
   histórico embaralha, e cada uma custa uma chamada paga. Este teste conta
   quantas vezes a API é chamada. */
'use strict';
const { conectar, avaliar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp } = require('./ajuda');

/* a IA responde devagar de propósito: é durante a espera que o defeito cabe */
const DUBLE = `
  window.__iaChamadas=0;
  const fetchReal=window.fetch;
  window.fetch=async function(entrada,init){
    const url=String(entrada&&entrada.url||entrada||'');
    if(!/generativelanguage|googleapis/.test(url)) return fetchReal.apply(this,arguments);
    window.__iaChamadas++;
    await new Promise(r=>setTimeout(r,1500));
    const corpo={candidates:[{content:{parts:[{text:'resposta '+window.__iaChamadas}]}}]};
    return new Response(JSON.stringify(corpo),{status:200,headers:{'Content-Type':'application/json'}});
  };
  return 1;`;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 900, deviceScaleFactor: 2, mobile: false });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 430, altura: 900 });
  await avaliar(cdp, DUBLE);

  titulo('ligar a IA e abrir o chat');
  const pronto = await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,600));
    document.getElementById('settings-tab-ia').click();
    await new Promise(r=>setTimeout(r,400));
    const liga=document.getElementById('ia-ativa-check');
    liga.checked=true; liga.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,500));
    const campo=document.getElementById('ia-chave-input');
    campo.value='AIzaSyTesteTesteTesteTesteTesteTesteTes';
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    /* fecha as configurações e abre o chat */
    document.querySelector('#settings-sheet .sheet-close-btn, #settings-sheet-close')?.click();
    await new Promise(r=>setTimeout(r,500));
    const fab=document.getElementById('ia-fab');
    if(fab) fab.click();
    await new Promise(r=>setTimeout(r,700));
    const chat=document.getElementById('ia-chat-input');
    return {temChat:!!chat, visivel:chat?chat.offsetParent!==null:false};`);
  conferir(pronto.temChat, 'o campo do chat existe');

  titulo('Enter durante a resposta não dispara uma segunda pergunta');
  const r = await avaliar(cdp, `
    const campo=document.getElementById('ia-chat-input');
    const enter=()=>campo.dispatchEvent(new KeyboardEvent('keydown',
      {key:'Enter',bubbles:true,cancelable:true}));

    campo.value='primeira';
    enter();
    await new Promise(r=>setTimeout(r,200));   /* a resposta leva 1500ms */

    /* a pessoa digita de novo enquanto espera, e aperta Enter */
    campo.value='segunda';
    enter();
    await new Promise(r=>setTimeout(r,200));
    campo.value='terceira';
    enter();

    const emVoo=window.__iaChamadas;
    await new Promise(r=>setTimeout(r,2200));  /* deixa a primeira terminar */
    return {emVoo, total:window.__iaChamadas,
      baloes:document.querySelectorAll('#ia-chat-msgs .ia-chat-msg').length};`);

  conferir(r.emVoo === 1,
    `uma chamada em voo, não três (${r.emVoo})`,
    'o botão desabilitado não cobre o Enter: ele chama enviar() direto');
  conferir(r.total === 1,
    `e no fim foi uma chamada só (${r.total})`,
    'duas respostas em voo chegam fora de ordem e embaralham o histórico');

  titulo('e depois da resposta dá pra perguntar de novo');
  const depois = await avaliar(cdp, `
    const campo=document.getElementById('ia-chat-input');
    campo.value='quarta';
    campo.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    await new Promise(r=>setTimeout(r,2200));
    return window.__iaChamadas;`);
  conferir(depois === 2,
    `a trava solta quando a resposta chega (${depois} chamadas no total)`,
    'travar e não soltar seria pior que o defeito');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
