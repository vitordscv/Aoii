/* O "i" do hero: sobrevive à animação do número? e fica centrado nele? */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log('  \x1b[32mok\x1b[0m ' + m)
  : (falhas++, console.log('  \x1b[31m!!\x1b[0m ' + m + (d ? '\n       ' + d : ''))); };

(async () => {
  const cdp = await conectar();
  await irPara(cdp, URL);
  await avaliar(cdp, `localStorage.clear(); return 1;`);
  await irPara(cdp, URL);
  await esperar(1400);
  await avaliar(cdp, `
    document.getElementById('ob-renda-valor').value='5000';
    document.getElementById('ob-saldo').value='1200';
    document.getElementById('ob-confirm-btn').click();`);
  await esperar(1200);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click();`);
  await esperar(900);

  const medir = () => avaliar(cdp, `
    const num=document.querySelector('.hero-number');
    const btn=document.querySelector('.hero-tip-btn');
    if(!num) return {erro:'sem .hero-number'};
    if(!btn) return {existe:false};
    const n=num.getBoundingClientRect(), b=btn.getBoundingClientRect();
    return {
      existe:true,
      centroNumero:+(n.top+n.height/2).toFixed(1),
      centroBotao:+(b.top+b.height/2).toFixed(1),
      desalinho:+((b.top+b.height/2)-(n.top+n.height/2)).toFixed(1),
      alturaNumero:+n.height.toFixed(1),
      cursor:getComputedStyle(btn).cursor,
    };
  `);

  console.log('\n  == logo depois de desenhar ==');
  let m = await medir();
  conferir(m.existe, 'o botão "i" existe');
  if (m.existe) {
    console.log(`     centro do número ${m.centroNumero} · centro do botão ${m.centroBotao}`);
    conferir(Math.abs(m.desalinho) <= 2, `centrado no número (desvio ${m.desalinho}px de ${m.alturaNumero}px de altura)`);
    conferir(m.cursor === 'pointer', `cursor = ${m.cursor}`, 'esperava pointer');
  }

  /* muda o saldo: o número anima, e é aí que o countUp escreve textContent */
  console.log('\n  == depois de mudar o saldo (número anima) ==');
  await avaliar(cdp, `
    const el=document.getElementById('saldo-atual-input');
    el.value='9999'; el.dispatchEvent(new Event('change'));
  `);
  await esperar(300);
  const durante = await medir();
  conferir(durante.existe, 'o botão sobrevive durante a animação');
  await esperar(1200);
  const depois = await medir();
  conferir(depois.existe, 'e continua lá quando a animação termina');
  if (depois.existe) {
    conferir(Math.abs(depois.desalinho) <= 2, `continua centrado (desvio ${depois.desalinho}px)`);
  }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mBotão firme e centrado.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
