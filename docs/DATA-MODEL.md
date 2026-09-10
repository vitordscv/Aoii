# Modelo de dados

Tudo vive num objeto só, `data`, declarado em `src/data/state.js` e gravado em
`localStorage` sob a chave `financas-data` como JSON.

## Versão e validação

O schema atual é **1**, declarado em `src/data/schema.js` e gravado em
`data.schemaVersion`. Backup salvo por uma versão futura (número maior) é
recusado inteiro, em vez de lido pela metade.

Todo dado que entra passa por `adotarDadosDeFora()`
(`src/data/validation.js`), nesta ordem:

1. **`validateAndNormalizeData()`** — recusa o que não é objeto, o que passa de
   5 MB, o que aninha fundo demais e o que vem de uma versão futura. Depois
   reconstrói o objeto campo a campo a partir do esquema: o que não está
   declarado é descartado, número impossível vira o padrão, texto é aparado no
   limite, opção fora da lista cai no padrão e id fora do formato aceito é
   trocado (com as referências seguindo junto).
2. **`migrateData()`** — a parte histórica: formato antigo virando novo, faturas
   duplicadas se fundindo, campo que ganhou padrão depois.
3. **validação de novo**, agora sobre o resultado da migração. Isso deixa a
   ordem das chaves estável (a sincronização compara JSON como texto) e submete
   ao esquema também o que a migração escreveu.

Consequência prática para quem programa: **campo novo precisa estar nos três
lugares** — `schema.js` (senão é descartado ao entrar), `defaultData()` e
`migrateData()`. Campo que só existe em dois dos três é perdido silenciosamente
no primeiro backup importado.

O quarto lugar é este arquivo. Ele não muda o comportamento de nada, mas é
onde se lê por que um campo existe — e é o primeiro a ser esquecido.

Ao mudar a forma de um campo já existente, suba `SCHEMA_VERSAO` e escreva a
migração para o formato anterior em `migrateData()`.

Quando o dado local não é aceito (formato do futuro, arquivo corrompido), o app
não apaga: guarda o original em `localStorage['financas-data-recusado']`, com o
motivo em `financas-data-recusado-motivo`, e começa do zero.

## Raiz

### Dinheiro parado

| campo | tipo | significado |
|---|---|---|
| `saldoAtual` | número | o que está na conta, informado à mão |
| `saldoAtualizadoEm` | ISO | quando foi informado |
| `dinheiroVivo` | número | dinheiro em espécie |
| `dinheiroVivoAtualizadoEm` | ISO | quando foi informado |

`saldoAtual + dinheiroVivo` é o ponto de partida da projeção.

### Renda

| campo | tipo | significado |
|---|---|---|
| `tipoRenda` | `'diaria'` \| `'mensal'` | como a pessoa recebe |
| `rendaDiaria` | número | valor de um dia de trabalho |
| `diasTrabalho` | número[] | dias da semana trabalhados, 0=domingo |
| `diasNaoTrabalhados` | ISO[] | folgas avulsas, descontadas da contagem |
| `rendaMensal` | `{valor, diaDoMes}` | salário e o dia em que cai |
| `rendasRecorrentes` | lista | outras fontes fixas (ver abaixo) |

### Projeção

| campo | tipo | significado |
|---|---|---|
| `dataAlvo` | ISO | até quando a projeção olha; alimenta o hero |
| `patrimonioHistorico` | `{ano, mes, valor}[]` | uma foto por mês |

### Reserva de emergência

| campo | tipo | significado |
|---|---|---|
| `reservaGuardado` | número | quanto já existe |
| `reservaMeses` | número | quantos meses de custo essencial é a meta |
| `reservaNaConta` | booleano | **se `true`, o dinheiro já está dentro de `saldoAtual`** |

`reservaNaConta` decide se a reserva soma no patrimônio ou não — se está na
conta, somar de novo contaria duas vezes. O padrão é `true` para preservar o
patrimônio de quem já usava o app antes do campo existir.

### Preferências

`tema` (`onda`, `noite`, `sakura`, `matcha`, `poupa`, `grafite`, `roxo`),
`customTheme`, `idioma` (`pt`, `en`, `es`, `fr`, `it`), `moeda` (só muda o
símbolo e o formato — **não converte valor**), `fundoIlustrado`, `gastoDiario`,
`onboardingCompleto`, `tourCompleto`, `iaAtiva`.

### Cartão

`limiteCartao`, `diaVencimentoFatura` — resquícios de quando havia um cartão só.
Hoje o que vale é a lista `cartoes`.

## Listas

### `transacoes` — o Diário

```js
{ id, nome, valor, categoria, metodo, data, tipo?, viagemId? }
```

- `metodo`: `'debito'` \| `'dinheiro'` \| `'pix'` \| `'credito'`
- `tipo`: ausente = **gasto**; `'receita'` = **entrada**
- `data`: `YYYY-MM-DD`

**Receita não é gasto.** Sempre filtre com `transacoesGasto()`, que tira as
`tipo:'receita'`. Compra no crédito não entra aqui como saída de caixa — ela
vive dentro da fatura, senão conta duas vezes.

### `faturas` — faturas de cartão

```js
{ id, ano, mes, valor, pago, cartaoId, gastos: [{id, nome, valor, pago, categoria,
                                                 parcelamentoId?, dataCompra?}] }
```

Com dois cartões existem **duas faturas no mesmo mês**. Renda e gastos fixos são
do mês, não da fatura: agrupe com `faturasPorMes()` antes de somar qualquer
coisa, ou a renda é contada uma vez por cartão.

### `gastosMensais` — contas fixas

```js
{ id, nome, valor, diaDoMes, categoria, ativo, inicioAno, inicioMes, criadoEm,
  pagoEm, cartao, cartaoId? }
```

`cartao:true` muda **de onde o dinheiro sai**. Sem ele, a conta é um débito
na conta bancária no dia `diaDoMes`. Com ele, a cobrança entra na fatura do
cartão e sai quando a fatura é paga.

Isso importa porque o app pede a fatura, e a fatura já inclui a assinatura.
Antes deste campo, o mesmo real era contado duas vezes — medido: fatura de
R$ 100 mais a conta fixa de R$ 100 que está dentro dela davam R$ 200 de
despesa no mês. A projeção ficava pessimista no valor de toda conta de cartão,
todo mês.

Quem decide é `gastoFixoPendenteEm()`: conta de cartão nunca está pendente **na
conta**, então some do custo do mês, da cota diária e do aviso de vencimento de
uma vez só. O aviso sumir é correto: conta de cartão não tem vencimento próprio
para você pagar — quem vence é a fatura, que já tem o aviso dela.

Pelo mesmo motivo a caixinha de "já paga" não aparece nessas contas: elas não
são pagas por você no dia, são pagas junto com a fatura.

`pagoEm` é a lista dos meses já quitados, no formato `'AAAA-M'`. Uma conta
fixa se repete, então **pago é por mês, não por conta**: a internet de setembro
estar paga não diz nada sobre a de outubro.

Ele existe por um caso só, e é o de pagar **antes** do dia. `monthMetrics` já
contava apenas o que ainda vai vencer (`custo: d > hoje ? valor : 0`), então
pagar no dia sempre funcionou: passada a data, a conta some do que falta sair.
Quem paga a internet no dia 3 com vencimento no dia 10 ficava com o dinheiro
fora da conta e o app ainda descontando a mesma conta até o dia 10. Marcar
como paga vale o mesmo que o dia ter passado.

Cuidado ao ler `gastosMensaisCusto`: o nome sugere "o que o mês custou", mas o
valor é **o que ainda falta sair neste mês**. Sempre foi assim.

A lista é podada nos 24 meses mais recentes em `definirGastoFixoPago()`. Um
item por mês é pouco, mas isto sobe cifrado pra nuvem em toda gravação e não
tem razão de crescer para sempre.

`ativo:false` pausa sem apagar o histórico. `inicioAno`/`inicioMes` marcam
quando a conta começou a ser cobrada — antes disso ela não entra no cálculo.
`gastoFixoAtivoEm(g, ano, mes)` responde por ambos.

### `entradasExtras` — dinheiro a receber

```js
{ id, nome, valor, recebido, modo, dataPrevista?, feito, feitoEm?, nota }
```

- `valor` é o **total combinado**; `recebido` é o que já entrou.
- `restanteEntrada(e) = valor − recebido` é **o que entra na projeção**.
- `modo`:
  - `'unica'` — cai inteira no mês de `dataPrevista` (ou no mês atual, sem data)
  - `'aosPoucos'` — o que falta se divide do mês atual até `dataPrevista`
  - `'semPrevisao'` — continua na lista do que falta receber, mas **fica fora da
    projeção**: não dá para prometer um mês
- `feito` vira `true` sozinho quando `recebido` alcança `valor`.

Cada pagamento anotado em "+ recebi" também lança uma `transacao` de
`tipo:'receita'` — o dinheiro chegou de verdade, não se lança duas vezes.

### `comprasPlanejadas` — o que se quer comprar

```js
{ id, nome, valor, dataPrevista?, cartao, parcelas, parcelasLancadas, cartaoId, feito, nota, link? }
```

`nota` é o motivo da compra e `link` o endereço do produto — os dois opcionais.
`link` é do tipo `url` no esquema, e esse tipo existe por um motivo só: é o
único campo do app que volta pro DOM como `href`, e `href` é onde texto vira
execução. Só sobrevive http/https absoluto; `javascript:`, `data:` e afins
viram `null` na entrada, e a compra sobrevive sem o link em vez de ser
descartada inteira.

Sem `dataPrevista`, a compra pesa já no mês corrente — é o que faz o saldo do
mês parecer pior do que é quando há um item caro sem data.

Marcar como feita com `cartao:true` chama `lancarParcelamento()`, que divide o
valor nas faturas dos meses seguintes (o resto dos centavos vai na primeira
parcela) e marca `parcelasLancadas` para não lançar de novo.

### `dividas` — o que se deve a alguém

```js
{ id, nome, credor, valor, pago, modo, dataPrevista?, quitado, quitadoEm?, nota }
```

O espelho de `entradasExtras` com o sinal trocado: `valor` é o **total
combinado**, `pago` é o que já saiu, e `restanteDivida(d) = valor − pago` é o
que **sai** da projeção. Os dois passam pela mesma função em `timeline.js`, e é
isso que garante que a projeção use o mesmo critério dos dois lados.

- `credor` é para quem se deve; separado do `nome` porque a pessoa é o que se
  lembra.
- `modo` tem os mesmos três valores de `entradasExtras`, mas o **padrão é
  `'semPrevisao'`** — quem pega dinheiro emprestado de um conhecido quase nunca
  combina data, e escolher um mês por conta própria seria inventar número na
  projeção.
- `quitado`/`quitadoEm` no lugar de `feito`/`feitoEm`: uma dívida não é feita,
  é quitada, e o nome do campo é o que a pessoa lê no backup. Quem traduz um
  nome no outro é a tabela `LISTAS_PLANEJADAS` em `core/planned.js`.
- `quitado` vira `true` sozinho quando `pago` alcança `valor`; pagar mais do
  que falta é aparado, não vira crédito.

Cada pagamento anotado em "+ paguei" lança uma `transacao` de gasto. Sem isso a
dívida encolheria sozinha, o saldo não mexeria e a previsão ficaria otimista.

Lista separada de `comprasPlanejadas` de propósito: uma coisa é o que se quer
comprar, outra é o que já se deve.

### `metas` — metas de economia

```js
{ id, nome, valorAlvo, valorGuardado, dataAlvo?, aporteMensal, ultimoAporte }
```

Com `aporteMensal > 0`, `aplicarAportesAutomaticos()` move o dinheiro sozinho
quando o mês vira: **sai de `saldoAtual` e entra em `valorGuardado`**, nunca
mais do que falta para o alvo, uma vez por mês (`ultimoAporte` guarda qual).
O patrimônio não muda com isso — o dinheiro só trocou de lugar.

### `cartoes`

```js
{ id, nome, limite, diaFechamento, diaVencimento }
```

### `rendasRecorrentes`

```js
{ id, tipo, nome, valor, diaDoMes, ativo, criadoEm }
```

### `investimentos`

```js
{ id, tipo, nome, descricao, valorInvestido, percentCdi, dividendos: [{id, data, valor}], criadoEm }
```

### `viagens` — orçamentos separados

```js
{ id, nome, orcamento }
```

Uma transação com `viagemId` conta no orçamento da viagem além do orçamento
normal.

### `orcamentos` — teto por categoria

```js
{ 'Mercado': 800, 'Lazer': 200 }
```

### `taxasManuais`

```js
{ cdi, selic, atualizadoEm }
```

Preenchido pela BrasilAPI ou à mão.

## O que não fica em `data`

| chave do localStorage | conteúdo |
|---|---|
| `financas-sync-code` | código de sincronização de 12 caracteres nos códigos novos |
| `financas-ia-chave` | chave da API do Gemini |

Nenhum dos dois entra no backup nem no conteúdo financeiro sincronizado. O
código identifica a linha no Supabase; a chave da IA não sai do aparelho e
**não deveria** ficar guardada em texto puro. Ver [SECURITY.md](SECURITY.md).

## Regras que valem para todo campo numérico

- Todo número que vem de campo digitado passa por `parseNum()`, que entende
  `1.234,56` e `1234.56`. `parseFloat("1.234,56")` devolve `1234`.
- `migrateData()` converte texto em número **antes** dos defaults: valor como
  string faz a soma virar concatenação e a conta inteira quebra.
- Dia do mês é preso entre 1 e 31; dia 29–31 em mês curto cai no último dia do
  próprio mês (`dataNoMes()`), nunca no mês seguinte.
