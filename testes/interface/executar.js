#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Roda a suíte de interface: o app de verdade, num navegador de verdade.

     npm run ui                  roda tudo
     npm run ui -- cache fontes  roda só quem tem "cache" ou "fontes" no nome
     npm run ui -- --ver         mostra o navegador em vez de escondê-lo

   A suíte do motor (`npm test`) mede as contas. Esta mede o que só existe
   depois que o navegador desenha: se um elemento cobre outro, se o alvo do
   toque é grande o bastante, quantos bytes uma abertura custa, se a rolagem
   encadeia, se o cache serve a página certa. São coisas que nenhum teste de
   função pega, e que quebraram de verdade neste projeto — cada arquivo aqui
   nasceu de um defeito real.

   Sobe o servidor de desenvolvimento e o Chrome sozinha, e derruba os dois no
   fim. Só precisa do Chrome instalado — nenhuma dependência de npm.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const PORTA_APP = 4173;
const PORTA_CHROME = 9222;
const PERFIL = path.join(os.tmpdir(), 'aoii-ui-perfil');

const alvos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const mostrar = process.argv.includes('--ver');

/* Onde o Chrome costuma estar. Não vale inventar: sem navegador, a suíte não
   tem o que medir, e dizer isso é mais útil do que falhar por outro motivo. */
function acharChrome() {
  const daVariavel = process.env.AOII_CHROME;
  if (daVariavel && fs.existsSync(daVariavel)) return daVariavel;
  const candidatos = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe',
       'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
       path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
       'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
       '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
       '/snap/bin/chromium'];
  return candidatos.find(c => fs.existsSync(c)) || null;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function responde(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch (e) { /* subindo */ }
    await esperar(250);
  }
  return false;
}

async function main() {
  const arquivos = fs.readdirSync(__dirname)
    .filter(f => f.startsWith('t_') && f.endsWith('.js'))
    .filter(f => !alvos.length || alvos.some(a => f.includes(a)))
    .sort();

  if (!arquivos.length) {
    console.error(alvos.length ? 'nenhum teste casa com: ' + alvos.join(', ') : 'nenhum teste em testes/interface/');
    process.exit(1);
  }

  const chrome = acharChrome();
  if (!chrome) {
    console.error('Não achei o Chrome. Instale-o, ou aponte o caminho em AOII_CHROME.');
    process.exit(1);
  }

  const aMatar = [];
  const derrubar = () => aMatar.forEach(p => { try { p.kill(); } catch (e) {} });
  process.on('exit', derrubar);
  process.on('SIGINT', () => { derrubar(); process.exit(130); });

  /* o servidor remonta a cada pedido, então a suíte sempre mede o src atual */
  if (!(await responde(`http://127.0.0.1:${PORTA_APP}/`, 1))) {
    console.log(`  subindo o servidor em :${PORTA_APP}`);
    aMatar.push(spawn(process.execPath, [path.join(RAIZ, 'scripts', 'dev.js')],
      { cwd: RAIZ, stdio: 'ignore', detached: false }));
    if (!(await responde(`http://127.0.0.1:${PORTA_APP}/`))) {
      console.error('o servidor não subiu'); process.exit(1);
    }
  } else {
    console.log(`  usando o servidor que já está em :${PORTA_APP}`);
  }

  if (!(await responde(`http://127.0.0.1:${PORTA_CHROME}/json/version`, 1))) {
    console.log(`  subindo o navegador${mostrar ? '' : ' (escondido)'}`);
    /* perfil próprio: a suíte mexe em localStorage, caches e service workers,
       e nada disso pode encostar no navegador de quem está rodando */
    fs.rmSync(PERFIL, { recursive: true, force: true });
    const args = [`--remote-debugging-port=${PORTA_CHROME}`, `--user-data-dir=${PERFIL}`,
      '--no-first-run', '--no-default-browser-check', 'about:blank'];
    if (!mostrar) args.unshift('--headless=new');
    aMatar.push(spawn(chrome, args, { stdio: 'ignore', detached: false }));
    if (!(await responde(`http://127.0.0.1:${PORTA_CHROME}/json/version`))) {
      console.error('o navegador não subiu'); process.exit(1);
    }
  } else {
    console.log(`  usando o navegador que já está em :${PORTA_CHROME}`);
  }

  console.log(`\n  ${arquivos.length} arquivo(s)\n${'─'.repeat(58)}`);
  const falharam = [];
  for (const f of arquivos) {
    const nome = f.replace(/^t_|\.js$/g, '');
    process.stdout.write(`\n\x1b[1m▸ ${nome}\x1b[0m\n`);
    try {
      execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit', timeout: 180000 });
    } catch (e) {
      falharam.push(nome);
    }
  }

  console.log('\n' + '─'.repeat(58));
  if (falharam.length) {
    console.log(`\x1b[31m\x1b[1m${falharam.length} de ${arquivos.length} falharam:\x1b[0m ${falharam.join(', ')}`);
    derrubar();
    process.exit(1);
  }
  console.log(`\x1b[32m\x1b[1m${arquivos.length} arquivo(s), tudo passou.\x1b[0m`);
  derrubar();
  process.exit(0);
}

main().catch(e => { console.error('a suíte de interface falhou:', e.message); process.exit(1); });
