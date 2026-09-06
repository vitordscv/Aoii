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

### 1. Sincronização sem criptografia — desenho pronto, **aguardando aprovação**

`src/storage/sync.js`. O objeto financeiro ainda vai e volta em texto puro. O
código de 8 caracteres é ao mesmo tempo o identificador da linha e a única
credencial — não há segredo separado, e ele é gerado com `Math.random()`.

Quem souber o código lê e **escreve**.

O que já existe: `src/storage/encryption.js`, com AES-GCM 256 e chave derivada
por PBKDF2 (SHA-256, 310.000 voltas, salt de 16 bytes e IV de 12 novos a cada
gravação), metadados amarrados como dados autenticados, e 31 testes contra a
Web Crypto de verdade — inclusive adulteração de um byte, do IV, da revisão e do
`device_id`.

O que falta: ligar isso à sincronização, o que exige mudar o Supabase.
[SYNC-DESIGN.md](SYNC-DESIGN.md) tem o desenho completo — formato, token de
escrita, controle de revisão, migração e rollback — e
[`supabase/migrations/0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql)
tem o SQL. **Nada foi aplicado.**

Enquanto isso, a sincronização deve ser tratada como "publicar os dados num
endereço que só quem tem o código conhece".

Uma proteção da migração **já está no ar**: a validação recusa tanto um envelope
cifrado quanto um objeto sem nenhum campo do Aoii. Sem ela, uma versão antiga do
app leria a cópia cifrada como "backup vazio" e a salvaria por cima.

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

### ~~4. `innerHTML` em 94 lugares~~ — guardado por lint

A contagem enganava. Verificado caso a caso com uma regra automática
(`scripts/lint.js`, que procura template com `<` interpolando campo de texto sem
`esc()`), sobraram oito, e só um era exploitável de verdade: no relatório mensal
exportado, a origem de cada despesa era `'💳 ' + nomeCartao(...)` sem escape —
um cartão chamado `<img src=x onerror=…>` executava ao exportar. Corrigido,
junto com os outros sete.

A resposta da IA já era renderizada com `textContent` nos dois lugares onde
aparece.

A regra roda em `npm run check` e reprova qualquer caso novo. Quando a marcação
é intencional, a saída é o nome da variável terminar em `Html` — está no código
e na mensagem de erro do lint.

Continuam existindo 94 `innerHTML`, agora sob essa regra. Trocá-los por
`createElement` seria bom para clareza, não para segurança.

### 5. Chave do Gemini em texto puro

Fica em `localStorage` sob `financas-ia-chave`, e o campo do formulário não é
`type="password"`. Não entra em backup nem em sincronização — isso está certo.

Falta: campo de senha com mostrar/ocultar, não guardar por padrão, explicar o
risco quando a pessoa escolher guardar, e oferecer apagar ao desligar a IA.

### 6. Consentimento sobre o que vai para a IA

Não há tela que mostre o que será enviado antes do primeiro envio, nem opção de
resumo reduzido sem nomes próprios. (A resposta da IA já é renderizada com
`textContent` — isso está certo.)

### 7. Conflito entre aparelhos — desenhado, aguardando a mesma aprovação

Cada gravação manda o objeto inteiro e a última vence. Dois aparelhos editando
no mesmo dia perdem trabalho em silêncio, e o `catch(e){}` da sincronização
engole erro de rede sem nenhum sinal na tela.

`aoii_put(id, data, revisão_esperada, token)` no SQL proposto grava só se a
revisão ainda for a esperada e devolve conflito em vez de sobrescrever. A tela
de conflito e os estados de status estão descritos em
[SYNC-DESIGN.md](SYNC-DESIGN.md). Sem merge automático de valor financeiro:
juntar dois saldos sem regra é pior do que perguntar.

### 8. RLS do Supabase — **verificada em 06/09/2026, e está aberta**

Deixou de ser suposição. A política em vigor no projeto de produção é:

```sql
create policy "acesso publico" on financas
  for all using (true) with check (true);   -- roles: {public}
```

`for all` com `using (true)` para o papel `public` significa, na prática: quem
tem a chave `anon` — que está no HTML publicado, e isso é normal — pode
**listar a tabela inteira**, **alterar qualquer linha** e **apagar qualquer
linha**. Não é só o dado de uma pessoa: é o de todo mundo que usa o mesmo
projeto.

Estado da tabela na mesma verificação: 14 linhas (10 códigos de sincronização e
4 snapshots mensais), 27 kB, colunas `id text, data jsonb, updated_at
timestamptz`. Tudo em texto puro.

Isto é mais grave do que este documento dizia antes, e é o argumento mais forte
para as duas partes do SQL proposto:

- [`0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql) — aditiva,
  pode ser aplicada agora sem quebrar nada: colunas de controle, as duas funções
  de acesso, e tira o `DELETE` do acesso público (o app nunca apaga linha).
- [`0002_sync_fecha_tabela.sql`](../supabase/migrations/0002_sync_fecha_tabela.sql) —
  tranca a tabela de vez. **Só depois** que o app publicado usar as funções;
  antes disso, derruba a sincronização de quem estiver na versão anterior.

A URL e a chave `anon` estarem no código publicado continua sendo normal e
esperado — não é vazamento de senha. O problema é o que a chave permite fazer.

O SQL proposto tranca a tabela para o papel `anon` e põe o acesso atrás de duas
funções `SECURITY DEFINER` — porque RLS não sabe exigir "só se você filtrar por
id", e com `SELECT USING (true)` a chave `anon` baixa a tabela inteira. Gravar
passa a exigir um token derivado da senha, do qual o servidor guarda só o hash:
quem descobrir o código lê o texto cifrado, mas não escreve.

O arquivo traz também o roteiro de conferência (o que precisa falhar) e o SQL de
reversão.

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

Isso está pronto e parado esperando revisão: [SYNC-DESIGN.md](SYNC-DESIGN.md) e
[`supabase/migrations/0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql).
**Nenhuma alteração foi aplicada em nenhum projeto do Supabase.**
