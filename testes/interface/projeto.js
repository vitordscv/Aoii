/* Onde o projeto esta, pra quem precisa mexer num arquivo de verdade.

   Dois testes editam a fonte pra simular uma publicacao nova e conferir que o
   app percebe. Caminho absoluto num teste so funciona na maquina de quem o
   escreveu — este se resolve a partir da propria pasta. */
'use strict';
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const SRC_HTML = path.join(RAIZ, 'src', 'index.html');
const DIST_HTML = path.join(RAIZ, 'dist', 'index.html');

module.exports = { RAIZ, SRC_HTML, DIST_HTML };
