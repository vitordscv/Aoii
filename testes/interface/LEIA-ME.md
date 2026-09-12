# Suíte de interface

O app de verdade, num navegador de verdade.

```bash
npm run ui                  # tudo
npm run ui -- cache fontes  # só quem tem "cache" ou "fontes" no nome
npm run ui -- --ver         # mostra o navegador em vez de escondê-lo
```

Sobe o servidor e o Chrome sozinha e derruba os dois no fim. Precisa do Chrome
instalado e de mais nada — sem Puppeteer, sem Playwright, sem `node_modules`.
Se o Chrome estiver num lugar incomum, aponte em `AOII_CHROME`.

## Por que existe, além de `npm test`

`npm test` mede as contas: dado este `data`, quanto sobra em dezembro. É a
suíte que protege o dinheiro, e é a que você roda o tempo todo.

Ela não pode ver o que só existe depois que o navegador desenha. Estes furos
passaram por ela sem despertar nada, e todos são reais:

| o que quebrou | o que a suíte do motor via |
|---|---|
| a etiqueta do cartão cobria o campo de valor da fatura e recebia o clique | nada: os valores estavam certos |
| o app rebaixava 1,2 MB a cada abertura, mesmo sem nada ter mudado | nada: não é conta |
| o cache guardava a fita de cotações sob a chave da página | nada: só aparecia offline |
| onze meses davam 12.992 px de altura no telefone | nada: os totais batiam |
| quatro contas fixas exibindo "R$ 0,00" no mês corrente | nada: zero era o valor certo do campo errado |
| rolar sobre o pano de fundo levava a página 1.112 px | nada |

Cada arquivo aqui nasceu de um defeito que chegou a existir. Nenhum foi
escrito por completude.

## Como um teste é feito

```js
const { conectar } = require('./cdp');
const { titulo, conferir, encerrar, limparAparelho, abrirApp, irParaTela } = require('./ajuda');

(async () => {
  const cdp = await conectar();
  await limparAparelho(cdp);        // o service worker guarda a página: sem isto,
  await abrirApp(cdp);              // o teste mede a versão anterior do app
  await irParaTela(cdp, 'diario');

  titulo('o que se está medindo');
  const visto = await avaliar(cdp, `
    const el = document.querySelector('...');
    return { largura: el.getBoundingClientRect().width };`);
  conferir(visto.largura > 100, 'a coisa cabe na tela', 'detalhe de quando falha');

  encerrar('frase pro caso de tudo passar');
})().catch(e => { console.error('falhou:', e.message); process.exit(1); });
```

`avaliar()` roda o texto dentro da página e devolve o que ele retornar, já
serializado. Dá pra usar `await` lá dentro.

## Armadilhas que já custaram tempo

**Medir o que não está pintado.** Um elemento dentro de `<details>` fechado, ou
numa aba que não está aberta, tem caixa de layout e responde `getBoundingClientRect()`
com números plausíveis — mas não é pintado nem recebe clique. Abra a aba e o
`<details>` antes de medir, ou use `elementFromPoint`.

**Achar que um elemento é pequeno demais.** Vários alvos ganham área de toque
por `::before`/`::after` sem mudar o tamanho desenhado. Meça a área clicável,
não a caixa visível — ver `areaDe()` em `t_linha_furos.js`.

**`:focus-visible` não liga com `.focus()`.** Para conferir o anel de foco, mande
um Tab de verdade por `Input.dispatchKeyEvent`.

**`navigator.onLine` não segue `Network.emulateNetworkConditions`.** O app pode
estar certo e a asserção errada.

**A página nem sempre começa em `scrollY = 0`.** O Chrome restaura a rolagem da
navegação anterior. Compare com a posição de partida, não com zero.

**Sem dados, o app abre no onboarding** — e aí o hero não existe, nem a
navegação de baixo em alguns momentos. `abrirApp()` já cuida disso; se você
quiser justamente a primeira experiência, passe `{cenario:false}`.

**O Diário mostra 10 por vez.** Contar o que está na tela mede a paginação, não
o filtro.
