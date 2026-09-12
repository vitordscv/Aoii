/* Contraste do texto que fica DIRETO sobre o fundo, sem card atrás.

   `npm run audit` já confere contraste, e aprovou o que estava quebrado: ele
   compara a cor do texto com a cor de fundo DECLARADA no tema. O fundo de
   verdade não é uma cor. É a textura das ondas, que escurece vários tons, e
   com a arte ilustrada é uma imagem inteira — no tema poupa, um nascer do sol
   bege claro por baixo de um tema escuro. A legenda ali dava 1.74 de contraste
   e o título da seção sumia junto, com a auditoria verde.

   Aqui o fundo é FOTOGRAFADO, com o texto escondido, e os pixels lidos são os
   que estavam na tela. Separar letra de papel por brilho dentro de uma foto só
   só funciona enquanto o texto é mais escuro que o fundo; nos temas escuros é
   o contrário, e a conta se inverte sem avisar. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const { CENARIO } = require('./cenario');
const { APP, titulo, conferir, encerrar, limparAparelho } = require('./ajuda');

const TEMAS = ['onda', 'sakura', 'matcha', 'noite', 'poupa', 'grafite', 'roxo'];
const SELETORES = ['.section-note', '.view-tab-sub', '.section-title'];
const MINIMO = 4.5;          // WCAG AA, texto pequeno

function lum([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function razao(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const hx = v => '#' + v.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 900, height: 900, deviceScaleFactor: 1, mobile: false });
  await limparAparelho(cdp);
  await irPara(cdp, APP);
  await avaliar(cdp, CENARIO);

  const piores = [];
  for (const tema of TEMAS) {
    for (const arte of [false, true]) {
      await avaliar(cdp, `
        const d=JSON.parse(localStorage.getItem('financas-data'));
        d.tema='${tema}'; d.fundoIlustrado=${arte};
        localStorage.setItem('financas-data',JSON.stringify(d)); return 1;`);
      await irPara(cdp, APP);
      await esperar(1400);
      await avaliar(cdp, `
        document.querySelector('.bn-item[data-target="view-economias"]')?.click();
        await new Promise(r=>setTimeout(r,450));
        document.getElementById('tab-economias-metas')?.click();
        await new Promise(r=>setTimeout(r,600));
        return 1;`);

      const alvos = await avaliar(cdp, `
        const sels=${JSON.stringify(SELETORES)};
        const achados=[];
        for(const sel of sels){
          const el=[...document.querySelectorAll(sel)].find(e=>e.getClientRects().length&&e.textContent.trim());
          if(!el) continue;
          el.scrollIntoView({block:'center'});
          await new Promise(r=>setTimeout(r,180));
          const r=el.getBoundingClientRect();
          achados.push({sel, cor:getComputedStyle(el).color, x:Math.round(r.left),
            y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)});
        }
        /* esconde SÓ o texto — o papel atrás dele não muda */
        document.querySelectorAll(sels.join(',')).forEach(e=>e.style.visibility='hidden');
        await new Promise(r=>setTimeout(r,120));
        return achados;`);

      const foto = await cdp.enviar('Page.captureScreenshot', { format: 'png' });
      await avaliar(cdp, `
        document.querySelectorAll(${JSON.stringify(SELETORES)}.join(',')).forEach(e=>e.style.visibility='');
        return 1;`);

      /* o próprio Chrome decodifica a foto e devolve os pixels */
      const fundos = await avaliar(cdp, `
        const img=new Image();
        img.src='data:image/png;base64,${foto.data}';
        await img.decode();
        const cv=document.createElement('canvas');
        cv.width=img.width; cv.height=img.height;
        const cx=cv.getContext('2d');
        cx.drawImage(img,0,0);
        return ${JSON.stringify(alvos)}.map(a=>{
          const d=cx.getImageData(a.x,a.y,Math.max(1,a.w),Math.max(1,a.h)).data;
          const px=[];
          for(let i=0;i<d.length;i+=4) px.push([d[i],d[i+1],d[i+2]]);
          px.sort((p,q)=>(p[0]+p[1]+p[2])-(q[0]+q[1]+q[2]));
          /* os dois extremos do papel: a letra pode cair em qualquer um */
          return {sel:a.sel, cor:a.cor,
            claro:px[Math.floor(px.length*0.95)], escuro:px[Math.floor(px.length*0.05)]};
        });`);

      for (const f of fundos) {
        const cor = f.cor.match(/\d+/g).slice(0, 3).map(Number);
        piores.push({ tema, arte, sel: f.sel,
          valor: Math.min(razao(cor, f.claro), razao(cor, f.escuro)),
          texto: hx(cor), fundo: hx(f.claro) + '..' + hx(f.escuro) });
      }
    }
  }

  titulo(`${piores.length} medidas: ${TEMAS.length} temas, com e sem arte de fundo`);
  const ruins = piores.filter(p => p.valor < MINIMO);
  conferir(ruins.length === 0,
    `todo texto sobre o fundo alcança ${MINIMO} de contraste (pior: ${Math.min(...piores.map(p => p.valor)).toFixed(2)})`,
    ruins.map(r => `${r.tema}${r.arte ? ' + arte' : ''}  ${r.sel}  ${r.valor.toFixed(2)}  texto ${r.texto} sobre ${r.fundo}`).join('\n       '));

  /* o caso que originou tudo, dito pelo nome pra não voltar sem ninguém ver */
  const poupa = piores.find(p => p.tema === 'poupa' && p.arte && p.sel === '.section-title');
  conferir(poupa && poupa.valor >= MINIMO,
    `no poupa ilustrado o título da seção continua visível (${poupa ? poupa.valor.toFixed(2) : '?'})`,
    'a arte do poupa é clara e o tema é escuro: sem cores próprias, o título some no fundo');

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  encerrar('O texto sobre o fundo se lê em todos os temas.');
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
