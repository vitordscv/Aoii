/* Cancelar a roda fora do diálogo não pode ter cancelado a roda DENTRO dele.
   Confere nos três lugares roláveis: folha de gasto, modal de configurações e
   o painel da IA. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const CEN = require('./cenario').CENARIO;

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log('  \x1b[32mok\x1b[0m ' + m)
  : (falhas++, console.log('  \x1b[31m!!\x1b[0m ' + m + (d ? '\n       ' + d : ''))); };

async function rolar(cdp, x, y, quanto) {
  await cdp.enviar('Input.dispatchMouseEvent',
    { type: 'mouseWheel', x, y, deltaX: 0, deltaY: quanto, pointerType: 'mouse' });
  await esperar(160);
}

/* rola no centro do elemento e diz quanto ele andou */
async function andou(cdp, seletor) {
  const r = await avaliar(cdp, `
    const el=document.querySelector('${seletor}');
    if(!el) return null;
    const b=el.getBoundingClientRect();
    return {x:Math.round(b.left+b.width/2), y:Math.round(b.top+b.height/2),
      antes:Math.round(el.scrollTop), podeRolar:el.scrollHeight-el.clientHeight,
      paginaAntes:Math.round(scrollY)};`);
  if (!r) return null;
  for (let i = 0; i < 5; i++) await rolar(cdp, r.x, r.y, 260);
  const dep = await avaliar(cdp, `
    const el=document.querySelector('${seletor}');
    return {depois:Math.round(el.scrollTop), pagina:Math.round(scrollY)};`);
  return { ...r, ...dep };
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 420, height: 760, deviceScaleFactor: 1, mobile: false });
  await irPara(cdp, URL);
  await avaliar(cdp, CEN);
  await avaliar(cdp, `localStorage.setItem('financas-ia-chave','X-SO-PRA-ABRIR'); return 1;`);
  await irPara(cdp, URL);
  await esperar(1600);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,600)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,600)); return 1;`);

  console.log('\n  \x1b[1mfolha "Novo gasto"\x1b[0m');
  await avaliar(cdp, `document.getElementById('gasto-fab').click(); await new Promise(r=>setTimeout(r,700)); return 1;`);
  let r = await andou(cdp, '#gasto-sheet');
  conferir(r.depois > r.antes + 50, `rola por dentro (${r.antes} → ${r.depois} de ${r.podeRolar})`,
    'o cancelamento da roda pegou o próprio diálogo');
  conferir(r.pagina === r.paginaAntes,
    `e a página de trás fica onde estava (${r.paginaAntes} → ${r.pagina})`);
  await avaliar(cdp, `document.getElementById('gasto-sheet-cancel').click(); await new Promise(r=>setTimeout(r,500)); return 1;`);

  console.log('\n  \x1b[1mmodal de configurações\x1b[0m');
  await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,700));
    /* a aba de categorias e a mais longa: e onde o painel passa da tela */
    document.getElementById('settings-tab-categorias')?.click();
    await new Promise(r=>setTimeout(r,500));
    return 1;`);
  r = await andou(cdp, '#settings-panel');
  conferir(r && r.depois > r.antes + 50, r ? `rola por dentro (${r.antes} → ${r.depois} de ${r.podeRolar})` : 'modal não abriu');
  await avaliar(cdp, `document.getElementById('settings-close-btn')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);

  console.log('\n  \x1b[1mpainel da IA\x1b[0m');
  const abriu = await avaliar(cdp, `
    const fab=document.getElementById('ia-chat-fab');
    if(!fab) return false;
    fab.click(); await new Promise(r=>setTimeout(r,800));
    /* enche a conversa pra haver o que rolar */
    const cx=document.getElementById('ia-chat-messages');
    for(let i=0;i<14;i++){ const d=document.createElement('div'); d.className='ia-chat-msg';
      d.textContent='linha de conversa número '+i; cx.appendChild(d); }
    return document.getElementById('ia-chat-sheet').style.display!=='none';`);
  if (abriu) {
    r = await andou(cdp, '#ia-chat-messages');
    conferir(r && r.depois > r.antes + 20, r ? `rola por dentro (${r.antes} → ${r.depois} de ${r.podeRolar})` : 'não achei');
    conferir(r && r.pagina === r.paginaAntes,
      `e a página de trás fica onde estava (${r.paginaAntes} → ${r.pagina})`);
  } else { console.log('  -- painel da IA não abriu neste ambiente, pulando'); }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mRolar por dentro continua funcionando.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
