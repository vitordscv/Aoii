/* Primeira abertura do app, pela interface de verdade: idioma e moeda vindos
   do navegador, padrão de renda, saúde sem nota, data-alvo e fim do tour. */
'use strict';
const { conectar, avaliar, irPara, tirarFoto, esperar } = require('./cdp');

const URL = process.argv[2] || 'http://localhost:4173/';
const IDIOMA = process.argv[3] || 'pt-BR';
const AQUI = __dirname;
let falhas = 0;
const conferir = (cond, msg, detalhe) => {
  if (cond) console.log('  \x1b[32mok\x1b[0m ' + msg);
  else { falhas++; console.log('  \x1b[31m!!\x1b[0m ' + msg + (detalhe ? '\n       ' + detalhe : '')); }
};

/* Espera a condicao acontecer, nao o relogio passar: com a maquina carregada
   qualquer prazo fixo vira aposta. */
async function ate(cdp, expressao, oQue, limite = 12000) {
  const fim = Date.now() + limite;
  while (Date.now() < fim) {
    if (await avaliar(cdp, `return !!(${expressao});`)) return true;
    await esperar(150);
  }
  console.log(`     (${oQue} nao apareceu em ${limite / 1000}s)`);
  return false;
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setUserAgentOverride', {
    userAgent: (await (await fetch('http://127.0.0.1:9222/json/version')).json())['User-Agent'],
    acceptLanguage: IDIOMA,
  });
  /* apaga tudo: é preciso ser a PRIMEIRA abertura */
  /* limpar so o localStorage nao basta: o service worker guarda a pagina, e o
     teste roda contra a versao anterior do app sem nenhum aviso */
  await require('./ajuda').limparAparelho(cdp);
  await irPara(cdp, URL);
  await ate(cdp, `(document.getElementById('onboarding-dialog')||{}).style?.display==='block'`,
    'o assistente');

  console.log(`\n== primeira abertura com navegador em ${IDIOMA} ==`);
  const ob = await avaliar(cdp, `
    const d=document.getElementById('onboarding-dialog');
    return {
      aberto: d && d.style.display==='block',
      titulo: document.getElementById('onboarding-title').textContent,
      idioma: document.getElementById('ob-idioma').value,
      moeda: document.getElementById('ob-moeda').value,
      tipoRenda: document.getElementById('ob-tipo-renda').value,
      primeiraOpcao: document.getElementById('ob-tipo-renda').options[0].textContent,
      rotuloRenda: document.getElementById('ob-renda-label').textContent,
      lang: document.documentElement.lang,
      navegador: navigator.languages.join(','),
    };
  `);
  console.log('  navigator.languages =', ob.navegador);
  conferir(ob.aberto, 'o assistente de primeiro uso abre');
  /* idioma fora dos cinco cai no padrão de casa — mas a MOEDA ainda sai da
     região: quem le o app em portugues na Alemanha continua gastando euro */
  const base = IDIOMA.split('-')[0];
  const esperadoIdioma = ['pt','en','es','fr','it'].includes(base) ? base : 'pt';
  conferir(ob.idioma === esperadoIdioma, `idioma escolhido = "${ob.idioma}"`, `esperava "${esperadoIdioma}"`);
  console.log('     moeda =', ob.moeda, '| título =', JSON.stringify(ob.titulo));
  conferir(ob.tipoRenda === 'mensal', `renda padrão = "${ob.tipoRenda}"`, 'esperava "mensal"');
  conferir(/mensal|mensual|monthly|mensile|mensuel/i.test(ob.primeiraOpcao), `1ª opção = ${JSON.stringify(ob.primeiraOpcao)}`);
  conferir(ob.rotuloRenda === ob.primeiraOpcao, `rótulo do campo acompanha o tipo`, `rótulo=${JSON.stringify(ob.rotuloRenda)}`);
  /* o app declara o idioma do CONTEÚDO, não o de quem lê: o português dele é
     do Brasil, então pt-PT também recebe lang="pt-BR" — e está certo, é o que
     o leitor de tela precisa saber pra pronunciar */
  conferir(ob.lang === (ob.idioma === 'pt' ? 'pt-BR' : ob.idioma), `<html lang="${ob.lang}">`);

  /* o defeito antigo: trocar a moeda chama render(), que reescrevia o rótulo */
  await avaliar(cdp, `
    const m=document.getElementById('ob-moeda');
    const outra=[...m.options].map(o=>o.value).find(v=>v!==m.value);
    m.value=outra; m.dispatchEvent(new Event('change'));
  `);
  await esperar(700);
  const depois = await avaliar(cdp, `return {
    rotulo: document.getElementById('ob-renda-label').textContent,
    tipo: document.getElementById('ob-tipo-renda').value,
  };`);
  conferir(depois.rotulo === ob.rotuloRenda,
    'trocar a moeda não reescreve o rótulo da renda',
    `virou ${JSON.stringify(depois.rotulo)} com o tipo ainda "${depois.tipo}"`);

  await tirarFoto(cdp, AQUI + `/primeirouso-${IDIOMA}.png`);

  console.log('\n== depois de pular o assistente ==');
  await avaliar(cdp, `document.getElementById('ob-skip-btn').click();`);
  await ate(cdp, `document.querySelector('.tour-callout')`, 'o tour');

  const tela = await avaliar(cdp, `
    const saude=document.querySelector('.saude-card');
    const tour=document.querySelector('.tour-callout');
    return {
      saudeTexto: saude?saude.textContent.replace(/\\s+/g,' ').trim():'(sem cartão)',
      temNota: !!document.querySelector('.saude-score'),
      temBarra: !!document.querySelector('.saude-bar-track'),
      dataAlvo: document.getElementById('hero-date-input')?.value,
      hoje: new Date().toISOString().slice(0,10),
      tourAberto: !!tour,
      tourTitulo: tour?tour.querySelector('.tour-callout-title').textContent:null,
      diario: !!document.getElementById('daily-card').innerHTML.trim(),
    };
  `);
  conferir(!tela.temNota && !tela.temBarra, 'saúde financeira não dá nota sem dado');
  console.log('     cartão diz:', JSON.stringify(tela.saudeTexto.slice(0, 110)));
  const dias = Math.round((new Date(tela.dataAlvo) - new Date(tela.hoje)) / 86400000);
  conferir(dias >= 90, `data-alvo ${tela.dataAlvo} = ${dias} dias à frente (mínimo 90)`);
  conferir(tela.diario, 'o cartão "quanto posso gastar hoje" nasce ligado');
  conferir(tela.tourAberto, 'o tour começa depois do assistente', 'tour não abriu');

  if (tela.tourAberto) {
    console.log('\n== tour: passa pelos 5 passos e termina ==');
    console.log('     passo 1:', JSON.stringify(tela.tourTitulo));
    for (let i = 0; i < 5; i++) {
      await avaliar(cdp, `document.querySelector('.tour-next')?.click();`);
      await esperar(500);
    }
    await esperar(900);
    const fim = await avaliar(cdp, `
      const p=document.getElementById('settings-panel');
      const aba=document.getElementById('settings-tab-renda');
      return {
        tourFechado: !document.querySelector('.tour-callout'),
        configAberta: p && p.style.display==='block',
        abaRenda: aba && aba.getAttribute('aria-selected')==='true',
      };
    `);
    conferir(fim.tourFechado, 'o tour fecha ao terminar');
    conferir(fim.configAberta, 'e abre as Configurações, como o último passo manda');
    conferir(fim.abaRenda, 'na aba Renda');
    await tirarFoto(cdp, AQUI + `/fim-do-tour-${IDIOMA}.png`);
  }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mTudo como previsto.\x1b[0m' : `\x1b[31m${falhas} diferença(s).\x1b[0m`);
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
