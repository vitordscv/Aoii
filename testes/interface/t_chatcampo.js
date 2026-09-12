/* O campo do chat cresce enquanto se digita, para de crescer no teto, encolhe
   de volta quando o texto sai, e não deixa a folha estourar a tela. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar, tirarFoto } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

/* digita de verdade, pelo teclado: dispara os mesmos eventos de um dedo */
async function digitar(cdp, texto) {
  for (const ch of texto) {
    await cdp.enviar('Input.dispatchKeyEvent', { type: 'char', text: ch });
  }
  await esperar(120);
}

const medir = cdp => avaliar(cdp, `
  const t=document.getElementById('ia-chat-input');
  const linha=document.querySelector('.ia-chat-input-row');
  const folha=document.getElementById('ia-chat-sheet');
  const msgs=document.getElementById('ia-chat-messages');
  const b=t.getBoundingClientRect(), f=folha.getBoundingClientRect();
  return {
    tag:t.tagName, altura:Math.round(b.height), rolaDentro:t.scrollHeight>t.clientHeight+1,
    linhaAltura:Math.round(linha.getBoundingClientRect().height),
    folhaPassaDaTela:Math.round(f.bottom-innerHeight),
    msgsAltura:Math.round(msgs.getBoundingClientRect().height),
    valor:t.value.length, fonte:getComputedStyle(t).fontSize,
  };`);

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
  await irPara(cdp, URL);
  await avaliar(cdp, `
    localStorage.setItem('financas-ia-chave','FALSA-SO-PRA-ABRIR-O-CHAT');
    return 1;`);
  await irPara(cdp, URL);
  await esperar(1600);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,400)); return 1;`);
  await avaliar(cdp, `document.getElementById('ia-chat-fab').click(); await new Promise(r=>setTimeout(r,700)); return 1;`);
  await avaliar(cdp, `document.getElementById('ia-chat-input').focus(); return 1;`);

  const vazio = await medir(cdp);
  console.log(`\n  campo: <${vazio.tag.toLowerCase()}> · fonte ${vazio.fonte} · altura ${vazio.altura}px\n`);
  conferir(vazio.tag === 'TEXTAREA', 'virou textarea');
  conferir(parseFloat(vazio.fonte) >= 16, `fonte ${vazio.fonte} (abaixo de 16 o iOS dá zoom)`);
  conferir(vazio.valor === 0, 'nasce vazio, sem quebra de linha herdada da marcação');

  console.log('  \x1b[1mdigitando\x1b[0m');
  const alturas = [vazio.altura];
  for (const pedaco of [
    'Considerando meu saldo atual ',
    'e as faturas em aberto dos dois cartões, ',
    'eu consigo comprar uma cadeira de escritório de R$ 2.000 ',
    'ainda neste mês sem atrasar o aluguel nem furar a reserva? ',
    'E se não der agora, em qual mês daria?',
  ]) {
    await digitar(cdp, pedaco);
    const m = await medir(cdp);
    alturas.push(m.altura);
    console.log(`     ${String(m.valor).padStart(3)} caracteres → ${m.altura}px` +
      (m.rolaDentro ? '  (rolando dentro)' : '') +
      `   folha passa da tela: ${m.folhaPassaDaTela}px`);
  }

  const cresceu = alturas[alturas.length - 1] > alturas[0];
  conferir(cresceu, `cresceu de ${alturas[0]}px para ${alturas[alturas.length - 1]}px`);

  const ultima = await medir(cdp);
  conferir(ultima.folhaPassaDaTela <= 1, `a folha não estoura a tela (${ultima.folhaPassaDaTela}px)`,
    'o campo crescendo empurrou a folha pra fora');
  conferir(ultima.msgsAltura > 60, `a área de mensagens sobrevive (${ultima.msgsAltura}px)`,
    'o campo comeu o histórico da conversa');
  conferir(ultima.altura <= 140, `parou no teto (${ultima.altura}px)`);
  conferir(ultima.rolaDentro, 'e o excedente rola dentro do campo, sem sumir');

  await tirarFoto(cdp, PASTA_FOTOS + '/chat-campo-crescido.png');

  console.log('\n  \x1b[1mShift+Enter quebra linha, Enter envia\x1b[0m');
  const antesLinhas = (await avaliar(cdp, `return document.getElementById('ia-chat-input').value;`)).split('\n').length;
  /* keyDown COM `text` é o que faz o Chrome inserir o caractere de verdade;
     rawKeyDown só dispara o evento e deixa a inserção por conta do navegador,
     que nesse caminho não acontece. Enter insere '\r', não '\n'. */
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r', modifiers: 8 });
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
  await esperar(300);
  const depoisLinhas = (await avaliar(cdp, `return document.getElementById('ia-chat-input').value;`)).split('\n').length;
  conferir(depoisLinhas > antesLinhas, `Shift+Enter quebrou linha (${antesLinhas} → ${depoisLinhas})`);

  const msgsAntes = await avaliar(cdp, `return document.querySelectorAll('#ia-chat-messages .ia-chat-msg').length;`);
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp.enviar('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await esperar(700);
  const depois = await medir(cdp);
  const msgsDepois = await avaliar(cdp, `return document.querySelectorAll('#ia-chat-messages .ia-chat-msg').length;`);
  conferir(msgsDepois > msgsAntes, `Enter enviou (${msgsAntes} → ${msgsDepois} mensagens)`);
  conferir(depois.valor === 0, 'o campo esvaziou');
  conferir(depois.altura === vazio.altura,
    `e voltou à altura de uma linha (${depois.altura}px, era ${vazio.altura}px)`,
    'ficou grande com o campo vazio — é aqui que esse tipo de campo costuma falhar');

  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mO campo acompanha o que se escreve.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
