/* Com a folha aberta e rolada até o fim, continuar rolando não pode mexer na
   página de trás. Usa Input.dispatchMouseEvent com type:mouseWheel, que é o
   caminho que o Chrome trata como rolagem de verdade — e portanto é onde o
   encadeamento acontece. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log('  \x1b[32mok\x1b[0m ' + m)
  : (falhas++, console.log('  \x1b[31m!!\x1b[0m ' + m + (d ? '\n       ' + d : ''))); };

async function rolar(cdp, x, y, quanto) {
  await cdp.enviar('Input.dispatchMouseEvent',
    { type: 'mouseWheel', x, y, deltaX: 0, deltaY: quanto, pointerType: 'mouse' });
  await esperar(180);
}

(async () => {
  const cdp = await conectar();
  await irPara(cdp, URL);
  await avaliar(cdp, `localStorage.clear(); return 1;`);
  await irPara(cdp, URL);
  await esperar(1500);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click();`);
  await esperar(800);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click();`);
  await esperar(800);

  /* a página precisa ter o que rolar atrás, senão o teste não prova nada */
  const alturaPagina = await avaliar(cdp, `return document.documentElement.scrollHeight - innerHeight;`);
  conferir(alturaPagina > 400, `a página de trás tem ${alturaPagina}px de rolagem (senão o teste não valeria)`);

  /* abre "Novo gasto" pelo + */
  await avaliar(cdp, `document.getElementById('gasto-fab').click();`);
  await esperar(700);

  const estado = () => avaliar(cdp, `
    const s=document.getElementById('gasto-sheet');
    return {
      aberta: s.style.display==='block',
      rolagemDaFolha: Math.round(s.scrollTop),
      fimDaFolha: Math.round(s.scrollHeight-s.clientHeight),
      rolagemDaPagina: Math.round(window.scrollY),
      centroX: Math.round(s.getBoundingClientRect().left+s.getBoundingClientRect().width/2),
      centroY: Math.round(s.getBoundingClientRect().top+s.getBoundingClientRect().height/2),
    };`);

  let e = await estado();
  conferir(e.aberta, 'a folha "Novo gasto" abriu');
  conferir(e.fimDaFolha > 100, `e tem ${e.fimDaFolha}px pra rolar dentro dela`);
  const paginaAntes = e.rolagemDaPagina;

  /* rola até o fim da folha */
  for (let i = 0; i < 14; i++) await rolar(cdp, e.centroX, e.centroY, 400);
  e = await estado();
  conferir(e.rolagemDaFolha >= e.fimDaFolha - 2,
    `chegou ao fim da folha (${e.rolagemDaFolha} de ${e.fimDaFolha})`);
  console.log(`     página de trás: ${paginaAntes} → ${e.rolagemDaPagina}`);

  /* e agora insiste, que é o momento do encadeamento */
  console.log('\n  == insistindo no fim da folha ==');
  for (let i = 0; i < 8; i++) await rolar(cdp, e.centroX, e.centroY, 500);
  const depois = await estado();
  conferir(depois.rolagemDaPagina === paginaAntes,
    `a página de trás não se mexeu (${paginaAntes} → ${depois.rolagemDaPagina})`,
    `desceu ${depois.rolagemDaPagina - paginaAntes}px sem ninguém pedir`);
  conferir(depois.aberta, 'e a folha continua aberta');

  /* arrastar sobre o pano de fundo também não pode levar a página junto */
  console.log('\n  == rolando sobre o pano de fundo ==');
  const antesFundo = (await estado()).rolagemDaPagina;
  for (let i = 0; i < 6; i++) await rolar(cdp, 40, 120, 500);
  const fim = await estado();
  conferir(fim.rolagemDaPagina === antesFundo,
    `o fundo também não arrasta a página (${antesFundo} → ${fim.rolagemDaPagina})`);

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mA rolagem para onde a folha acaba.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
