/* Preencher uma folha sem precisar caçar o botão de salvar.

   No celular o botão de confirmar fica atrás do teclado. A barra de ações da
   folha é fixa no rodapé, mas isso só serve se o teclado ENCOLHER a página em
   vez de cobri-la — é o que `interactive-widget=resizes-content` pede no
   viewport, e sem ele a área fixa fica embaixo do teclado, sem nada a rolar.

   E, mesmo com tudo no lugar, o caminho mais curto é não sair do teclado:
   Enter num campo salva. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { CENARIO } = require('./cenario');
const { APP, titulo, conferir, encerrar, limparAparelho, abrirApp, irParaTela } = require('./ajuda');

/* digita pelo teclado, como um dedo faria */
async function digitar(cdp, texto) {
  for (const ch of texto) await cdp.enviar('Input.dispatchKeyEvent', { type: 'char', text: ch });
  await esperar(100);
}
async function tecla(cdp, key, code, vk) {
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk });
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk });
  await esperar(400);
}

(async () => {
  const cdp = await conectar();
  await limparAparelho(cdp);
  await abrirApp(cdp);

  titulo('o viewport deixa o teclado encolher a página');
  const vp = await avaliar(cdp, `
    const m=document.querySelector('meta[name="viewport"]');
    return m?m.content:'(sem viewport)';`);
  conferir(/interactive-widget=resizes-content/.test(vp),
    `o viewport pede que o teclado encolha a página`,
    `sem isso a barra de ações fixa fica ATRÁS do teclado: "${vp}"`);

  const acoes = await avaliar(cdp, `
    const cs=getComputedStyle(document.querySelector('.sheet-actions'));
    return {posicao:cs.position, baixo:cs.bottom};`);
  conferir(acoes.posicao === 'sticky' && acoes.baixo === '0px',
    'e a barra de ações da folha fica presa no rodapé');

  titulo('Enter num campo salva, sem precisar achar o botão');
  await irParaTela(cdp, 'entradas', 'tab-entradas-rendas');
  const antes = await avaliar(cdp, `
    return (JSON.parse(localStorage.getItem('financas-data')).rendasRecorrentes||[]).length;`);

  await avaliar(cdp, `
    document.getElementById('rr-new-btn').click();
    await new Promise(r=>setTimeout(r,700));
    const v=document.getElementById('rr-valor'); v.focus();
    return 1;`);
  await digitar(cdp, '1500');
  await avaliar(cdp, `document.getElementById('rr-nome').focus(); return 1;`);
  await digitar(cdp, 'Aulas de sabado');
  await avaliar(cdp, `document.getElementById('rr-dia').focus(); return 1;`);
  await digitar(cdp, '10');

  /* aqui o dedo teria que fechar o teclado e procurar o botao */
  await tecla(cdp, 'Enter', 'Enter', 13);
  await esperar(700);

  const depois = await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    const lista=d.rendasRecorrentes||[];
    const nova=lista.find(r=>r.nome==='Aulas de sabado');
    return {quantas:lista.length, valor:nova?nova.valor:null, dia:nova?nova.diaDoMes:null,
      folhaAberta:document.getElementById('rr-sheet').style.display==='block'};`);
  conferir(depois.quantas === antes + 1, `a renda foi salva pelo Enter (${antes} → ${depois.quantas})`,
    'sem isso, so clicando no botao — que no celular esta atras do teclado');
  conferir(depois.valor === 1500 && depois.dia === 10,
    `com os valores certos (R$ ${depois.valor}, dia ${depois.dia})`);
  conferir(!depois.folhaAberta, 'e a folha fechou sozinha');

  titulo('o botão de acrescentar mês tem corpo de botão');
  await irParaTela(cdp, 'fixos', 'tab-fixos-linha');
  const bt = await avaliar(cdp, `
    const b=document.querySelector('.mes-add-btn');
    if(!b) return null;
    b.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,250));
    const cs=getComputedStyle(b), r=b.getBoundingClientRect();
    const paiCs=getComputedStyle(b.parentElement);
    return {fundo:cs.backgroundColor, altura:Math.round(r.height),
      peso:cs.fontWeight, tamanho:cs.fontSize,
      temFundoProprio:cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent'};`);
  conferir(bt && bt.temFundoProprio,
    `tem fundo próprio, e não some no papel (${bt ? bt.fundo : '?'})`,
    'tracejado sobre textura nao se le como botao');
  conferir(bt && bt.altura >= 44, `e altura de alvo de toque (${bt ? bt.altura : 0}px)`);

  encerrar('Dá pra preencher sem caçar botão.');
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
