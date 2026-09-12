/* Procura furos concretos na Linha do tempo: conteúdo que vaza da faixa,
   alvo de toque pequeno, número sem formato, e o tamanho da lista fechada.
   Cenário com onze meses, pra lista encher de verdade. */
'use strict';
const PASTA_FOTOS = require('./fotos').PASTA_FOTOS;
const { conectar, avaliar, irPara, esperar } = require('./cdp');
const fs = require('fs');

const CEN = require('./cenario').CENARIO;

const MAIS_MESES = `
  const bruto=JSON.parse(localStorage.getItem('financas-data'));
  const c1=bruto.cartoes[0].id;
  for(let i=-4;i<=6;i++){
    const d=new Date(2026,8+i,1);
    const ano=d.getFullYear(), mes=d.getMonth()+1;
    if(bruto.faturas.some(f=>f.ano===ano&&f.mes===mes)) continue;
    bruto.faturas.push({id:'f'+ano+'-'+mes,cartaoId:c1,ano,mes,valor:0,pago:i<0,
      gastos: i%3===0 ? [{id:'g'+ano+mes+'a',nome:'Compra do mês '+mes,valor:300+i*17,categoria:'Outros'}] : []});
  }
  localStorage.setItem('financas-data',JSON.stringify(bruto));
  return bruto.faturas.length;
`;

let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });
  await irPara(cdp, 'http://localhost:4173/');
  await avaliar(cdp, CEN);
  const n = await avaliar(cdp, MAIS_MESES);
  console.log(`  cenário com ${n} faturas`);

  for (const [larg, nome] of [[390, 'telefone'], [1280, 'desktop']]) {
    await cdp.enviar('Emulation.setDeviceMetricsOverride',
      { width: larg, height: 844, deviceScaleFactor: 2, mobile: larg < 700 });
    await irPara(cdp, 'http://localhost:4173/');
    await esperar(1700);
    await avaliar(cdp, `
      document.querySelector('.bn-item[data-target="view-fixos"]').click();
      await new Promise(r=>setTimeout(r,400));
      document.getElementById('tab-fixos-linha').click();
      await new Promise(r=>setTimeout(r,700));
      document.getElementById('toggle-passados-btn')?.click();
      await new Promise(r=>setTimeout(r,400));
      return 1;`);

    console.log(`\n\x1b[1m${nome} · ${larg}px\x1b[0m`);

    const r = await avaliar(cdp, `
      const itens=[...document.querySelectorAll('.mes-item')];
      const vaza=[];
      itens.forEach(c=>{
        const cr=c.getBoundingClientRect();
        c.querySelectorAll('*').forEach(el=>{
          const er=el.getBoundingClientRect();
          if(er.width===0) return;
          const excesso=Math.round(Math.max(er.right-cr.right, cr.left-er.left));
          if(excesso>1) vaza.push({
            mes:c.querySelector('.mes-nome').textContent.trim().split(' ')[0],
            classe:(el.className||'').toString().slice(0,34),
            texto:(el.textContent||'').trim().slice(0,30), excesso});
        });
      });
      const fechadas=itens.filter(i=>!i.classList.contains('aberto'))
        .map(i=>Math.round(i.getBoundingClientRect().height));
      /* alvos de toque: conta a ÁREA clicável, que pode vir de ::before/::after */
      const areaDe=el=>{
        const b=el.getBoundingClientRect();
        let w=b.width,h=b.height;
        for(const p of ['::before','::after']){
          const cs=getComputedStyle(el,p);
          if(cs.content&&cs.content!=='none'){
            w=Math.max(w,parseFloat(cs.width)||0); h=Math.max(h,parseFloat(cs.height)||0);
          }
        }
        const pai=el.parentElement;
        if(pai&&pai.tagName==='LABEL'){ const pb=pai.getBoundingClientRect(); w=Math.max(w,pb.width); h=Math.max(h,pb.height); }
        return {w:Math.round(w),h:Math.round(h)};
      };
      const pequenos=[];
      document.querySelectorAll('.mes-item button, .mes-item input[type=checkbox], .mes-add-btn').forEach(el=>{
        const b=el.getBoundingClientRect(); if(!b.width) return;
        const a=areaDe(el);
        if(a.w<32||a.h<32) pequenos.push({classe:(el.className||'').toString().slice(0,28),w:a.w,h:a.h});
      });
      /* dinheiro nos campos: aceita separador de milhar, exige os centavos */
      const crus=[...document.querySelectorAll('.gasto-valor-input,.mes-fatura-valor')]
        .map(i=>i.value).filter(v=>!/^[\\d.,\\s]*\\d,\\d{2}$/.test(v));
      const lista=document.getElementById('month-grid').getBoundingClientRect();
      return {n:itens.length, fechadas, minF:Math.min(...fechadas), maxF:Math.max(...fechadas),
        vaza:vaza.slice(0,6), nVaza:vaza.length, pequenos:pequenos.slice(0,6), nPequenos:pequenos.length,
        crus:crus.slice(0,6), nCrus:crus.length, alturaLista:Math.round(lista.height),
        rolaHorizontal:document.documentElement.scrollWidth>innerWidth+1,
        abertas:itens.filter(i=>i.classList.contains('aberto')).length};
    `);

    console.log(`  ${r.n} meses · ${r.abertas} aberto(s) · lista inteira ${r.alturaLista}px (${(r.alturaLista / 844).toFixed(1)} telas)`);
    conferir(r.maxF - r.minF <= 2, `faixa fechada tem sempre a mesma altura (${r.minF}–${r.maxF}px)`,
      `alturas: ${r.fechadas.join(', ')}`);
    conferir(r.nVaza === 0, 'nada vaza da borda da faixa',
      r.vaza.map(v => `${v.mes}: .${v.classe} "${v.texto}" passa ${v.excesso}px`).join('\n       '));
    conferir(!r.rolaHorizontal, 'a página não rola de lado');
    conferir(r.nPequenos === 0, `${r.nPequenos} alvo(s) com área de toque abaixo de 32px`,
      r.pequenos.map(p => `.${p.classe} ${p.w}×${p.h}`).join('\n       '));
    conferir(r.nCrus === 0, `${r.nCrus} valor(es) sem formato de moeda no campo`, r.crus.join(', '));

    const foto = await cdp.enviar('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${PASTA_FOTOS}/nova-${nome}.png`, Buffer.from(foto.data, 'base64'));
  }
  console.log('\n' + '─'.repeat(54));
  console.log(falhas === 0 ? '\x1b[32mNada encontrado.\x1b[0m' : `\x1b[31m${falhas} ponto(s) a resolver.\x1b[0m`);
  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  cdp.fechar();
  process.exit(0);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
