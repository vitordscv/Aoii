/* ── Nada pode vazar da folha nem da janela ────────────────────────────────

   Este arquivo nasceu de um defeito de verdade, e a história explica por que
   ele varre o app inteiro em vez de conferir um campo só.

   Pôr um `.mini-check` dentro de uma `.sheet-field` fez o quadradinho de marcar
   esticar para a largura toda. As duas regras têm a MESMA especificidade:

       .mini-check input            { width: 15px }
       .sheet-field input, …select  { width: 100% }

   Empate se decide pela ordem do arquivo, e a segunda vinha depois. O rótulo
   "Conta para o IR (Carnê-Leão)" foi junto para fora da folha, que ganhou
   rolagem horizontal e mostrava "Co…" numa faixa bege — um campo que, na
   prática, tinha sumido da tela.

   `npm test` não via nada disso: as contas estavam certas. Só o navegador
   desenhando mostra um elemento ocupando o lugar de outro.

   Duas medidas, as duas sem citar nenhum campo pelo nome:

   1. **Nenhuma caixa de marcar passa de 24px.** É o detector exato deste
      defeito, e pega qualquer regra futura que estique uma por acidente.
   2. **Nenhuma tela rola na horizontal.** O app é de celular; rolagem lateral
      na página é sempre conteúdo escapando, nunca desenho.

   Conferir por geometria, e não por nome de classe, é o que faz o teste
   continuar valendo quando alguém acrescentar a décima folha. */
'use strict';
const { conectar, avaliar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp } = require('./ajuda');

/* Mostra cada folha só o tempo de medir e devolve como estava. Medir folha
   escondida não serve: elemento com `display:none` não tem caixa, e o defeito
   é justamente de caixa. */
const CAIXAS_ESTICADAS = `
  const esticadas=[];
  document.querySelectorAll('.bottom-sheet').forEach(s=>{
    const antes=s.style.display;
    s.style.display='block';
    s.querySelectorAll('input[type=checkbox],input[type=radio]').forEach(i=>{
      const w=Math.round(i.getBoundingClientRect().width);
      if(w>24) esticadas.push({onde:s.id,id:i.id||'(sem id)',w});
    });
    s.style.display=antes;
  });
  document.querySelectorAll('input[type=checkbox],input[type=radio]').forEach(i=>{
    if(i.closest('.bottom-sheet')) return;
    const w=Math.round(i.getBoundingClientRect().width);
    if(w>24) esticadas.push({onde:'tela',id:i.id||'(sem id)',w});
  });
  return {quantas:document.querySelectorAll('input[type=checkbox],input[type=radio]').length,
    esticadas};`;

/* O que a folha mostra tem que caber nela. Tudo que passa da borda direita é
   conteúdo que a pessoa não alcança. */
const VAZAM_DA_FOLHA = `
  const fora=[];
  document.querySelectorAll('.bottom-sheet').forEach(s=>{
    const antes=s.style.display;
    s.style.display='block';
    const sr=s.getBoundingClientRect();
    s.querySelectorAll('*').forEach(el=>{
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden') return;
      const r=el.getBoundingClientRect();
      if(r.width===0&&r.height===0) return;
      const passa=Math.round(r.right-sr.right);
      if(passa>1) fora.push({folha:s.id,
        el:el.tagName.toLowerCase()+(el.id?'#'+el.id:''),passa,
        txt:(el.textContent||'').trim().slice(0,24)});
    });
    s.style.display=antes;
  });
  return {folhas:document.querySelectorAll('.bottom-sheet').length,fora};`;

/* Toda tela, toda aba. O app tem cinco telas e abas dentro de quatro delas —
   percorrer na mão deixaria de fora justamente a que ninguém olha. */
const VARRER_TELAS = `
  const esperar=ms=>new Promise(r=>setTimeout(r,ms));
  const vistos=[], vazam=[];
  for(const t of ['resumo','entradas','fixos','economias','diario']){
    document.querySelector('.bn-item[data-target="view-'+t+'"]')?.click();
    await esperar(550);
    const abas=[...document.querySelectorAll('#view-'+t+' .view-tab')];
    for(const aba of (abas.length?abas:[null])){
      if(aba){ aba.click(); await esperar(420); }
      const nome=t+(aba?'/'+aba.getAttribute('data-pane'):'');
      vistos.push(nome);
      const sobra=document.documentElement.scrollWidth-document.documentElement.clientWidth;
      if(sobra>0) vazam.push({tela:nome,sobra});
    }
  }
  return {vistos,vazam};`;

(async () => {
  const cdp = await conectar();
  /* No celular, que é onde o app vive e onde o espaço aperta. */
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await limparAparelho(cdp);
  await abrirApp(cdp, { largura: 390, altura: 844 });

  titulo('nenhuma caixa de marcar está esticada');
  const caixas = await avaliar(cdp, CAIXAS_ESTICADAS);
  conferir(caixas.quantas > 10,
    `há ${caixas.quantas} caixas de marcar para conferir`,
    'se este número cair muito, a varredura parou de achar as folhas');
  conferir(caixas.esticadas.length === 0,
    'todas no tamanho de caixa de marcar',
    caixas.esticadas.map(e => `${e.onde}:${e.id} tem ${e.w}px`).join(' · ')
      || 'width:100% de um campo de texto pegando o checkbox vizinho');

  titulo('nada vaza para fora da folha');
  const folhas = await avaliar(cdp, VAZAM_DA_FOLHA);
  conferir(folhas.folhas >= 7, `${folhas.folhas} folhas conferidas`);
  conferir(folhas.fora.length === 0,
    'tudo cabe dentro da folha que o contém',
    folhas.fora.map(f => `${f.folha} → ${f.el} passa ${f.passa}px ("${f.txt}")`).join(' · '));

  titulo('nenhuma tela rola na horizontal');
  const telas = await avaliar(cdp, VARRER_TELAS);
  conferir(telas.vistos.length >= 12,
    `${telas.vistos.length} telas e abas percorridas`);
  conferir(telas.vazam.length === 0,
    'nenhuma pede rolagem lateral',
    telas.vazam.map(v => `${v.tela} sobra ${v.sobra}px`).join(' · '));

  /* A largura de tablet é onde a folha deixa de ocupar a tela toda e vira
     caixa centrada — foi nessa faixa que o defeito apareceu primeiro. */
  titulo('e o mesmo vale na largura em que a folha vira caixa centrada');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 700, height: 880, deviceScaleFactor: 2, mobile: false });
  await avaliar(cdp, 'window.dispatchEvent(new Event("resize")); await new Promise(r=>setTimeout(r,500)); return 1;');
  const largo = await avaliar(cdp, VAZAM_DA_FOLHA);
  conferir(largo.fora.length === 0,
    'nada vaza da folha a 700px',
    largo.fora.map(f => `${f.folha} → ${f.el} passa ${f.passa}px ("${f.txt}")`).join(' · '));
  const caixasLargo = await avaliar(cdp, CAIXAS_ESTICADAS);
  conferir(caixasLargo.esticadas.length === 0,
    'e nenhuma caixa de marcar estica',
    caixasLargo.esticadas.map(e => `${e.onde}:${e.id} tem ${e.w}px`).join(' · '));

  await cdp.enviar('Emulation.clearDeviceMetricsOverride');
  encerrar();
})();
