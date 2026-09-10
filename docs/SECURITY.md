# Segurança

Estado revisado em 08/09/2026. O branch `refactor/estrutura-seguranca` e o site
publicado têm proteções diferentes: o branch usa criptografia/RPC e validação;
a produção ainda precisa do rollout e do fechamento do acesso direto à tabela.
A ordem está em [MIGRATION.md](MIGRATION.md); os ensaios desta rodada estão em
[HOMOLOGACAO-2026-09-08.md](HOMOLOGACAO-2026-09-08.md).

## O que está em jogo

O Aoii guarda o retrato financeiro completo de uma pessoa: saldo, salário, dia
em que recebe, dívidas, faturas, nome de quem lhe deve dinheiro, metas, viagens
e cada compra lançada. Vazar isso não é vazar "dados de uso" — é entregar a
rotina e a situação de alguém.

## Modelo de ameaça

| quem | pode | hoje |
|---|---|---|
| quem pega o aparelho desbloqueado | ler tudo em `localStorage` | sem proteção — é o mesmo risco de qualquer app local |
| quem descobre um código de sincronização | atacar a cópia na nuvem | branch cifra e exige token via RPC; acesso REST de produção ainda aberto até a parte 2 |
| quem manda um backup/código adulterado | tentar injetar HTML e propriedades no objeto | branch valida as entradas e verifica escapes por lint |
| o Google (Gemini) | ler o resumo financeiro enviado | recebe nomes de pessoas, cartões e contas |
| a Vercel | pageviews | script de analytics padrão |
| a BrasilAPI | saber que alguém consultou CDI/Selic | consulta sem dado pessoal |

## Onde cada dado mora

**Só no aparelho.** `localStorage`:

| chave | conteúdo |
|---|---|
| `financas-data` | o objeto `data` inteiro, JSON em texto puro |
| `financas-sync-code` | identificador de sincronização (12 caracteres nos códigos novos) |
| `financas-sync-estado:<ambiente>:<codigo>` | geração, revisão confirmada e pendência; sem senha ou token |
| `financas-ia-chave` | chave da API do Gemini, **em texto puro** |

**Enviado ao Supabase pelo branch**: envelope AES-GCM, inclusive nos snapshots
novos. A senha não sai do aparelho; o token derivado é enviado à RPC. Depois da
entrada, a string da senha é descartada e a sessão conserva uma `CryptoKey`
não exportável. Registros antigos em produção continuam em texto puro até a
migração; não foram alterados aqui.

> **Aberto — snapshots antigos anulam a criptografia da linha ativa.**
> Conferido no banco em 10/09/2026: 14 linhas, **1 cifrada e 13 em texto puro**.
> Três delas são snapshots mensais do código ativo, e o id de cada um é
> **derivado do código de sincronização** (`CXY3HQUM-snap-2026-9`). Como
> `aoii_get` aceita qualquer id e é acessível pela chave `anon`, quem descobrir
> o código não abre a linha ativa — mas lê o mês inteiro no snapshot. O
> atacante que a criptografia deveria deter tem outra porta, ao lado, aberta.
> Saída: `scripts/exportar-legado.js` e depois
> [`0007_apaga_legado.sql`](../supabase/migrations/0007_apaga_legado.sql).
> Snapshots novos já nascem cifrados; isto é faxina do passado.

**Enviado ao Gemini** (só com a IA ligada e chave própria): um resumo montado
por `montarResumoFinanceiroParaIA()` — saldo, projeção, gastos por categoria,
saúde financeira, **nomes dos cartões**, **nomes das metas**, **nomes dos gastos
fixos**, faturas pendentes, reserva, investimentos, **nomes de quem deve
dinheiro**, compras planejadas e viagens.

**Enviado à Vercel:** pageviews (`/_vercel/insights/script.js`).

**Enviado à BrasilAPI:** nada — só a consulta pública de taxas.

## Pendências, por gravidade

### 1. Fechamento da tabela após a atualização dos aparelhos

`src/storage/sync-ciclo.js` e `src/ui/sync-ui.js` já ligam a criptografia à
sincronização por RPC. O código novo tem 12 caracteres e usa Web Crypto quando
disponível. Se Web Crypto não existir, a geração falha de forma explícita; não
há fallback para `Math.random()`. A sessão guarda somente uma `CryptoKey`
AES-GCM não exportável e o token de escrita.

O app compatível já foi publicado, mas a parte 2 ainda não foi aplicada: conhecer
a chave pública permite acesso direto à tabela. O token da RPC não impede esse
caminho alternativo. Antes de fechar a tabela, cada aparelho ativo precisa abrir
a versão publicada ao menos uma vez; caso contrário, uma versão antiga perde a
sincronização.

O que já existe: `src/storage/encryption.js`, com AES-GCM 256 e chave derivada
por PBKDF2 (SHA-256, 310.000 voltas, salt de 16 bytes e IV de 12 novos a cada
gravação), metadados amarrados como dados autenticados, e 31 testes contra a
Web Crypto de verdade — inclusive adulteração de um byte, do IV, da revisão e do
`device_id`.

O que falta: concluir a preparação e a implantação coordenada do app e do banco.
[SYNC-DESIGN.md](SYNC-DESIGN.md) tem o desenho completo — formato, token de
escrita, controle de revisão, migração e rollback — e
[`supabase/migrations/0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql)
tem o SQL. A parte 1 já está aplicada; nenhuma migração foi aplicada nesta rodada.

Enquanto isso, a sincronização deve ser tratada como "publicar os dados num
endereço que só quem tem o código conhece".

Uma proteção da migração **já está no branch**: a validação recusa tanto um envelope
cifrado quanto um objeto sem nenhum campo do Aoii. Sem ela, uma versão antiga do
app leria a cópia cifrada como "backup vazio" e a salvaria por cima.

### ~~2. Importação sem validação~~ — resolvido

Toda entrada passa por `adotarDadosDeFora()` (`src/core/defaults.js`):
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

### ~~3. Id de fora indo direto para atributo HTML~~ — resolvido

Todo id precisa caber em `[A-Za-z0-9:_-]{1,64}` — sem aspas, sem `<`, sem
espaço. O que não couber é trocado por um id novo, e `cartaoId`, `viagemId` e
`parcelamentoId` seguem a troca, então a relação entre fatura e cartão
sobrevive. É isso que fecha a injeção por atributo.

A geração foi centralizada em `src/data/ids.js`. Ela usa
`crypto.randomUUID()` ou `crypto.getRandomValues()`; o último degrau, para um
navegador antigo sem Web Crypto, combina o instante com um contador monotônico.
Nenhum identificador de item depende mais de `Math.random()`.

Ids válidos vindos de backups continuam preservados. Trocar todos a cada leitura
quebraria a comparação entre cópia local e nuvem e criaria conflitos falsos.

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

### 7. Conflito entre aparelhos — implementado e ensaiado no branch

Cada gravação envia a revisão esperada. O servidor recusa uma revisão antiga,
e a interface oferece manter o aparelho, usar a nuvem, exportar os dois ou adiar.
A fila persiste pendências e reenvia edições feitas durante a rede; leitura,
abertura e migração também não substituem essas edições silenciosamente.

`aoii_put(id, data, revisão_esperada, token)` grava só se a
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

Era mais grave do que este documento dizia antes. **A parte 1 do SQL foi
aplicada no mesmo dia** e o quadro hoje é:

| | antes | agora |
|---|---|---|
| SELECT pela chave anon | tabela inteira | tabela inteira (só muda na parte 2) |
| INSERT / UPDATE | qualquer linha | qualquer linha (idem) |
| **DELETE** | **qualquer linha** | **barrado** |
| funções `aoii_get` / `aoii_put` | não existiam | criadas, com token de escrita e controle de revisão |

- [`0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql) —
  **aplicada e conferida em 06/09/2026** (o rodapé do arquivo traz o resultado
  de cada verificação). Nada quebrou: o app publicado continua lendo e gravando
  por REST.
- [`0002_sync_fecha_tabela.sql`](../supabase/migrations/0002_sync_fecha_tabela.sql) —
  fecha o SELECT e o resto. **Ainda não aplicada, e não deve ser**: só depois
  que o app publicado usar as funções, senão derruba a sincronização de quem
  estiver na versão anterior.

Ou seja: o vandalismo (apagar o espelho de todo mundo) está fechado; a leitura
indevida continua aberta até a etapa do app.

A URL e a chave `anon` estarem no código publicado continua sendo normal e
esperado — não é vazamento de senha. O problema é o que a chave permite fazer.

O SQL proposto tranca a tabela para o papel `anon` e põe o acesso atrás de duas
funções `SECURITY DEFINER` — porque RLS não sabe exigir "só se você filtrar por
id", e com `SELECT USING (true)` a chave `anon` baixa a tabela inteira. Gravar
passa a exigir um token derivado da senha, do qual o servidor guarda só o hash:
quem descobrir o código lê o texto cifrado, mas não escreve.

O arquivo traz também o roteiro de conferência (o que precisa falhar) e o SQL de
reversão.

### 9. Criação anônima ilimitada de registros — **aberta em produção**

`aoii_put` cria linha nova sem exigir token, e não pode ser diferente: se
exigisse, ninguém conseguiria ligar a sincronização a primeira vez. Como a chave
`anon` está no HTML publicado, qualquer um pode criar linhas até estourar a cota
do plano.

> **Meio aplicada, e o meio que falta é o que protege.** Conferido no banco em
> 10/09/2026, lendo o corpo das funções:
>
> | função | consulta `aoii_limites` | recusa criação em massa |
> |---|---|---|
> | `aoii_put_homolog` | sim | sim |
> | **`aoii_put` (produção)** | **não** | **não** |
>
> A tabela `aoii_limites` existe e tem os quatro valores — mas quem a criou foi
> o `0005`, que é de homologação. Olhando só a tabela, parece aplicado. A view
> `aoii_crescimento` também não existe. Produção segue sem teto de criação.
>
> A metade que falta está pronta em
> [`0006_limites_producao.sql`](../supabase/migrations/0006_limites_producao.sql).
> O corpo de `aoii_put` em produção foi lido e é exatamente o do `0001`, sem
> correção posterior: aplicar não sobrescreve trabalho de ninguém.

**Criptografia não resolve isto.** Ela protege o conteúdo, não o espaço.

[`0004_limites_e_abuso.sql`](../supabase/migrations/0004_limites_e_abuso.sql)
propõe três camadas: teto de 5 MB por linha (já em vigor desde a parte 1), teto
de **criações** por hora e teto total de linhas. A distinção entre criar e
atualizar é o que faz isso não atrapalhar ninguém: um usuário real cria uma
linha e depois só atualiza, milhares de vezes. Quem cria mil por hora não é
usuário.

Os números ficam numa tabela (`aoii_limites`), não no corpo da função, pra dar
pra afrouxar num incidente sem recriar nada. E uma view `aoii_crescimento`
mostra linhas criadas por dia — nenhuma das duas é acessível pelo `anon`.

**Risco residual assumido:** isto não é rate limiting de borda. Um atacante
paciente, dentro do teto por hora, ainda enche a tabela devagar. O Supabase
oferece limitação de taxa no plano pago; enquanto não houver, os tetos são o que
existe, e a view de crescimento é como se percebe.

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

Consulte o estado por etapa em [SYNC-DESIGN.md](SYNC-DESIGN.md) e
[`supabase/migrations/0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql).
**Nesta rodada houve apenas dados fictícios de teste em homologação; nenhuma
migração, política ou linha financeira de produção foi alterada.**
