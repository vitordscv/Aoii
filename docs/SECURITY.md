# Segurança

Estado do commit em que este documento foi escrito. O que está listado como
pendência **é pendência de verdade** — nada aqui descreve proteção que não
existe. A ordem de execução está em [MIGRATION.md](MIGRATION.md).

## O que está em jogo

O Aoii guarda o retrato financeiro completo de uma pessoa: saldo, salário, dia
em que recebe, dívidas, faturas, nome de quem lhe deve dinheiro, metas, viagens
e cada compra lançada. Vazar isso não é vazar "dados de uso" — é entregar a
rotina e a situação de alguém.

## Modelo de ameaça

| quem | pode | hoje |
|---|---|---|
| quem pega o aparelho desbloqueado | ler tudo em `localStorage` | sem proteção — é o mesmo risco de qualquer app local |
| quem descobre um código de sincronização | ler e **sobrescrever** os dados daquele código | **sem proteção: o dado vai em texto puro para o Supabase** |
| quem manda um backup/código adulterado | injetar HTML e propriedades no objeto | **sem validação de entrada** |
| o Google (Gemini) | ler o resumo financeiro enviado | recebe nomes de pessoas, cartões e contas |
| a Vercel | pageviews | script de analytics padrão |
| a BrasilAPI | saber que alguém consultou CDI/Selic | consulta sem dado pessoal |

## Onde cada dado mora

**Só no aparelho.** `localStorage`:

| chave | conteúdo |
|---|---|
| `financas-data` | o objeto `data` inteiro, JSON em texto puro |
| `financas-sync-code` | código de sincronização de 8 caracteres |
| `financas-ia-chave` | chave da API do Gemini, **em texto puro** |

**Enviado ao Supabase** (só se a pessoa configurar sincronização): o objeto
`data` inteiro, **sem criptografia**, na linha identificada pelo código de 8
caracteres. Mais os snapshots mensais, também em texto puro.

**Enviado ao Gemini** (só com a IA ligada e chave própria): um resumo montado
por `montarResumoFinanceiroParaIA()` — saldo, projeção, gastos por categoria,
saúde financeira, **nomes dos cartões**, **nomes das metas**, **nomes dos gastos
fixos**, faturas pendentes, reserva, investimentos, **nomes de quem deve
dinheiro**, compras planejadas e viagens.

**Enviado à Vercel:** pageviews (`/_vercel/insights/script.js`).

**Enviado à BrasilAPI:** nada — só a consulta pública de taxas.

## Pendências, por gravidade

### 1. Sincronização sem criptografia

`src/storage/sync.js`. O objeto financeiro vai e volta em texto puro. O código
de 8 caracteres é ao mesmo tempo o identificador da linha e a única credencial —
não há segredo separado, e ele é gerado com `Math.random()`.

Quem souber o código lê e **escreve**. Não há verificação de que quem escreve é
quem criou.

O que precisa existir: AES-GCM 256 com chave derivada por PBKDF2 (SHA-256, ≥
310.000 iterações, salt aleatório de 16 bytes, IV de 12), tudo no aparelho; o
servidor guardando só ciphertext. Formato proposto e plano de migração vão em
`docs/SYNC-DESIGN.md`, **antes** de qualquer alteração no Supabase.

Enquanto isso não existe, a sincronização deve ser tratada como "publicar os
dados num endereço que só quem tem o código conhece".

### ~~2. Importação sem validação~~ — resolvido

Toda entrada passa por `adotarDadosDeFora()` (`src/data/validation.js`):
arquivo JSON, código de backup em base64, resposta do Supabase e o próprio
`localStorage`. O objeto é reconstruído campo a campo a partir de
`src/data/schema.js` — o que não está declarado não entra.

Coberto: raiz precisa ser objeto simples; teto de 5 MB; profundidade máxima 12;
`schemaVersion` do futuro é recusado; `__proto__`, `constructor` e `prototype`
descartados (inclusive como chave dinâmica em `orcamentos` e `customTheme`);
`NaN`, `Infinity` e valores fora de escala recusados; texto aparado no limite do
campo; enum fora da lista cai no padrão; data impossível vira nula; lista acima
de 20.000 itens é cortada.

Dado local recusado não é apagado: vai para
`localStorage['financas-data-recusado']` com o motivo ao lado.

Testes em `testes/validacao.test.js`.

### ~~3. Id de fora indo direto para atributo HTML~~ — parcialmente resolvido

Todo id agora precisa caber em `[A-Za-z0-9:_-]{1,64}` — sem aspas, sem `<`, sem
espaço. O que não couber é trocado por um id novo, e `cartaoId`, `viagemId` e
`parcelamentoId` seguem a troca, então a relação entre fatura e cartão
sobrevive. É isso que fecha a injeção por atributo.

Trocar *todos* os ids, e não só os inválidos, seria pior: o app compara o JSON
local com o da nuvem pra saber se outro aparelho mexeu, e ids novos a cada
leitura fariam a comparação nunca bater — sincronização em laço.

**O que falta:** os ids ainda são gerados por `uid()`
(`src/core/helpers.js`), que usa `Math.random()`. Serve para chave de lista, não
para nada com valor de segurança — e hoje nada de segurança depende deles. Vale
trocar por `crypto.randomUUID()` mesmo assim. A validação já usa
`crypto.randomUUID()` quando precisa criar um id.

### 4. `innerHTML` em 94 lugares

Boa parte é template estático ou já passa por `esc()`. O trabalho é separar os
casos que tocam dado externo — Diário, faturas, metas, cartões, investimentos,
categorias, viagens, rendas, relatórios, importação e **resposta da IA** — e
trocar por `createElement`/`textContent`/`dataset`. Onde o template continuar
com `innerHTML`, deve ficar explícito que só aceita constante interna.

### 5. Chave do Gemini em texto puro

Fica em `localStorage` sob `financas-ia-chave`, e o campo do formulário não é
`type="password"`. Não entra em backup nem em sincronização — isso está certo.

Falta: campo de senha com mostrar/ocultar, não guardar por padrão, explicar o
risco quando a pessoa escolher guardar, e oferecer apagar ao desligar a IA.

### 6. Consentimento sobre o que vai para a IA

Não há tela que mostre o que será enviado antes do primeiro envio, nem opção de
resumo reduzido sem nomes próprios. A resposta da IA precisa ser renderizada com
`textContent`.

### 7. Conflito entre aparelhos

Cada gravação manda o objeto inteiro e a última vence. Dois aparelhos editando
no mesmo dia perdem trabalho em silêncio. Faltam `revision`, `updated_at`,
`device_id` e gravação condicionada à revisão, com tela de conflito em vez de
sobrescrita.

### 8. RLS do Supabase não verificada

A URL e a chave `anon` estão no código publicado — isso é normal e esperado, não
é vazamento de senha. O que não está verificado é se as políticas de linha
impedem listar a tabela inteira ou escrever em linha alheia. **Funcionar não é
prova de que a política está certa.** As políticas devem virar SQL versionado em
`supabase/migrations/`.

## Regras para quem for mexer

- Todo conteúdo de backup, Supabase, Gemini ou campo digitado é **não confiável**.
- Dado externo não vira HTML. `textContent`, `createElement`, `dataset`.
- Atributo não se monta com concatenação de string.
- O objeto financeiro não entra em `console.log` nem em mensagem de erro.
- Nome de pessoa, banco, cartão ou nota não vai para a IA sem necessidade.
- Chave de API não entra em backup nem em sincronização.
- Id vindo de fora é descartado. Gere com `crypto.randomUUID()`.
- `Math.random()` não serve para nada com valor de segurança.

## Antes de mexer no Supabase

Apresentar e ter aprovado, nesta ordem: SQL proposto, políticas RLS, formato do
dado criptografado, plano de migração e plano de recuperação/rollback. O formato
antigo não é apagado sem estratégia de recuperação.
