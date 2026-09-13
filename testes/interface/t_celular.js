/* Dois clássicos de celular:
   1. campo com fonte < 16px faz o iOS dar zoom sozinho ao focar, e a página
      fica torta depois — o projeto já corrigiu isso uma vez (b629f2a);
   2. toque duplo num botão de salvar cria dois registros. Dedo escorrega,
      rede lenta, e a pessoa toca de novo achando que não pegou. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

const BASE = require('./cenario').SIMPLES;

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });

  /* ── 1. fonte dos campos ── */
  console.log('\n\x1b[1mFonte dos campos (iOS dá zoom abaixo de 16px)\x1b[0m');
  await irPara(cdp, URL);
  await avaliar(cdp, BASE);
  await irPara(cdp, URL);
  await esperar(1500);

  const campos = await avaliar(cdp, `
    /* abre tudo que tem formulário pra pegar os campos escondidos também */
    document.getElementById('gasto-fab').click();
    await new Promise(r=>setTimeout(r,400));
    const vistos=[];
    document.querySelectorAll('input,select,textarea').forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.width===0||r.height===0) return;
      if(el.type==='hidden'||el.type==='checkbox'||el.type==='radio'||el.type==='color'||el.type==='file') return;
      const px=parseFloat(getComputedStyle(el).fontSize);
      if(px<16) vistos.push({id:el.id||el.className.toString().slice(0,26), tipo:el.type||el.tagName, px});
    });
    document.getElementById('gasto-sheet-cancel').click();
    return vistos;
  `);
  conferir(campos.length === 0, `nenhum campo abaixo de 16px na folha de gasto`,
    campos.map(c => `${c.id} (${c.tipo}) ${c.px}px`).join(' · '));

  const camposConfig = await avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,500));
    const vistos=[];
    for(const aba of ['renda','cartoes','categorias','preferencias','dados','ia','zona']){
      document.getElementById('settings-tab-'+aba).click();
      await new Promise(r=>setTimeout(r,220));
      document.querySelectorAll('#settings-panel input,#settings-panel select,#settings-panel textarea').forEach(el=>{
        const r=el.getBoundingClientRect();
        if(r.width===0||r.height===0) return;
        if(['hidden','checkbox','radio','color','file'].includes(el.type)) return;
        const px=parseFloat(getComputedStyle(el).fontSize);
        if(px<16 && !vistos.some(v=>v.id===(el.id||''))) vistos.push({aba, id:el.id||el.className.toString().slice(0,24), px});
      });
    }
    document.getElementById('settings-close-btn').click();
    return vistos;
  `);
  conferir(camposConfig.length === 0, `nenhum campo abaixo de 16px nas Configurações`,
    camposConfig.map(c => `${c.aba}/${c.id} ${c.px}px`).join(' · '));

  /* ── 2. toque duplo no salvar ── */
  console.log('\n\x1b[1mToque duplo no botão de salvar\x1b[0m');
  for (const caso of [
    { nome: 'gasto no Diário', abrir: `document.getElementById('gasto-fab').click();`,
      preencher: `document.getElementById('gasto-valor').value='31,00';
                  document.getElementById('gasto-valor').dispatchEvent(new Event('input',{bubbles:true}));
                  document.getElementById('gasto-descricao').value='Duplo';`,
      botao: 'gasto-sheet-submit', lista: 'transacoes' },
    { nome: 'meta',
      abrir: `document.querySelector('.bn-item[data-target="view-economias"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-economias-metas').click();`,
      preencher: `document.getElementById('metas-nome').value='Duplo';
                  document.getElementById('metas-valor').value='500';`,
      botao: 'metas-add', lista: 'metas' },
    { nome: 'entrada extra',
      abrir: `document.querySelector('.bn-item[data-target="view-entradas"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-entradas-extras').click();`,
      preencher: `document.getElementById('extras-nome').value='Duplo';
                  document.getElementById('extras-valor').value='200';`,
      botao: 'extras-add', lista: 'entradasExtras' },
    { nome: 'divida',
      abrir: `document.querySelector('.bn-item[data-target="view-entradas"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-entradas-dividas').click();`,
      preencher: `document.getElementById('dividas-nome').value='Duplo';
                  document.getElementById('dividas-valor').value='300';`,
      botao: 'dividas-add', lista: 'dividas' },
    { nome: 'compra planejada',
      abrir: `document.querySelector('.bn-item[data-target="view-entradas"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-entradas-compras').click();`,
      preencher: `document.getElementById('purchases-nome').value='Duplo';
                  document.getElementById('purchases-valor').value='400';`,
      botao: 'purchases-add', lista: 'comprasPlanejadas' },
    { nome: 'renda recorrente',
      abrir: `document.querySelector('.bn-item[data-target="view-entradas"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-entradas-rendas').click();
              await new Promise(r=>setTimeout(r,300));
              document.getElementById('rr-new-btn').click();`,
      preencher: `document.getElementById('rr-valor').value='1000';
                  document.getElementById('rr-valor').dispatchEvent(new Event('input',{bubbles:true}));
                  document.getElementById('rr-nome').value='Duplo';
                  document.getElementById('rr-dia').value='5';`,
      botao: 'rr-sheet-submit', lista: 'rendasRecorrentes' },
    { nome: 'cartão',
      abrir: `document.getElementById('topbar-settings-btn').click();
              await new Promise(r=>setTimeout(r,500));
              document.getElementById('settings-tab-cartoes').click();
              await new Promise(r=>setTimeout(r,300));
              document.getElementById('cartao-new-btn').click();`,
      preencher: `document.getElementById('cartao-nome').value='Duplo';
                  document.getElementById('cartao-fechamento').value='10';`,
      botao: 'cartao-sheet-submit', lista: 'cartoes', base: 1 },
    { nome: 'categoria',
      abrir: `document.getElementById('topbar-settings-btn').click();
              await new Promise(r=>setTimeout(r,500));
              document.getElementById('settings-tab-categorias').click();`,
      preencher: `document.getElementById('categoria-nova-nome').value='Duplicada';`,
      botao: 'categoria-add-btn', lista: 'categorias', base: 6 },
    { nome: 'viagem',
      abrir: `document.getElementById('topbar-settings-btn').click();
              await new Promise(r=>setTimeout(r,500));
              document.getElementById('settings-tab-categorias').click();`,
      preencher: `document.getElementById('viagem-nova-nome').value='Duplicada';`,
      botao: 'viagem-add-btn', lista: 'viagens' },
    { nome: 'gasto fixo',
      abrir: `document.querySelector('.bn-item[data-target="view-fixos"]').click();
              await new Promise(r=>setTimeout(r,400));
              document.getElementById('tab-fixos-contas').click();
              await new Promise(r=>setTimeout(r,300));
              document.getElementById('gf-new-btn').click();`,
      preencher: `document.getElementById('gf-valor').value='80';
                  document.getElementById('gf-valor').dispatchEvent(new Event('input',{bubbles:true}));
                  document.getElementById('gf-nome').value='Duplo';
                  document.getElementById('gf-dia').value='9';`,
      botao: 'gf-sheet-submit', lista: 'gastosMensais' },
  ]) {
    await irPara(cdp, URL);
    await avaliar(cdp, BASE);
    await irPara(cdp, URL);
    await esperar(1400);
    const r = await avaliar(cdp, `
      ${caso.abrir}
      await new Promise(r=>setTimeout(r,600));
      ${caso.preencher}
      /* conta ANTES do toque: numero fixo aqui quebra toda vez que a lista
         padrao do app muda, e o teste passa a falhar por motivo que nao e o
         dele -- foi o que aconteceu quando "Assinaturas" entrou */
      const antes=(JSON.parse(localStorage.getItem('financas-data')).${caso.lista}||[]).length;
      const b=document.getElementById('${caso.botao}');
      b.click(); b.click();                       /* dois toques seguidos */
      await new Promise(r=>setTimeout(r,1000));
      const depois=(JSON.parse(localStorage.getItem('financas-data')).${caso.lista}||[]).length;
      return {antes,depois};
    `);
    const esperado=r.antes+1;
    conferir(r.depois === esperado,
      `${caso.nome.padEnd(18)} dois toques → ${r.antes} virou ${r.depois}, esperado ${esperado}`,
      r.depois > esperado ? 'duplicou — quem toca duas vezes fica com dois registros iguais' : 'não salvou nada');
  }

  console.log('\n' + '─'.repeat(52));
  console.log(falhas === 0 ? '\x1b[32mSem armadilha de celular.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
