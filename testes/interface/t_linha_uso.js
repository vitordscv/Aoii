/* A lista de meses em uso: abrir, fechar, editar sem perder o lugar.
   `render()` remonta a lista inteira a cada valor que muda — se o estado de
   aberto morasse no DOM, editar um gasto fecharia o mês debaixo do dedo. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const CEN = require('./cenario').CENARIO;

let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

const abrirLinha = cdp => avaliar(cdp, `
  document.querySelector('.bn-item[data-target="view-fixos"]').click();
  await new Promise(r=>setTimeout(r,400));
  document.getElementById('tab-fixos-linha').click();
  await new Promise(r=>setTimeout(r,700));
  return 1;`);

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await irPara(cdp, 'http://localhost:4173/');
  await avaliar(cdp, CEN);
  await irPara(cdp, 'http://localhost:4173/');
  await esperar(1700);
  await abrirLinha(cdp);

  console.log('\n  \x1b[1mo mês corrente nasce aberto\x1b[0m');
  const inicio = await avaliar(cdp, `
    const at=document.getElementById('month-atual');
    return {aberto:at.classList.contains('aberto'),
      expandido:at.querySelector('.mes-cabeca').getAttribute('aria-expanded'),
      corpoVisivel:!at.querySelector('.mes-corpo').hidden,
      nome:at.querySelector('.mes-nome').textContent.trim()};`);
  conferir(inicio.aberto && inicio.corpoVisivel, `${inicio.nome} abre sozinho`);
  conferir(inicio.expandido === 'true', 'e o leitor de tela sabe disso (aria-expanded)');

  console.log('\n  \x1b[1mabrir e fechar\x1b[0m');
  const alterna = await avaliar(cdp, `
    const outro=[...document.querySelectorAll('.mes-item')].find(i=>i.id!=='month-atual');
    const cab=outro.querySelector('.mes-cabeca');
    const alturaFechada=Math.round(outro.getBoundingClientRect().height);
    cab.click(); await new Promise(r=>setTimeout(r,250));
    const alturaAberta=Math.round(outro.getBoundingClientRect().height);
    const aria1=cab.getAttribute('aria-expanded');
    cab.click(); await new Promise(r=>setTimeout(r,250));
    return {alturaFechada,alturaAberta,aria1,aria2:cab.getAttribute('aria-expanded'),
      voltou:Math.round(outro.getBoundingClientRect().height)};`);
  conferir(alterna.alturaAberta > alterna.alturaFechada + 100,
    `abre (${alterna.alturaFechada}px → ${alterna.alturaAberta}px)`);
  conferir(alterna.voltou === alterna.alturaFechada, `e fecha de volta (${alterna.voltou}px)`);
  conferir(alterna.aria1 === 'true' && alterna.aria2 === 'false', 'aria-expanded acompanha');

  console.log('\n  \x1b[1meditar dentro do mês aberto\x1b[0m');
  const edicao = await avaliar(cdp, `
    const at=document.getElementById('month-atual');
    const campo=at.querySelector('.gasto-valor-input');
    const antes=campo.value;
    const gid=campo.getAttribute('data-gid');
    campo.focus(); campo.value='2.999,90';
    campo.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,700));
    const depois=document.getElementById('month-atual');
    const campo2=depois.querySelector('[data-gid="'+gid+'"].gasto-valor-input');
    return {antes, aindaAberto:depois.classList.contains('aberto'),
      corpoVisivel:!depois.querySelector('.mes-corpo').hidden,
      salvo:campo2?campo2.value:null,
      noDisco:(JSON.parse(localStorage.getItem('financas-data')).faturas
        .flatMap(f=>f.gastos||[]).find(g=>g.id===gid)||{}).valor};`);
  conferir(edicao.aindaAberto && edicao.corpoVisivel,
    'o mês continua aberto depois de salvar',
    'render() remonta a lista; sem guardar o estado fora do DOM, fecharia');
  conferir(edicao.noDisco === 2999.9,
    `"2.999,90" virou 2999.9 no disco (era ${edicao.antes})`,
    'o separador de milhar precisa passar por parseNum()');
  conferir(edicao.salvo === '2.999,90', `e volta formatado no campo (${edicao.salvo})`);

  console.log('\n  \x1b[1ma fatura com nome de cartão comprido\x1b[0m');
  const fatura = await avaliar(cdp, `
    /* so a linha de um mes ABERTO, e rolada pra dentro da tela: elementFromPoint
       responde pelo que esta na viewport, e fora dela devolve outra coisa — foi
       o que fez esta conferencia falhar so as vezes */
    const l=document.querySelector('.mes-item.aberto .mes-fatura');
    if(!l) return null;
    l.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,250));
    const campo=l.querySelector('.mes-fatura-valor');
    const tag=l.querySelector('.mes-cartao-tag');
    const cr=campo.getBoundingClientRect(), tr=tag?tag.getBoundingClientRect():null;
    return {sobrepoe: tr? tr.right>cr.left+1 : false,
      campoVisivel: cr.width>40,
      alvo: document.elementFromPoint(cr.left+cr.width/2, cr.top+cr.height/2)===campo,
      tag: tag?tag.textContent.trim().slice(0,24):'(sem tag)'};`);
  if (fatura) {
    conferir(!fatura.sobrepoe, `a etiqueta "${fatura.tag}…" não passa por cima do campo`);
    conferir(fatura.campoVisivel, 'o campo de valor tem largura de sobra');
    conferir(fatura.alvo, 'e um toque no meio dele acerta o campo, não a etiqueta',
      'era o que estava quebrado: a etiqueta cobria o campo e recebia o clique');
  }

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mA lista se comporta.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
