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
| quem descobre um código de sincronização | atacar a cópia na nuvem | tabela fora do REST, escrita só por RPC com token, e todas as linhas cifradas desde 11/09/2026 — sem a senha, o código sozinho é endereço, não chave |
| quem manda um backup/código adulterado | tentar injetar HTML e propriedades no objeto | branch valida as entradas e verifica escapes por lint |
| o Google (Gemini) | ler o resumo financeiro enviado | só com a IA ligada; sem nome de pessoa, banco ou empregador — cartões vão numerados |
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
não exportável. Os registros antigos que ainda estavam em texto puro foram
exportados e apagados em 11/09/2026 — hoje não há nenhum.

> **Fechado em 11/09/2026 — não há mais texto puro na nuvem.**
> Era assim: 18 linhas, 5 cifradas e **13 em texto puro**, três delas
> snapshots mensais do código ativo, com o id **derivado do código de
> sincronização** (`AAAA1111-snap-2026-9`). Como `aoii_get` aceita qualquer id
> e responde à chave `anon`, quem descobrisse o código não abria a linha ativa
> — mas lia o mês inteiro no snapshot ao lado.
>
> As 13 foram exportadas com `scripts/exportar-legado.js`, conferidas uma a
> uma (13/13 legíveis e com conteúdo financeiro), e então apagadas. Estado
> depois: **5 linhas, 5 cifradas, 0 em texto puro**. Snapshots novos já nascem
> cifrados, então isto era faxina do passado, não remendo permanente.

**Enviado ao Gemini** (só com a IA ligada e chave própria): um resumo montado
por `montarResumoFinanceiroParaIA()` — saldo, projeção, gastos por categoria,
saúde financeira, faturas pendentes, reserva, investimentos, compras planejadas
e os **nomes que a própria pessoa deu** às metas, viagens e gastos fixos.

**Não é enviado**, desde 11/09/2026: o nome dos cartões (na prática, o nome do
banco), o **credor de cada dívida** (nome de outra pessoa, que nem usa o app), o
nome livre de cada renda recorrente (na prática, o empregador — o placeholder do
campo sugere "Salário · TechBrasil") e as notas dos lançamentos, que nunca foram.
Os cartões vão como "Cartão 1", "Cartão 2": a IA não precisa do banco para
responder. A tela de Configurações diz isso antes de alguém ligar a IA.

A linha que separa o que vai do que não vai: nome de **pessoa ou instituição**
não sai; rótulo que a pessoa escreveu sobre a própria vida sai, porque sem ele
não dá para perguntar "como está a viagem a Portugal?".

**Enviado à Vercel:** pageviews (`/_vercel/insights/script.js`).

**Enviado à BrasilAPI:** nada — só a consulta pública de taxas.

## Pendências, por gravidade

### ~~1. Fechamento da tabela após a atualização dos aparelhos~~ — resolvido

O app compatível foi publicado, os aparelhos foram atualizados e a parte 2 foi
aplicada. **Conferido no banco em 10/09/2026:**

| | resultado |
|---|---|
| grants da `financas` para `anon` | **nenhum** (a tabela sumiu do REST) |
| RLS na `financas` | ligada, **0 políticas** |
| `aoii_get` / `aoii_put` | existem, `SECURITY DEFINER` |
| linha ativa `AAAA1111` | cifrada (`aoii`, `cipher`, `kdf`, `revision`, `device_id`), gravada em 10/09/2026 |

A gravação do dia prova o caminho inteiro: o app publicado deriva a chave, cifra,
manda pela RPC com token e revisão, e o servidor aceita. Não é só que a tabela
fechou — é que o caminho novo está em uso.

O que existe por trás: `src/storage/encryption.js`, com AES-GCM 256 e chave
derivada por PBKDF2 (SHA-256, 310.000 voltas, salt de 16 bytes estável por
código e IV de 12 bytes novos a cada gravação), metadados amarrados como dados
autenticados, e 31 testes contra a Web Crypto de verdade — inclusive adulteração
de um byte, do IV, da revisão e do `device_id`.

A criptografia da linha ativa protegia menos do que parecia enquanto os
snapshots em texto puro existiam ao lado dela. Deixaram de existir em
11/09/2026 — ver a pendência 10.

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

### ~~6. Consentimento sobre o que vai para a IA~~ — fechada em 11/09/2026

Nome de pessoa e de instituição deixou de ser enviado: credor, nome do cartão e
nome livre da renda saíram do resumo, e os cartões vão numerados. O painel da IA
nas Configurações lista o que sai e o que não sai, ao lado do interruptor que
liga o recurso — antes do primeiro envio, porque é essa a informação que decide
se alguém quer ligar isso.

Continua indo o rótulo que a própria pessoa escreveu para metas, viagens, contas
fixas e compras: é o que permite perguntar sobre uma delas pelo nome. Quem quiser
um resumo sem nome nenhum mexe em `montarResumoFinanceiroParaIA()`, que é o
único lugar que monta o texto. (A resposta da IA já é renderizada com
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

### ~~8. RLS do Supabase~~ — fechada em 10/09/2026

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
  fecha o SELECT e o resto. **Aplicada**, depois que o app publicado passou a
  usar as funções. Conferido em 10/09/2026: a `financas` não tem nenhum grant
  para `anon` e nenhuma política — o REST não a enxerga mais.

Ou seja: a leitura indevida da tabela ativa está fechada. O que continua aberto
é o que se lê **sem** a tabela, pelos ids de snapshot que qualquer um monta a
partir do código (pendência 10), e o que se **escreve** na gêmea de homologação
que ficou para trás (pendência 11).

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

### ~~10. Snapshots antigos em texto puro, com id derivado do código~~ — fechada em 11/09/2026

Era a pior das que restavam, porque anulava em parte a pendencia 1.

**Resolvida.** As 13 linhas em texto puro foram exportadas, conferidas e
apagadas. Conferido no banco depois: `5 linhas, 5 cifradas, 0 em texto puro,
0 snapshots expostos`. A copia local ficou em `aoii-legado-2026-09-11/`,
fora do repositorio.

O diagnostico original, para quem precisar do contexto:

Conferido em 10/09/2026: das 14 linhas da `financas`, **1 está cifrada** (a
ativa) e **13 estão em texto puro**. Três delas têm o id derivado do código de
sincronização em uso:

    AAAA1111              → cifrada
    AAAA1111-snap-2026-9  → texto puro, 3.787 bytes
    AAAA1111-snap-2026-8  → texto puro, 3.406 bytes
    AAAA1111-snap-2026-7  → texto puro, 3.240 bytes

`aoii_get` devolve qualquer linha pelo id exato — é o desenho, e está certo:
sem isso ninguém lê o próprio espelho. Mas quem descobrir o código **monta o id
do snapshot sozinho** e lê um mês inteiro em texto puro: saldo, cartões, cada
lançamento do Diário. A senha da sincronização não entra nesse caminho.

As outras 10 são códigos antigos (`BBBB2222`, `CCCC3333`, `DDDD4444`,
`EEEE5555`, `FFFF6666`, `GGGG7777`, `HHHH8888`, `AAAA1112`, `JJJJ9999` e um
snapshot de `BBBB2222`). Essas não são deriváveis de nada, mas continuam em
texto puro para quem souber o código.

**O app atual não cria mais isso**: `ensureMonthlySnapshot()` cifra o snapshot
com a mesma chave do espelho, e só roda com a sincronização destrancada. O
passivo é do app antigo.

Caminho, na ordem, e nenhum passo pula o anterior:

1. `node scripts/exportar-legado.js` com os ids em `AOII_IDS` — baixa cada
   linha para um arquivo local. Não apaga nada e não imprime conteúdo.
2. Conferir os arquivos.
3. [`0007_apaga_legado.sql`](../supabase/migrations/0007_apaga_legado.sql).

**O passo 3 é irreversível.** Sem o passo 1 feito e conferido, não se faz.

### ~~11. Gêmea de homologação aberta dentro da produção~~ — fechada em 11/09/2026

**Resolvida** aplicando [`0008_remove_homologacao.sql`](../supabase/migrations/0008_remove_homologacao.sql). Conferido depois:
tabela, as duas funcoes `aoii_*_homolog` e as quatro politicas abertas nao
existem mais; sobraram `financas` e `aoii_limites`. A tabela tinha zero
linhas, entao nao houve dado perdido. Rollback: reaplicar `0003` e `0005`.

O diagnostico original:


O `0003` criou `financas_homolog` para o ensaio, com as políticas abertas de
propósito. O ensaio acabou; a tabela ficou. Conferido em 10/09/2026:

| tabela | RLS | políticas | grants para `anon` |
|---|---|---|---|
| `financas` | on | 0 | nenhum |
| **`financas_homolog`** | on | **4** | **SELECT, INSERT, UPDATE, DELETE, TRUNCATE** |

As quatro são `using (true)` / `with check (true)`. É o mesmo buraco que o
`0002` fechou na `financas`, intacto numa tabela ao lado, no mesmo projeto —
e sem nem as defesas da parte 1: não há token, não há revisão, não há teto de
5 MB por linha, não há teto de criação.

Tem 0 linhas hoje, então não há dado a perder. O que existe é a porta: qualquer
um com a chave `anon` enche o projeto pelo lado de fora, sem passar por função
nenhuma. Nesse aspecto é **mais grave que a pendência 9**, onde ao menos a
função e o teto por linha estão no caminho.

Proposta em
[`0008_remove_homologacao.sql`](../supabase/migrations/0008_remove_homologacao.sql):
derruba as duas funções e a tabela. Rollback = reaplicar `0003` e `0005`, que
são idempotentes. O que se perde é ensaiar contra produção pelo atalho do
`localStorage['aoii-homolog']` — e perder isso é o certo: ensaio não se faz no
projeto onde moram os dados reais.

## Regras para quem for mexer

**Nunca escreva um código de sincronização real neste repositório.** Ele é o
endereço da linha na nuvem: quem o tem monta o id dos snapshots e chama
`aoii_get`. Este documento já teve o código verdadeiro em 25 commits, num
repositório público, enquanto os snapshots estavam em texto puro — ou seja,
publicou o caminho até um mês de finanças legíveis. Use `AAAA1111` e
parentes; eles têm a mesma forma e não abrem nada.


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
