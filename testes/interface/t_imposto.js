/* ── A tela do imposto, pintada ────────────────────────────────────────────

   O motor do Carnê-Leão tem suíte própria e mede as contas. Aqui se mede a
   outra metade, a que `npm test` não alcança: se a aba existe na navegação, se
   o painel aparece pintado, se o registro de uma diária chega ao resumo com a
   data certa, e se o que vai pra área de transferência é o que o programa da
   Receita pede.

   O dado nasce semeado em `localStorage`, antes de a página carregar: assim o
   teste mede a tela com um mês já fechado, sem depender de vinte cliques pra
   chegar a um bruto que gere imposto. A janela em que o imposto existe é
   estreita — com a redução de 2026, bruto até 5.000 não paga nada. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { APP, titulo, conferir, encerrar, limparAparelho, abrirApp, irParaTela } = require('./ajuda');

/* Um mês com imposto de verdade: 6.000 de bruto dá 407,27 pela tabela de 2026,
   bem acima do mínimo do DARF — então há valor, vencimento e status. */
const SEMEAR = `
  const bruto=JSON.parse(localStorage.getItem('financas-data'));
  bruto.irFontes=[
    {id:'f1',nome:'Financeiro pizzaria',tipo:'mensal',valorPadrao:3000},
    {id:'f2',nome:'Diaria presencial',tipo:'diaria',valorPadrao:250},
  ];
  bruto.transacoes=(bruto.transacoes||[]).concat([
    {id:'ir1',nome:'Financeiro pizzaria',valor:3000,categoria:'Outros',metodo:'pix',
     data:'2026-04-10',tipo:'receita',ir:true,irFonteId:'f1'},
    {id:'ir2',nome:'Diaria presencial',valor:3000,categoria:'Outros',metodo:'pix',
     data:'2026-04-22',tipo:'receita',ir:true,irFonteId:'f2'},
    /* receita NÃO marcada, no mesmo mês: não pode entrar na conta */
    {id:'ir3',nome:'Presente de aniversario',valor:9000,categoria:'Outros',metodo:'pix',
     data:'2026-04-15',tipo:'receita'},
  ]);
  localStorage.setItem('financas-data',JSON.stringify(bruto));
  return 1;`;

/* o painel mostra o mês corrente; o mês semeado é abril/2026 */
const IR_ATE_ABRIL = `
  const label=()=>document.getElementById('ir-mes-label').textContent;
  for(let i=0;i<24;i++){
    if(/2026/.test(label())&&/(Abril|April|Avril|Aprile)/i.test(label())) break;
    document.getElementById('ir-mes-ant').click();
    await new Promise(r=>setTimeout(r,90));
  }
  return label();`;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 390, altura: 844 });
  await avaliar(cdp, SEMEAR);
  await irPara(cdp, APP);
  await esperar(1700);

  titulo('a aba vive dentro de Entradas');
  await irParaTela(cdp, 'entradas', 'tab-entradas-imposto');
  const onde = await avaliar(cdp, `
    const pane=document.getElementById('pane-entradas-imposto');
    const aba=document.getElementById('tab-entradas-imposto');
    pane.scrollIntoView({block:'start'});
    await new Promise(r=>setTimeout(r,250));
    return {existe:!!pane, pintado:pane.offsetParent!==null,
      selecionada:aba.getAttribute('aria-selected'),
      /* tablist de verdade: o painel diz qual aba o nomeia */
      nomeada:pane.getAttribute('aria-labelledby'),
      dentroDeEntradas:!!pane.closest('#view-entradas')};`);
  conferir(onde.existe && onde.pintado,
    'o painel do imposto aparece pintado na tela',
    'estar no DOM não é estar visível');
  conferir(onde.selecionada === 'true', 'e a aba fica marcada como selecionada');
  conferir(onde.nomeada === 'tab-entradas-imposto',
    'o painel aponta pra aba que o nomeia (leitor de tela)');
  conferir(onde.dentroDeEntradas, 'e mora dentro de Entradas, não numa sexta tela');

  titulo('o mês semeado traz data, valor e fonte');
  const mes = await avaliar(cdp, IR_ATE_ABRIL);
  conferir(/2026/.test(mes), `o seletor chegou em ${mes}`);

  const resumo = await avaliar(cdp, `
    return {resumo:document.getElementById('ir-resumo').textContent,
      calculo:document.getElementById('ir-calculo').textContent,
      quantos:document.querySelectorAll('#ir-resumo .ir-receb').length,
      datas:[...document.querySelectorAll('#ir-resumo .ir-receb-data')].map(e=>e.textContent)};`);
  conferir(resumo.quantos === 2,
    `dois recebimentos marcados aparecem (${resumo.quantos})`,
    'o terceiro, sem a marca de IR, não pode entrar');
  conferir(!/anivers/i.test(resumo.resumo),
    'a receita NÃO marcada fica fora',
    'ela vale 9.000: se entrasse, o imposto do mês triplicaria');
  conferir(/Financeiro pizzaria/.test(resumo.resumo) && /Diaria presencial/.test(resumo.resumo),
    'as duas fontes aparecem separadas, como o Carnê-Leão pede');
  conferir(resumo.datas.join(' ').includes('10/04') && resumo.datas.join(' ').includes('22/04'),
    `com a data de cada recebimento (${resumo.datas.join(', ')})`,
    'data e valor é exatamente o que o programa da Receita pede');

  titulo('a conta aparece inteira, não só o resultado');
  conferir(/6\.000,00/.test(resumo.resumo), 'o total tributável do mês');
  conferir(/607,20/.test(resumo.calculo), 'o desconto simplificado usado');
  conferir(/5\.392,80/.test(resumo.calculo), 'a base de cálculo');
  conferir(/407,27/.test(resumo.calculo),
    'e o imposto devido',
    'quem vai digitar isso na Receita responde por ele: a conta tem que estar à vista');

  titulo('o DARF: valor, vencimento e o status que eu marco');
  const darf = await avaliar(cdp, `
    const el=document.getElementById('ir-darf');
    el.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,200));
    return {texto:el.textContent, pintado:el.offsetParent!==null,
      temBotao:!!document.getElementById('ir-darf-toggle')};`);
  conferir(darf.pintado && /407,27/.test(darf.texto), 'o DARF mostra o valor');
  /* 30/04/2026 é quinta e 1º/5 é feriado — mas o vencimento é no mês SEGUINTE
     ao recebimento: 29/05/2026, sexta. */
  conferir(/29\/05\/2026/.test(darf.texto),
    'e o vencimento no último dia útil do mês seguinte',
    '31/05/2026 é domingo: dizer 31 mandaria a pessoa pagar com multa');
  conferir(darf.temBotao, 'com o botão de marcar como pago');

  const marcou = await avaliar(cdp, `
    document.getElementById('ir-darf-toggle').click();
    await new Promise(r=>setTimeout(r,900));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {texto:document.getElementById('ir-darf').textContent,
      gravados:(d.impostoDarfs||[]).length,
      registro:JSON.stringify((d.impostoDarfs||[])[0]||null)};`);
  conferir(marcou.gravados === 1,
    `marcar grava no aparelho (${marcou.registro})`,
    'é a única coisa que o DARF persiste: o valor se recalcula, "eu paguei" não');
  conferir(/2026/.test(marcou.registro) && /"mes":4/.test(marcou.registro),
    'com o ano e o mês certos');

  titulo('a diária em um toque');
  const antes = await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {saldo:d.saldoAtual, quantas:(d.transacoes||[]).filter(t=>t.ir).length};`);
  const depois = await avaliar(cdp, `
    const btn=[...document.querySelectorAll('#ir-fontes-list .ir-lancar')][0];
    btn.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,200));
    btn.click();
    await new Promise(r=>setTimeout(r,1100));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    const nova=(d.transacoes||[]).find(t=>t.ir&&t.irFonteId==='f2'&&t.id!=='ir2');
    return {saldo:d.saldoAtual, quantas:(d.transacoes||[]).filter(t=>t.ir).length,
      nova:JSON.stringify(nova||null)};`);
  conferir(depois.quantas === antes.quantas + 1, 'um toque lança a diária marcada');
  conferir(/"valor":250/.test(depois.nova), 'com o valor padrão da fonte');
  conferir(depois.saldo === antes.saldo + 250,
    'e o saldo sobe, porque esse dinheiro entrou de verdade',
    'diária é diferente da renda fixa derivada, que NÃO pode mexer no saldo');

  titulo('o texto copiado é o que o Carnê-Leão aceita');
  /* As funções do app vivem dentro de um IIFE e não existem no `window` — ler
     `textoCarneLeaoIR` daqui dá ReferenceError, e foi o que a primeira versão
     deste teste fez. O caminho é o real: clicar no botão e ler a área de
     transferência de volta. `127.0.0.1` é origem segura, então a API existe;
     a permissão vem do CDP, porque não há ninguém pra conceder no diálogo. */
  await cdp.enviar('Browser.grantPermissions', {
    origin: new URL(APP).origin,
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  /* `readText()` recusa em documento sem foco, e no headless a aba não tem.
     Permissão concedida não resolve: é outra barreira, e a mensagem diz
     "Document is not focused". */
  await cdp.enviar('Emulation.setFocusEmulationEnabled', { enabled: true });
  try { await cdp.enviar('Page.bringToFront'); } catch (e) { /* headless sem janela */ }
  const copiado = await avaliar(cdp, `
    const btn=document.getElementById('ir-copiar');
    btn.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,200));
    btn.click();
    await new Promise(r=>setTimeout(r,900));
    let texto='';
    try{ texto=await navigator.clipboard.readText(); }catch(e){ texto='ERRO: '+e.message; }
    return {texto, estado:document.getElementById('save-status')?.textContent||''};`);
  conferir(!/^ERRO/.test(copiado.texto),
    'o botão escreve na área de transferência',
    copiado.texto.slice(0, 120));
  const copia = copiado.texto;
  conferir(/^04\/2026/.test(copia), 'começa pelo mês');
  conferir(/10\/04\/2026\t3000,00/.test(copia),
    'cada recebimento em data e valor, separados por tabulação',
    'vírgula decimal e sem símbolo: é o formato que o programa aceita');
  conferir(/6000,00/.test(copia), 'com o total do mês');
  conferir(!/[Ee]stimativa|contador/.test(copia),
    'e sem o aviso de estimativa no meio',
    'isto vai pra um formulário: aviso ali só dá trabalho de apagar');

  titulo('o aviso de estimativa está na TELA');
  const aviso = await avaliar(cdp, `
    const el=document.querySelector('#pane-entradas-imposto .ir-aviso');
    el.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,200));
    return {texto:el.textContent, pintado:el.offsetParent!==null};`);
  conferir(aviso.pintado && /contador/i.test(aviso.texto),
    'o aviso de que é estimativa aparece pintado, e diz do contador');

  titulo('a tabela se edita sem mexer no código');
  const editor = await avaliar(cdp, `
    document.getElementById('ir-abrir-tabela').click();
    await new Promise(r=>setTimeout(r,600));
    const el=document.getElementById('ir-tabela-editor');
    el.scrollIntoView({block:'center'});
    await new Promise(r=>setTimeout(r,250));
    const ultima=[...el.querySelectorAll('.ir-faixa-linha')].pop();
    return {pintado:el.offsetParent!==null,
      faixas:el.querySelectorAll('.ir-faixa-linha').length,
      simplificado:document.getElementById('ir-t-simplificado').value,
      ultimaTravada:ultima.querySelector('.ir-f-ate').disabled};`);
  conferir(editor.pintado, 'o editor abre pintado na tela');
  conferir(editor.faixas === 5, `com as cinco faixas (${editor.faixas})`);
  conferir(editor.simplificado === '607,20',
    `e os valores que estão valendo, com as duas casas (${editor.simplificado})`,
    'a primeira versão mostrava "607,2" — num campo de real isso parece valor truncado');
  conferir(editor.ultimaTravada,
    'o teto da última faixa vem travado',
    'teto na última faixa deixaria quem ganha acima dele sem faixa nenhuma');

  const salvou = await avaliar(cdp, `
    const campo=document.getElementById('ir-t-simplificado');
    campo.value='700,00';
    document.getElementById('ir-t-salvar').click();
    await new Promise(r=>setTimeout(r,1100));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {tabelas:(d.impostoTabelas||[]).length,
      salvo:((d.impostoTabelas||[])[0]||{}).descontoSimplificado,
      calculo:document.getElementById('ir-calculo').textContent};`);
  conferir(salvou.tabelas === 1 && salvou.salvo === 700,
    `a tabela editada é gravada (${salvou.salvo})`);
  conferir(/700,00/.test(salvou.calculo),
    'e o mês passa a ser calculado com ela',
    'a tabela é por ano: editar não pode deixar o cálculo no valor antigo');

  /* O ponto que a pessoa mais quer ver escrito: abaixo do teto nao paga.
     A conta ja estava certa -- a reducao anula o imposto inteiro -- mas a tela
     so mostrava "imposto pela tabela" e "reducao" do mesmo tamanho, deixando a
     subtracao por conta de quem le. Mede nos dois lados do teto, porque uma
     nota que aparece sempre nao prova nada.

     O recarregamento e feito do lado do Node: `location.reload()` dentro de uma
     avaliacao derruba o contexto e a promessa nunca volta. */
  titulo('abaixo do teto a tela diz que nao ha nada a pagar');

  const AO_MES_DE_MARCO = `
    document.querySelector('.bn-item[data-target="view-entradas"]').click();
    await new Promise(r=>setTimeout(r,520));
    document.getElementById('tab-entradas-imposto').click();
    await new Promise(r=>setTimeout(r,520));
    const label=()=>document.getElementById('ir-mes-label').textContent;
    for(let i=0;i<24;i++){
      if(/2026/.test(label())&&/(Março|Marco|March|Mars|Marzo)/i.test(label())) break;
      document.getElementById('ir-mes-ant').click();
      await new Promise(r=>setTimeout(r,100));
    }
    const el=document.getElementById('ir-calculo');
    return {mes:label(),texto:el.textContent,
      nota:!!el.querySelector('.ir-isento-nota')};`;

  const marcoCom = async valor => {
    await avaliar(cdp, `
      const d=JSON.parse(localStorage.getItem('financas-data'));
      d.transacoes=(d.transacoes||[]).filter(t=>t.id!=='isento1').concat([
        {id:'isento1',nome:'Financeiro pizzaria',valor:${valor},
         categoria:'Outros',metodo:'pix',data:'2026-03-10',tipo:'receita',
         ir:true,irFonteId:'f1'}]);
      localStorage.setItem('financas-data',JSON.stringify(d));
      return 1;`);
    await irPara(cdp, APP);
    await esperar(1700);
    return avaliar(cdp, AO_MES_DE_MARCO);
  };

  const abaixo = await marcoCom(4500);
  conferir(/2026/.test(abaixo.mes), `o seletor chegou em ${abaixo.mes}`);
  conferir(abaixo.nota,
    'com 4.500 no mes, a frase aparece',
    'o imposto da zero, mas sem a frase a pessoa faz a subtracao de cabeca');
  conferir(/5\.000,00/.test(abaixo.texto),
    'e ela diz qual e o teto, lido da tabela do ano',
    'teto escrito a mao mentiria no dia em que a tabela mudar');

  const acima = await marcoCom(6000);
  conferir(!acima.nota,
    'com 6.000 no mesmo mes, a frase nao aparece',
    'uma nota que aparece sempre nao informa nada');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
