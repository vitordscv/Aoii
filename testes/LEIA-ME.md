# Testes do Aoii

Suíte que trava o comportamento do motor financeiro — a parte do app que
decide números. Se algum cálculo mudar sem querer, isso aqui acusa.

## Como rodar

```bash
node testes/executar.js   # testes do motor financeiro
node testes/auditar.js    # auditorias estruturais do arquivo
```

Sem dependências, sem instalar nada. Só Node.

Para testar outra versão do arquivo (por exemplo, comparar com um backup):

```bash
node testes/executar.js caminho/para/outro-index.html
```

Sai com código 0 se tudo passar e 1 se algo falhar — dá pra plugar em CI
sem mudar nada.

## Como funciona

O app é um arquivo único empacotado: a página real vive como uma string
JSON dentro de `<script type="__bundler/template">` no `index.html`.

- **`extrair-motor.js`** desempacota esse texto e recorta as funções de
  cálculo pelo nome, contando chaves.
- **`ambiente.js`** roda essas funções num contexto isolado com a data de
  "hoje" congelada em **05/09/2026** (um sábado) — sem isso os testes
  mudariam de resultado a cada dia. Também substitui por versões simples
  o que só serve pra desenhar na tela (`L`, `formatBRL`, `uid`…).
- **`executar.js`** é o runner: conta acertos, mostra o que falhou e
  devolve o código de saída.

Os testes leem o `index.html` de verdade. Não existe cópia do motor pra
sair de sincronia.

## O que está coberto

| arquivo | assunto |
|---|---|
| `motor.test.js` | linha do tempo com vários cartões, hero × gráfico × linha do tempo, sugestão de "melhor mês pra comprar", gasto variável, médias mensais |
| `entrada.test.js` | leitura de número digitado (`1.234,56`, `5.400`, formato inglês, entradas inválidas) |
| `datas.test.js` | dia 29–31 em mês curto, dias trabalhados, dias de folga, mês já encerrado |
| `listas.test.js` | entrada × gasto, desfazer do Diário, parcelamento fechando a soma, aporte de meta, média da fatura |
| `auditar.js` | integridade do arquivo empacotado, cobertura das 5 traduções, contraste dos 7 temas, classes de CSS órfãs, ids repetidos, `getElementById` apontando pra nada |

## Por que estes casos

Cada teste corresponde a um bug que já existiu no app. A ideia não é
cobrir linha por linha — é impedir que os erros conhecidos voltem.

Alguns exemplos do que está travado aqui:

- com mais de um cartão a renda do mês era contada uma vez **por cartão**;
- `parseFloat("1.234,56")` lia **1,234** — um Note de R$ 5.400 virava R$ 5,40;
- `new Date(2027,1,31)` não é 31 de fevereiro, é **3 de março**;
- uma "entrada inesperada" era somada como **gasto** em 15 lugares;
- R$ 100 em 3x somava **R$ 99,99**;
- desfazer a remoção de uma entrada descontava o valor **duas vezes**;
- o aporte automático de meta criava dinheiro do nada no patrimônio.

## Ao mexer no app

Rode a suíte antes de publicar. Se um teste falhar e a mudança for
proposital, ajuste o teste junto — mas ajuste conscientemente, porque
cada um desses números já esteve errado uma vez.

## E a suíte de interface

`testes/interface/` roda o app num navegador de verdade, por CDP, e mede o que
esta suíte aqui não alcança: se um elemento cobre outro, o tamanho do alvo de
toque, quantos bytes uma abertura custa, se a rolagem encadeia, se o cache serve
a página certa.

```bash
npm run ui
```

Fica fora do `npm run check` de propósito: precisa do Chrome instalado, e o
`check` tem que rodar em qualquer lugar. Detalhes em
[interface/LEIA-ME.md](interface/LEIA-ME.md).
