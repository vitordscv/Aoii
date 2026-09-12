/* Onde as fotos dos testes caem.

   Vários testes tiram uma foto do que mediram — é o que transforma "a faixa
   tem 67px" em algo que dá pra conferir com os olhos quando o número
   surpreende. Elas ficam fora do git: são saída, não fonte. */
'use strict';
const fs = require('fs');
const path = require('path');

const PASTA_FOTOS = path.join(__dirname, 'fotos');
fs.mkdirSync(PASTA_FOTOS, { recursive: true });

module.exports = { PASTA_FOTOS };
