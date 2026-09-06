#!/usr/bin/env node
/* Servidor local para desenvolver: monta dist/ a cada pedido de página, então
   basta salvar o arquivo em src/ e recarregar o navegador.

     npm run dev            http://localhost:4173
     npm run dev -- 8080    outra porta

   Serve só arquivos de dist/. Sem dependências. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const PORTA = Number(process.argv[2]) || 4173;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

function montar() {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'pipe' });
    return null;
  } catch (e) {
    return String(e.stderr || e.stdout || e.message);
  }
}

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/' || rel.endsWith('/')) rel += 'index.html';

  /* remonta antes de servir a página; os assets não precisam */
  if (rel.endsWith('.html')) {
    const erro = montar();
    if (erro) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('falha no build:\n\n' + erro);
      return;
    }
  }

  const alvo = path.join(DIST, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!alvo.startsWith(DIST)) { res.writeHead(403); res.end('fora de dist/'); return; }
  if (!fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('não achei ' + rel);
    return;
  }
  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(alvo)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(alvo).pipe(res);
}).listen(PORTA, () => {
  const erro = montar();
  if (erro) console.error('build falhou:\n' + erro);
  console.log('Aoii em http://localhost:' + PORTA + '  (Ctrl+C para parar)');
  console.log('edite src/ e recarregue a página — o build roda sozinho');
});
