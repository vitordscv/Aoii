/* ── A folha de lançamento não pode achar que tudo é gasto ──────────────────

   Ela nasceu só para gasto; "Entrada inesperada" foi encaixada depois, e o que
   ficou para trás foi um punhado de lugares ainda falando de saída. O mais
   visível: o botão continuava dizendo "Lançar gasto" depois de escolher
   Entrada — só o título mudava.

   Cada conferência aqui corresponde a um desses lugares. */
'use strict';
const { conectar, avaliar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp } = require('./ajuda');

const abrirFolha = `
  const fab=document.getElementById('gasto-fab')||document.querySelector('.fab-add');
  fab.click();
  await new Promise(r=>setTimeout(r,700));`;

const escolher = tipo => `
  document.querySelector('.gasto-tipo-btn[data-tipo="${tipo}"]').click();
  await new Promise(r=>setTimeout(r,300));`;

const lerTela = `
  const vis=el=>!!el&&el.offsetParent!==null;
  const pm=m=>document.querySelector('.pay-method-btn[data-metodo="'+m+'"]');
  return {
    titulo:document.getElementById('gasto-sheet-title').textContent.trim(),
    botao:document.getElementById('gasto-sheet-submit').textContent.trim(),
    rotuloForma:document.getElementById('gasto-forma-label').textContent.trim(),
    debito:pm('debito')?pm('debito').textContent.trim():'',
    temPix:vis(pm('pix')),
    temCredito:vis(pm('credito')),
    temViagem:vis(document.getElementById('gasto-viagem-field')),
    temDividir:vis(document.querySelector('.gasto-dividir-toggle')),
    alerta:vis(document.getElementById('gasto-alerta-media')),
    descricao:document.getElementById('gasto-descricao').placeholder,
    nota:document.getElementById('gasto-nota').placeholder,
  };`;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 900, deviceScaleFactor: 2, mobile: false });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 430, altura: 900 });

  /* três gastos na mesma categoria: é o que acorda o alerta de "acima da média" */
  await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    d.viagens=[{id:'v1',nome:'Praia',orcamento:1000}];
    d.transacoes=[
      {id:'a',nome:'Feira',valor:50,categoria:'Mercado',metodo:'debito',data:'2026-09-01'},
      {id:'b',nome:'Feira',valor:60,categoria:'Mercado',metodo:'debito',data:'2026-09-02'},
      {id:'c',nome:'Feira',valor:55,categoria:'Mercado',metodo:'debito',data:'2026-09-03'}];
    localStorage.setItem('financas-data',JSON.stringify(d));
    location.reload();
    return 1;`);
  await avaliar(cdp, 'await new Promise(r=>setTimeout(r,2500)); return 1;');

  titulo('o modo gasto continua como era');
  const gasto = await avaliar(cdp, abrirFolha + lerTela);
  conferir(/[Gg]asto/.test(gasto.botao), `o botão diz gasto ("${gasto.botao}")`);
  conferir(/pagamento|Forma/i.test(gasto.rotuloForma), 'e o rótulo fala de pagamento');
  conferir(gasto.temPix && gasto.temCredito, 'com Pix e Crédito à mão');
  conferir(gasto.temDividir, 'e dá pra dividir com alguém');

  titulo('escolhendo Entrada, a folha para de falar de saída');
  const entrada = await avaliar(cdp, escolher('receita') + lerTela);

  conferir(!/[Gg]asto/.test(entrada.botao),
    `o botão deixa de dizer "gasto" ("${entrada.botao}")`,
    'só o título mudava; o botão continuava "✓ Lançar gasto"');
  conferir(/[Ee]ntrada/.test(entrada.titulo), `o título acompanha ("${entrada.titulo}")`);
  conferir(!/pagamento/i.test(entrada.rotuloForma),
    `"Forma de pagamento" some ("${entrada.rotuloForma}")`,
    'dinheiro que entra não é pago por ninguém');
  conferir(!/[Dd]ébito/.test(entrada.debito),
    `"Débito" vira outra coisa ("${entrada.debito}")`,
    'débito é como se paga; entrada cai na conta');
  conferir(!entrada.temPix,
    'Pix some: ele e "na conta" acabam no mesmo lugar',
    'pedir uma escolha que não muda nada é pedir por pedir');
  conferir(!entrada.temCredito, 'Crédito some: não se recebe no cartão');
  conferir(!entrada.temViagem,
    'Viagem some',
    'gastoDaViagem() soma só gasto — o campo existia e não fazia nada');
  conferir(!entrada.temDividir, 'e não há o que rachar numa entrada');
  conferir(!/gasto/i.test(entrada.descricao) && !/gasto/i.test(entrada.nota),
    `os exemplos deixam de falar de gasto ("${entrada.descricao}")`);

  titulo('o alerta de "acima da média" não vale pra entrada');
  const comValor = await avaliar(cdp, `
    /* R$ 3.000 numa categoria cuja média de GASTO é 55 */
    document.querySelector('.cat-pill[data-cat="Mercado"]').click();
    const v=document.getElementById('gasto-valor');
    v.value='3000';
    v.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    const el=document.getElementById('gasto-alerta-media');
    const naEntrada=!!el&&el.offsetParent!==null;
    ${escolher('gasto')}
    v.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,400));
    const noGasto=!!el&&el.offsetParent!==null;
    return {naEntrada,noGasto,texto:el?el.textContent.trim():''};`);
  conferir(!comValor.naEntrada,
    'receber R$ 3.000 não vira aviso de gasto alto',
    'o alerta compara com a média dos GASTOS: numa entrada ele acusava boa notícia');
  conferir(comValor.noGasto,
    `mas no modo gasto o alerta continua funcionando ("${comValor.texto.slice(0, 44)}")`);

  titulo('e a entrada entra como entrada');
  const salvou = await avaliar(cdp, `
    ${escolher('receita')}
    const antes=JSON.parse(localStorage.getItem('financas-data'));
    const saldoAntes=antes.saldoAtual||0, vivoAntes=antes.dinheiroVivo||0;
    document.getElementById('gasto-valor').value='1200';
    document.getElementById('gasto-descricao').value='Venda do celular';
    document.getElementById('gasto-sheet-submit').click();
    await new Promise(r=>setTimeout(r,1000));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    const nova=(d.transacoes||[]).find(t=>t.nome==='Venda do celular');
    return {tipo:nova?nova.tipo:null, metodo:nova?nova.metodo:null,
      subiuNaConta:Math.round(((d.saldoAtual||0)-saldoAntes)*100)/100,
      mexeuNoVivo:Math.round(((d.dinheiroVivo||0)-vivoAntes)*100)/100};`);
  conferir(salvou.tipo === 'receita', 'fica gravada como receita');
  conferir(salvou.metodo === 'debito',
    `com o método que cai na conta ("${salvou.metodo}")`);
  conferir(salvou.subiuNaConta === 1200 && salvou.mexeuNoVivo === 0,
    `e os R$ 1.200 entram na conta, sem tocar no dinheiro vivo (conta +${salvou.subiuNaConta}, vivo ${salvou.mexeuNoVivo})`);

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
