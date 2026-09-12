/* A seta de um select não pode cair em cima do texto dele.

   O app desenha a própria seta — a do sistema muda de forma e de cor em cada
   navegador — e a regra genérica de `select` reserva 28px à direita para ela.
   Uma regra mais específica que use o ATALHO `padding` apaga essa reserva sem
   avisar: o atalho define os quatro lados. Foi o que aconteceu com o filtro de
   ano da Linha do tempo, onde a seta pousou em cima do "s" de "Todos os anos".

   Nada disso aparece em teste de função, e a auditoria de CSS não vê: a regra
   é válida e a classe existe. Só medindo o texto contra a seta. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { CENARIO } = require('./cenario');
const { APP, titulo, conferir, encerrar, limparAparelho } = require('./ajuda');

const TELAS = ['view-entradas', 'view-fixos', 'view-resumo', 'view-diario', 'view-economias'];

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
  await limparAparelho(cdp);
  await irPara(cdp, APP);
  await avaliar(cdp, CENARIO);
  await irPara(cdp, APP);
  await esperar(1800);

  const achados = await avaliar(cdp, `
    const apertados = [], vistos = new Set();

    function medir(el){
      if(!el.getClientRects().length) return;
      const id = el.id || el.className.toString().slice(0,30);
      if(vistos.has(id)) return;
      const cs = getComputedStyle(el);
      const caixa = el.getBoundingClientRect();

      /* quanto a seta ocupa do lado direito: o desenho mais o respiro ate a
         borda. Sem seta propria, vale a do sistema, que gira em torno de 16px. */
      let seta = 16;
      if(cs.backgroundImage && cs.backgroundImage !== 'none'){
        const tam = parseFloat(cs.backgroundSize) || 14;
        const pos = /right\\s+([\\d.]+)px/.exec(cs.backgroundPosition);
        seta = tam + (pos ? parseFloat(pos[1]) : 8);
      }

      /* a opcao mais comprida e a que aperta */
      const regua = document.createElement('span');
      regua.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + cs.font;
      let maior = '', largura = 0;
      for(const o of el.options){
        regua.textContent = o.text;
        document.body.appendChild(regua);
        const w = regua.getBoundingClientRect().width;
        regua.remove();
        if(w > largura){ largura = w; maior = o.text; }
      }
      const paraOTexto = caixa.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2;
      vistos.add(id);
      if(parseFloat(cs.paddingRight) < seta)
        apertados.push({id, maior:maior.slice(0,28), padRight:Math.round(parseFloat(cs.paddingRight)),
          precisa:Math.round(seta), sobra:Math.round(paraOTexto - largura)});
    }

    for(const tela of ${JSON.stringify(TELAS)}){
      document.querySelector('.bn-item[data-target="'+tela+'"]')?.click();
      await new Promise(r=>setTimeout(r,400));
      document.querySelectorAll('#'+tela+' select').forEach(medir);
      for(const aba of document.querySelectorAll('#'+tela+' .view-tab')){
        aba.click(); await new Promise(r=>setTimeout(r,400));
        document.querySelectorAll('#'+tela+' select').forEach(medir);
      }
    }
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,600));
    document.querySelectorAll('#settings-panel select').forEach(medir);
    for(const t of document.querySelectorAll('.settings-tab')){
      t.click(); await new Promise(r=>setTimeout(r,350));
      document.querySelectorAll('#settings-panel select').forEach(medir);
    }
    return {apertados, quantos: vistos.size};`);

  titulo(`${achados.quantos} selects conferidos, em cinco telas e nas configurações`);
  conferir(achados.apertados.length === 0,
    'nenhum tem a seta por cima do texto',
    achados.apertados.map(a =>
      `#${a.id}  reserva ${a.padRight}px, a seta precisa de ${a.precisa}px  ·  "${a.maior}"`).join('\n       '));

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  encerrar('Toda seta tem o seu lugar.');
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
