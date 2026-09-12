/* Quanto tempo entre ABRIR o app e ele perguntar à nuvem pela primeira vez.

   É o número que explica o "demorei pra ver no telefone": setInterval só
   dispara na primeira virada do relógio, então a primeira leitura acontecia
   20 s depois de carregar. E carregar é o que o celular faz quando você volta
   ao app, porque o sistema descarta a página.

   Mede escutando o tráfego pela rede (Network.requestWillBeSent), sem depender
   de nada interno do app. */
'use strict';
const { conectar, avaliar, irPara, esperar } = require('./cdp');

const URL = 'http://localhost:4173/';
const SENHA = 'senha-de-teste-123';
const CODIGO = process.env.AOII_CODIGO || ('ZT' + Date.now().toString(36).toUpperCase().padEnd(10, 'X').slice(0, 10));
let falhas = 0;
const conferir = (c, m, d) => { c ? console.log(`  \x1b[32mok\x1b[0m ${m}`)
  : (falhas++, console.log(`  \x1b[31m!!\x1b[0m ${m}${d ? '\n       ' + d : ''}`)); };

async function ligarSync(cdp, codigo, senha) {
  return avaliar(cdp, `
    document.getElementById('topbar-settings-btn').click();
    await new Promise(r=>setTimeout(r,600));
    document.getElementById('settings-tab-dados').click();
    await new Promise(r=>setTimeout(r,500));
    const campo=document.getElementById('sync-code-input');
    campo.value=${JSON.stringify(codigo)};
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('sync-use-btn').click();
    /* a partir daqui aparecem diálogos em sequência: backup, senha, confirmar.
       Responde a todos por até 12 s, em vez de chutar os tempos. */
    for(let i=0;i<60;i++){
      await new Promise(r=>setTimeout(r,200));
      const sd=document.getElementById('senha-dialog');
      if(sd && sd.style.display==='block'){
        document.getElementById('senha-input').value=${JSON.stringify(senha)};
        const linha2=document.getElementById('senha-linha-2');
        if(linha2 && linha2.style.display!=='none')
          document.getElementById('senha-input-2').value=${JSON.stringify(senha)};
        document.getElementById('senha-ok').click();
        continue;
      }
      const cd=document.getElementById('confirm-dialog');
      if(cd && cd.style.display==='block'){ document.getElementById('confirm-ok').click(); continue; }
    }
    document.getElementById('settings-close-btn')?.click();
    await new Promise(r=>setTimeout(r,500));
    return document.getElementById('sync-status-text')?.textContent||'(sem status)';
  `);
}

(async () => {
  const cdp = await conectar();
  await cdp.enviar('Network.enable');
  await cdp.enviar('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 800, deviceScaleFactor: 1, mobile: true });

  console.log(`\n  código de teste: ${CODIGO}\n`);
  console.log('  \x1b[1mligando a sincronização\x1b[0m');
  await irPara(cdp, URL);
  await avaliar(cdp, `localStorage.clear(); return 1;`);
  await irPara(cdp, URL);
  await esperar(1700);
  await avaliar(cdp, `document.getElementById('ob-skip-btn')?.click(); await new Promise(r=>setTimeout(r,500)); return 1;`);
  await avaliar(cdp, `document.querySelector('.tour-skip')?.click(); await new Promise(r=>setTimeout(r,400)); return 1;`);
  const status = await ligarSync(cdp, CODIGO, SENHA);
  console.log(`     status: ${String(status).slice(0, 78)}`);
  conferir(/em dia|sincroniz/i.test(String(status)), 'a sincronização ligou');
  if (falhas) { process.exit(1); }

  /* agora o que interessa: recarregar e cronometrar a primeira leitura */
  console.log('\n  \x1b[1mabrindo o app e cronometrando a 1ª leitura da nuvem\x1b[0m');
  const medidas = [];
  for (let volta = 1; volta <= 3; volta++) {
    let t0 = 0, primeira = null;
    const ouvir = p => {
      if (primeira !== null || !t0) return;
      if (String(p.request && p.request.url).includes('aoii_get')) primeira = Date.now() - t0;
    };
    cdp.ao('Network.requestWillBeSent', ouvir);
    t0 = Date.now();
    await irPara(cdp, URL);
    for (let i = 0; i < 120 && primeira === null; i++) await esperar(250);
    medidas.push(primeira);
    console.log(`     volta ${volta}: ${primeira === null ? 'não perguntou em 30 s' : (primeira / 1000).toFixed(1) + ' s'}`);
  }

  const pior = Math.max(...medidas.map(m => m === null ? 99999 : m));
  conferir(pior < 8000, `a pior das três voltas: ${(pior / 1000).toFixed(1)} s`,
    'antes da correção eram os 20 s do setInterval');

  console.log(`\n  limpeza: delete from public.financas where id like '${CODIGO}%';`);
  console.log('\n' + '─'.repeat(56));
  console.log(falhas === 0 ? '\x1b[32mPergunta assim que abre.\x1b[0m' : `\x1b[31m${falhas} problema(s).\x1b[0m`);
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
