/* A integração com o Pierre, do botão até o Diário.

   A API de verdade exige uma chave que abre extrato bancário, então a resposta
   é dublada: o teste troca o `fetch` da página por um que devolve o que o
   Pierre devolveria. O que se mede é o caminho do app — o que a tela mostra
   antes de gravar, o que grava, e o que faz na segunda vez.

   O formato do dublê veio da documentação deles, não de invenção:
   `get-accounts` devolve `balance`/`type`/`connectorName` (nomes conferidos
   contra a API de verdade, com chave real), e
   `get-transactions` devolve `amount` com sinal, `type` DEBIT/CREDIT, `date`,
   `category` e `description`. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { CENARIO } = require('./cenario');
const { APP, titulo, conferir, encerrar, limparAparelho, abrirApp } = require('./ajuda');

/* troca o fetch só para /api/pierre; o resto do app continua com o de verdade */
const DUBLE = `
  window.__pierreChamadas=[];
  const fetchReal=window.fetch;
  window.fetch=async function(entrada,init){
    const url=String(entrada&&entrada.url||entrada||'');
    if(!url.includes('/api/pierre')) return fetchReal.apply(this,arguments);
    window.__pierreChamadas.push({url, auth:(init&&init.headers&&init.headers.Authorization)||''});
    const rota=new URL(url,location.origin).searchParams.get('rota');
    if(rota==='get-bills'){
      return new Response(JSON.stringify({success:true,count:2,data:[
        {accountId:'a2',dueDate:'2026-08-28',billClosingDate:'2026-08-21',totalAmount:1200.00},
        {accountId:'a2',dueDate:'2026-07-28',billClosingDate:'2026-07-21',totalAmount:900.00},
      ]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(rota==='get-installments'){
      return new Response(JSON.stringify({success:true,data:{purchases:[
        {purchaseDate:'2026-06-20',totalAmount:300,installments:[
          {installmentNumber:1,totalInstallments:3,amount:100,dueDate:'2026-08-20',isPaid:true,status:'POSTED',description:'Fone'},
          {installmentNumber:2,totalInstallments:3,amount:100,dueDate:'2026-10-20',isPaid:false,status:'PENDING',description:'Fone'},
          {installmentNumber:3,totalInstallments:3,amount:100,dueDate:'2026-11-20',isPaid:false,status:'PENDING',description:'Fone'},
        ]}]}}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    const corpo = rota==='get-accounts' ? {
      success:true, count:3, data:[
        {id:'a1',connectorName:'Nubank',name:'Conta',customName:null,type:'BANK',
         subtype:'CHECKING_ACCOUNT',balance:'2500.75',currencyCode:'BRL',itemIsActive:true},
        {id:'a2',connectorName:'Nubank',name:'Cartao',customName:null,type:'CREDIT',
         subtype:'CREDIT_CARD',balance:'1800.00',currencyCode:'BRL',itemIsActive:true},
        {id:'a3',connectorName:'Inter',name:'Poupanca',customName:null,type:'BANK',
         subtype:'SAVINGS',balance:'500.00',currencyCode:'BRL',itemIsActive:true},
      ]} : {
      success:true, count:4, data:[
        {id:'px1',description:'Padaria do Ze',amount:-42.9,type:'DEBIT',date:'2026-09-10',
         category:'Alimentação',status:'POSTED',account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'},
        {id:'px2',description:'Salario',amount:5000,type:'CREDIT',date:'2026-09-05',
         category:'Outros',status:'POSTED',account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'},
        {id:'px3',description:'Notebook',amount:-2500,type:'DEBIT',date:'2026-09-08',
         category:'Outros',status:'POSTED',account_type:'CREDIT',account_subtype:'CREDIT_CARD'},
        {id:'px4',description:'Uber',amount:-18.5,type:'DEBIT',date:'2026-09-11',
         category:'Transporte',status:'POSTED',account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'},
        {id:'px5',description:'TIM Celular',amount:-129.99,type:'DEBIT',date:'2026-08-05',
         category:'Telecomunicação',status:'POSTED',account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'},
        {id:'px6',description:'TIM Celular',amount:-129.99,type:'DEBIT',date:'2026-09-05',
         category:'Telecomunicação',status:'POSTED',account_type:'BANK',account_subtype:'CHECKING_ACCOUNT'},
      ]};
    return new Response(JSON.stringify(corpo),{status:200,headers:{'Content-Type':'application/json'}});
  };
  return 1;`;

const abrirPainel = cdp => avaliar(cdp, `
  document.getElementById('topbar-settings-btn').click();
  await new Promise(r=>setTimeout(r,600));
  document.getElementById('settings-tab-banco').click();
  await new Promise(r=>setTimeout(r,500));
  const bloco=document.getElementById('pierre-bloco');
  bloco.scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r,250));
  /* pintado de verdade, e nao so presente no DOM: o painel mora na aba
     Banco, e clicar nela tem que ser o caminho que funciona */
  return {visivel:bloco.offsetParent!==null,
    aba:bloco.closest('.settings-pane').id};`);

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 430, height: 860, deviceScaleFactor: 2, mobile: false });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 430, altura: 860 });
  await avaliar(cdp, DUBLE);
  titulo('o painel tem aba própria');
  const ondeEsta = await abrirPainel(cdp);
  conferir(ondeEsta.aba === 'settings-pane-banco',
    `o painel mora na aba Banco (${ondeEsta.aba})`);
  conferir(ondeEsta.visivel,
    'e clicar na aba o deixa pintado na tela',
    'estar no DOM não é estar visível: o teste antigo passava com o painel escondido');

  titulo('a integração nasce desligada');
  const inicio = await avaliar(cdp, `
    return {ligado:document.getElementById('pierre-ativo-check').checked,
      camposVisiveis:document.getElementById('pierre-campos').style.display!=='none'};`);
  conferir(!inicio.ligado && !inicio.camposVisiveis,
    'sem interruptor ligado, nada de campo de chave na tela');

  titulo('a chave só vai pro disco se a pessoa pedir');
  await avaliar(cdp, `
    const c=document.getElementById('pierre-ativo-check');
    c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,600));
    const campo=document.getElementById('pierre-chave-input');
    campo.value='sk-teste00000000000000000000000000';
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    await new Promise(r=>setTimeout(r,300));
    return 1;`);
  const ondeMora = await avaliar(cdp, `
    const campo=document.getElementById('pierre-chave-input');
    return {tipo:campo.type,
      naSessao:!!sessionStorage.getItem('financas-pierre-chave'),
      noDisco:!!localStorage.getItem('financas-pierre-chave'),
      noObjeto:JSON.stringify(JSON.parse(localStorage.getItem('financas-data'))).includes('sk-teste')};`);
  conferir(ondeMora.tipo === 'password', 'o campo esconde a chave');
  conferir(ondeMora.naSessao && !ondeMora.noDisco,
    'ela fica na sessão, e não no disco');
  conferir(!ondeMora.noObjeto, 'e fora do objeto que vai pro backup e pra nuvem');

  titulo('o caminho até a chave aparece antes do campo');
  const tutorial = await avaliar(cdp, `
    const passos=[...document.querySelectorAll('.pierre-passos li')];
    const campo=document.getElementById('pierre-chave-input');
    const lista=document.querySelector('.pierre-passos');
    return {quantos:passos.length,
      /* quem ainda não tem a chave precisa ler o caminho ANTES de olhar
         pro campo vazio, não depois de rolar até o fim */
      antesDoCampo:lista.getBoundingClientRect().top<campo.getBoundingClientRect().top,
      pintado:lista.offsetParent!==null,
      links:[...document.querySelectorAll('.pierre-passos a')].map(a=>a.getAttribute('href'))};`);
  conferir(tutorial.quantos === 4, `os quatro passos estão lá (${tutorial.quantos})`);
  conferir(tutorial.pintado && tutorial.antesDoCampo,
    'e vêm acima do campo da chave');
  conferir(tutorial.links.includes('https://pierre.finance/api-key'),
    'com o link direto da página da chave',
    'mandar a pessoa "procurar no site" é o mesmo que não explicar');

  titulo('verificar a chave lista o que existe do outro lado');
  await avaliar(cdp, `
    document.getElementById('pierre-verificar-btn').click();
    await new Promise(r=>setTimeout(r,900)); return 1;`);
  const verificou = await avaliar(cdp, `
    const e=document.getElementById('pierre-estado');
    return {texto:e.textContent, ok:e.classList.contains('pierre-ok'),
      syncVisivel:document.getElementById('pierre-sync-btn').style.display!=='none',
      mandouChave:(window.__pierreChamadas[0]||{}).auth||''};`);
  conferir(verificou.ok && /3/.test(verificou.texto),
    `diz quantas contas vieram: "${verificou.texto}"`);
  conferir(/Nubank/.test(verificou.texto) && /Inter/.test(verificou.texto),
    'e de quais instituições');
  conferir(/^Bearer sk-/.test(verificou.mandouChave), 'a chave viajou no cabeçalho');
  conferir(verificou.syncVisivel, 'e o botão de sincronizar aparece');

  titulo('sincronizar mostra o plano ANTES de gravar');
  const antesDoPlano = await avaliar(cdp, `
    const d=JSON.parse(localStorage.getItem('financas-data'));
    document.getElementById('pierre-sync-btn').click();
    await new Promise(r=>setTimeout(r,1200));
    const p=document.getElementById('pierre-plano');
    const dep=JSON.parse(localStorage.getItem('financas-data'));
    return {texto:p.textContent, visivel:!p.hidden,
      transacoesAntes:(d.transacoes||[]).length,
      transacoesDepois:(dep.transacoes||[]).length,
      saldoAntes:d.saldoAtual, saldoDepois:dep.saldoAtual};`);
  conferir(antesDoPlano.visivel, 'o plano aparece');
  conferir(antesDoPlano.transacoesAntes === antesDoPlano.transacoesDepois
    && antesDoPlano.saldoAntes === antesDoPlano.saldoDepois,
    'e nada foi gravado ainda',
    'mexer no extrato antes de mostrar o que vai mudar não é opção');
  conferir(/3/.test(antesDoPlano.texto), 'diz quantos lançamentos entram (3 de banco)');
  conferir(/cart/i.test(antesDoPlano.texto),
    'e avisa que a compra no cartão fica de fora',
    'sem esse aviso, a pessoa acha que sumiu');

  titulo('confirmar traz para o Diário');
  const depois = await avaliar(cdp, `
    const botoes=[...document.querySelectorAll('#pierre-plano button')];
    botoes[0].click();
    await new Promise(r=>setTimeout(r,1200));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    const vindas=(d.transacoes||[]).filter(t=>t.idExterno);
    return {quantas:vindas.length, saldo:d.saldoAtual,
      temCartao:vindas.some(t=>t.idExterno==='px3'),
      receita:(vindas.find(t=>t.idExterno==='px2')||{}).tipo,
      gasto:(vindas.find(t=>t.idExterno==='px1')||{}).tipo,
      valorGasto:(vindas.find(t=>t.idExterno==='px1')||{}).valor,
      categoria:(vindas.find(t=>t.idExterno==='px1')||{}).categoria,
      sincronizadoEm:!!d.pierreSincronizadoEm};`);
  conferir(depois.quantas === 5, `os cinco de banco entraram (${depois.quantas})`);
  conferir(!depois.temCartao, 'a compra no cartão NÃO entrou',
    'ela já conta dentro da fatura: entrar aqui dobraria o mesmo real');
  conferir(depois.receita === 'receita' && depois.gasto === 'gasto',
    'CREDIT virou receita e DEBIT virou gasto');
  conferir(depois.valorGasto === 42.9, `o valor entrou positivo (${depois.valorGasto})`);
  conferir(depois.categoria === 'Mercado', `"Alimentação" virou "${depois.categoria}"`);
  conferir(depois.saldo === 3000.75,
    `o saldo virou a soma das contas de BANCO (${depois.saldo})`,
    'somar o cartão daria um número que não existe em lugar nenhum');
  conferir(depois.sincronizadoEm, 'e ficou registrado quando foi');

  titulo('sincronizar de novo não duplica');
  await avaliar(cdp, `
    document.getElementById('pierre-sync-btn').click();
    await new Promise(r=>setTimeout(r,1200)); return 1;`);
  const segunda = await avaliar(cdp, `
    const p=document.getElementById('pierre-plano');
    const botoes=[...p.querySelectorAll('button')];
    const rotulo=botoes[0].textContent;
    botoes[0].click();
    await new Promise(r=>setTimeout(r,900));
    const d=JSON.parse(localStorage.getItem('financas-data'));
    return {texto:p.textContent||'', rotulo,
      quantas:(d.transacoes||[]).filter(t=>t.idExterno).length};`);
  conferir(segunda.quantas === 5, `continua com cinco (${segunda.quantas})`,
    'sem o id externo, cada sincronização dobraria o extrato');

  titulo('escolher o que sincroniza');
  {
    /* as contas aparecem depois de verificar a chave, uma caixa cada */
    const contas = await avaliar(cdp, `
      const linhas=[...document.querySelectorAll('.pierre-conta')];
      return {quantas:linhas.length,
        todasMarcadas:linhas.every(l=>l.querySelector('input').checked),
        bloco:document.getElementById('pierre-escolhas').style.display!=='none',
        nomes:linhas.map(l=>l.querySelector('.pierre-conta-nome').textContent)};`);
    conferir(contas.quantas === 3, `as três contas aparecem para escolher (${contas.quantas})`);
    conferir(contas.todasMarcadas, 'e todas vêm marcadas: nada escolhido quer dizer tudo');
    conferir(contas.nomes.some(n => /Nubank/.test(n)) && contas.nomes.some(n => /Inter/.test(n)),
      'com o banco no rótulo, pra dar pra distinguir');

    /* desmarca a conta do Inter: os lançamentos dela e o saldo dela saem */
    const escolhido = await avaliar(cdp, `
      const linhas=[...document.querySelectorAll('.pierre-conta')];
      const inter=linhas.find(l=>/Inter/.test(l.querySelector('.pierre-conta-nome').textContent));
      const marca=inter.querySelector('input');
      marca.checked=false; marca.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,500));
      return (JSON.parse(localStorage.getItem('financas-data')).pierreContas||[]);`);
    conferir(escolhido.length === 2, `a escolha fica guardada (${escolhido.length} contas)`);

    /* desliga o saldo e sincroniza: o plano tem que dizer isso */
    const plano = await avaliar(cdp, `
      const s=document.getElementById('pierre-saldo-check');
      s.checked=false; s.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,500));
      const saldoAntes=JSON.parse(localStorage.getItem('financas-data')).saldoAtual;
      document.getElementById('pierre-sync-btn').click();
      await new Promise(r=>setTimeout(r,1400));
      const p=document.getElementById('pierre-plano');
      return {texto:p.textContent, saldoAntes,
        guardado:JSON.parse(localStorage.getItem('financas-data')).pierreTrazerSaldo};`);
    conferir(plano.guardado === false, 'desligar o saldo fica guardado');
    conferir(/[Ss]aldo est/.test(plano.texto),
      'e o plano avisa que o saldo não vem',
      'mudar a escolha sem dizer o efeito deixa a pessoa no escuro');

    /* confirma e confere que o saldo NAO mudou */
    const depoisDoPlano = await avaliar(cdp, `
      const b=[...document.querySelectorAll('#pierre-plano button')];
      if(!b[0].disabled) b[0].click();
      await new Promise(r=>setTimeout(r,1000));
      return JSON.parse(localStorage.getItem('financas-data')).saldoAtual;`);
    conferir(depoisDoPlano === plano.saldoAntes,
      `o saldo ficou como estava (${depoisDoPlano})`,
      'desligar o saldo e ele mudar assim mesmo é pior que não ter a opção');

    /* volta o saldo pra não atrapalhar o resto do teste */
    await avaliar(cdp, `
      const s=document.getElementById('pierre-saldo-check');
      s.checked=true; s.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(r=>setTimeout(r,400)); return 1;`);
  }

  titulo('cartão e gastos fixos, quando ligados');
  {
    /* os três nascem desligados: são os que mexem em projeção */
    const inicio = await avaliar(cdp, `
      return {cartao:document.getElementById('pierre-cartao-check').checked,
        fixos:document.getElementById('pierre-fixos-check').checked,
        abrir:document.getElementById('pierre-abrir-check').checked};`);
    conferir(!inicio.cartao && !inicio.fixos && !inicio.abrir,
      'as três opções novas nascem desligadas',
      'ligar sozinho mudaria a projeção de alguém sem aviso');

    const guardou = await avaliar(cdp, `
      for(const id of ['pierre-cartao-check','pierre-fixos-check']){
        const e=document.getElementById(id);
        e.checked=true; e.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(r=>setTimeout(r,300));
      }
      const d=JSON.parse(localStorage.getItem('financas-data'));
      return {cartao:d.pierreTrazerCartao,fixos:d.pierreTrazerFixos};`);
    conferir(guardou.cartao === true && guardou.fixos === true,
      'e ficam guardadas quando ligadas');

    const antesDosFixos = await avaliar(cdp, `
      return (JSON.parse(localStorage.getItem('financas-data')).gastosMensais||[]).length;`);

    const plano = await avaliar(cdp, `
      document.getElementById('pierre-sync-btn').click();
      await new Promise(r=>setTimeout(r,2200));
      const p=document.getElementById('pierre-plano');
      const marcas=[...p.querySelectorAll('#pierre-fixos-lista input')];
      return {texto:p.textContent,
        fixosOferecidos:marcas.length,
        algumMarcado:marcas.some(m=>m.checked),
        rotas:window.__pierreChamadas.map(c=>new URL(c.url,location.origin).searchParams.get('rota'))};`);
    conferir(plano.rotas.includes('get-bills') && plano.rotas.includes('get-installments'),
      'ligado o cartão, a busca pede faturas e parcelas');
    conferir(/[Ll]imite/.test(plano.texto),
      'o plano mostra o cartão com limite');
    conferir(plano.fixosOferecidos >= 1,
      `a conta que se repetiu virou sugestão (${plano.fixosOferecidos})`);
    conferir(!plano.algumMarcado,
      'nenhuma sugestão vem marcada',
      'conta fixa errada vira despesa fantasma em todo mês seguinte');

    /* confirmar sem marcar nada: cartão entra, gasto fixo não.
       O cenário já vem com cartões e faturas próprios — "Nubank Ultravioleta"
       e "Itaú" —, então o que importa aqui é a DIFERENÇA, não o total. */
    const depois = await avaliar(cdp, `
      const b=[...document.querySelectorAll('#pierre-plano button')];
      if(!b[0].disabled) b[0].click();
      await new Promise(r=>setTimeout(r,1200));
      const d=JSON.parse(localStorage.getItem('financas-data'));
      const doPierre=(d.cartoes||[]).filter(c=>c.idExterno);
      const ids=new Set(doPierre.map(c=>c.id));
      const delas=(d.faturas||[]).filter(f=>ids.has(f.cartaoId));
      const passadas=delas.filter(f=>f.ano*12+f.mes<2026*12+9);
      return {cartoes:(d.cartoes||[]).length,
        doPierre:doPierre.length,
        faturasDoCartao:delas.length,
        passadas:passadas.length,
        passadasPagas:passadas.filter(f=>f.pago).length,
        fixos:(d.gastosMensais||[]).length};`);
    conferir(depois.doPierre === 1,
      `um cartão veio do Pierre (${depois.doPierre} de ${depois.cartoes})`,
      'o id externo é o que impede criar outro a cada sincronização');
    conferir(depois.faturasDoCartao >= 4,
      `as faturas dele entraram (${depois.faturasDoCartao})`);
    conferir(depois.passadasPagas === depois.passadas && depois.passadas > 0,
      `fatura de mês que já passou entra paga (${depois.passadasPagas} de ${depois.passadas})`,
      'sem isso computeCartao() soma o histórico como dívida e o limite fica negativo');
    conferir(depois.fixos === antesDosFixos,
      `e nenhum gasto fixo foi criado, porque nada foi marcado (${depois.fixos})`);
  }

  titulo('desligar a integração apaga a chave');
  await avaliar(cdp, `
    const c=document.getElementById('pierre-ativo-check');
    c.checked=false; c.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,700)); return 1;`);
  const desligado = await avaliar(cdp, `
    return {naSessao:!!sessionStorage.getItem('financas-pierre-chave'),
      noDisco:!!localStorage.getItem('financas-pierre-chave'),
      campo:(document.getElementById('pierre-chave-input')||{}).value,
      lancamentos:(JSON.parse(localStorage.getItem('financas-data')).transacoes||[]).filter(t=>t.idExterno).length};`);
  conferir(!desligado.naSessao && !desligado.noDisco && !desligado.campo,
    'a chave some dos dois lugares e da tela',
    `sessao=${desligado.naSessao} disco=${desligado.noDisco} campo=${JSON.stringify(desligado.campo)}`);
  conferir(desligado.lancamentos === 5,
    'mas o que já veio para o Diário fica',
    'apagar lançamentos ao desligar seria apagar o registro da pessoa');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  encerrar('A integração traz o extrato sem duplicar nem contar duas vezes.');
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
