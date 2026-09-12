# Migração

Registro do que já mudou, por quê, e o que vem depois. Cada rodada acrescenta
uma seção aqui — é o lugar de procurar antes de refazer uma decisão.

## Ponto de partida

Commit `6556d20`. O projeto inteiro era um `index.html` de 1.114.126 bytes:

- 83 KB de invólucro de bundler (um carregador e um thumbnail SVG) cuja única
  função era desempacotar a aplicação;
- 1.031.311 bytes de aplicação, guardados como **uma string JSON numa linha**;
- CSS e JavaScript num bloco só, sem fronteira entre cálculo, tela e
  armazenamento;
- 4,69 MB de artes de fundo em `assets/`.

Consequência prática: mudar uma linha produzia um diff de arquivo inteiro, e
entender qualquer parte custava ler o todo.

## Rodada 1 — estrutura

### Decisões

**A fonte passa a ser `src/`; `dist/` é gerado e fica fora do git.**
`dist/index.html` é montado por `scripts/build.js` na hora do deploy
(`vercel.json` chama `npm run build`). Sem artefato versionado não existe a
classe de bug "dist desatualizado", e o repositório não carrega 1 MB duplicado a
cada commit.

**O build é concatenação, não empacotamento.** Os 63 módulos JS continuam sendo
fatias de um `(function(){ "use strict"; … })()` só, na ordem original. Foi essa
escolha que permitiu partir 5.400 linhas em 63 arquivos sem tocar em uma linha
de lógica — e provar: no commit da extração, o `dist/` gerado a partir de `src/`
era **byte a byte igual** ao documento que estava dentro do `index.html` do
`6556d20`, 1.031.311 bytes. O script que fazia essa comparação
(`scripts/verificar-build.js`) foi aposentado na rodada 2, quando `src/` passou
a receber mudanças de comportamento e a igualdade deixou de valer.

Consequência aceita: um arquivo de `src/` não é analisável isoladamente (é
fragmento de IIFE), então ferramenta de lint padrão não roda por arquivo. Quem
faz o papel de sistema de módulos é `scripts/lint.js`.

**Módulos ES ficam para depois.** Converter para `import`/`export` muda a ordem
de execução e o escopo. Vale fazer folha por folha, começando por
`core/money.js` e `core/dates.js`, que não dependem de ninguém — e só depois da
fase de validação, que é mais urgente.

**O invólucro do bundler foi embora.** `ext_resources` e `page_order` estavam
vazios: o carregador só desempacotava a string. `dist/index.html` é HTML comum,
83 KB menor e sem o passo de desempacotar antes de pintar a tela.

**Testes e auditoria rodam contra `dist/index.html`**, não contra `src/`. É o
arquivo que chega no navegador; se o build quebrar a ordem de concatenação, a
suíte percebe.

**`.gitattributes` trava LF.** O build espera LF; sem isso um clone no Windows
vira CRLF e a árvore inteira reprova.

### Fronteiras

`data → i18n → core → storage → integrations → ui`, verificadas por
`scripts/lint.js`. As 18 dependências que já apontavam para cima estão em
`scripts/lint-baseline.json`. **A lista só encolhe.** Os três grupos:

- `core` → `ui/effects.js` (cálculo chamando `vibrate()`, `catIcon()`, `render()`)
- `core` → `storage` (cálculo chamando `persist()` direto)
- `integrations` → `ui` (integração desenhando o próprio resultado)

### Traduções

Cada idioma ganhou arquivo (`src/i18n/pt.js` … `it.js`); `dictionary.js` só
monta. Nenhum texto mudou — o objeto `I18N` avaliado antes e depois do corte é o
mesmo JSON, 545 chaves em cinco idiomas. `testes/i18n.test.js` passou a guardar
a invariante.

De quebra, um bug de auditoria apareceu: a busca pelo fim de cada dicionário
parava no primeiro `};` em linha própria e, com os idiomas em blocos de uma
linha só, engolia os cinco de uma vez — `"en: completo"` passava sempre, mesmo
faltando tradução. Corrigido.

### Antes e depois

| | `6556d20` | agora |
|---|---|---|
| arquivo publicado | 1.114.126 B (empacotado) | 1.032.430 B (HTML comum) |
| arquivos de fonte | 1 | 71 |
| maior arquivo de fonte | 1.114.126 B | 230.458 B (`src/index.html`) |
| módulos JS | — | 63 · mediana 62 linhas · maior 365 |
| arquivos CSS | — | 6 |
| testes | 137 | 148 |
| verificação de fronteira | nenhuma | 18 violações congeladas, 0 novas |

Os 230 KB de `src/index.html` são quase todos ícone e manifesto embutidos em
base64 (favicon 13,7 KB, apple-touch-icon 12,6 KB, manifesto 100 KB). Tirar isso
para `public/` é tarefa da fase de desempenho.

### Publicação

Dois destinos publicam este repositório:

- **Vercel** (aoiii.vercel.app) — passa a rodar `npm run build` pelo
  `vercel.json`, servindo `dist/`. O deploy de prévia deste branch já subiu
  assim, então a configuração está confirmada.
- **GitHub Pages** (vitordscv.github.io/Aoii) — servia o `index.html` da raiz
  direto do branch. Como esse arquivo agora é gerado, o Pages precisa rodar o
  build: `.github/workflows/pages.yml` faz isso, **mas só entra em ação depois
  de trocar Settings → Pages → Source para "GitHub Actions"**. Sem essa troca,
  juntar este branch no main deixa o endereço do Pages sem página.

### Pendências que a rodada deixou de propósito

- Ícones e manifesto continuam embutidos em base64.

## Rodada 2 — validação e XSS

### Decisões

**Uma porta só.** `adotarDadosDeFora()` (`src/data/validation.js`) é por onde
todo dado de fora vira `data`: arquivo JSON, código de backup, resposta do
Supabase e o próprio `localStorage`. O objeto é reconstruído campo a campo a
partir de `src/data/schema.js` — o que não está declarado não entra.

**Ids são restringidos, não trocados.** Todo id precisa caber em
`[A-Za-z0-9:_-]{1,64}`; o que não couber ganha um id novo, e `cartaoId`,
`viagemId` e `parcelamentoId` seguem a troca. Trocar *todos* — que era o plano
original — quebraria a sincronização: ela compara o JSON local com o da nuvem
pra saber se outro aparelho mexeu, e ids novos a cada leitura fariam a
comparação nunca bater. Restringir o formato fecha a injeção por atributo sem
esse efeito.

**Valida, migra, valida de novo.** A segunda passada existe por dois motivos:
`migrateData()` acrescenta no fim os campos que faltavam, então sem ela a ordem
das chaves dependeria do que veio no backup (e a sincronização compara JSON como
texto); e o que a migração escreve passa a obedecer o esquema também.

**Dado local recusado não é apagado.** Vai para
`localStorage['financas-data-recusado']`, com data e motivo ao lado. Recomeçar
já era o comportamento do `catch`; o que faltava era não jogar fora.

**Campo novo agora exige três lugares:** `schema.js`, `defaultData()` e
`migrateData()`. Campo em só dois dos três se perde em silêncio no primeiro
backup importado. Está no CLAUDE.md.

### O que apareceu no caminho

- **`modo` da entrada extra não podia ter padrão no esquema.** Com padrão, ele
  chegava valendo `'unica'` e a migração do interruptor `aosPoucos` nunca
  acontecia — quem viesse do formato antigo perderia o "recebendo aos poucos".
- **Um XSS de verdade**, achado pela regra de lint nova: no relatório mensal
  exportado, a origem da despesa é `'💳 ' + nomeCartao(...)` e ia para o HTML
  sem `esc()`. Um cartão chamado `<img src=x onerror=…>` executava ao exportar.
- **Dois bugs no próprio lint de camadas**: chave de objeto (`{ iaAtiva: … }`)
  contava como uso da função de mesmo nome, e consumir o `:` na varredura fazia
  `{id:uid()}` deixar de registrar o uso de `uid`. Corrigidos; três falsos
  positivos saíram da baseline, que caiu de 18 para 17.
- **O `innerHTML` era menos grave do que a contagem sugeria.** A resposta da IA
  já ia por `textContent`; o texto visível quase todo já passava por `esc()`. Os
  94 `innerHTML` não eram 94 buracos — o buraco eram os ids em atributos.
  Reescrevê-los em `createElement` seria churn e risco de regressão por nenhum
  ganho de segurança; a regra de lint garante a propriedade daqui pra frente.

### Antes e depois

| | rodada 1 | agora |
|---|---|---|
| entradas validadas | 0 de 4 | 4 de 4 |
| versão de schema | não existia | 1 |
| testes | 148 | 206 |
| regras de lint | camadas | camadas + texto do usuário em HTML |
| XSS conhecido | 1 (não sabido) | 0 |

## Rodada 3 — criptografia (a parte que não toca o servidor)

### O que entrou

`src/storage/encryption.js`: AES-GCM 256 com chave derivada por PBKDF2
(SHA-256, 310.000 voltas, salt de 16 bytes e IV de 12 novos a cada gravação),
tudo em Web Crypto, sem dependência. Os metadados que precisam ficar em claro
pro servidor comparar revisão (`format_version`, `revision`, `device_id`) entram
como dados autenticados: dá pra ler, não dá pra falsificar.

31 testes contra a Web Crypto de verdade, sem dublê: o que sai não contém nome,
valor nem senha; a ida e volta bate; senha errada falha com erro nomeado; um
byte trocado no conteúdo, no IV, na revisão ou no `device_id` quebra a
decifragem; IV e salt nunca se repetem; envelope malformado é recusado por
motivo específico.

**A sincronização continua gravando em texto puro.** Ligar a criptografia exige
mudar o Supabase, e isso depende de aprovação — o desenho está em
[SYNC-DESIGN.md](SYNC-DESIGN.md) e o SQL em
`supabase/migrations/0001_sync_seguro.sql`. Nada aplicado.

### A proteção que já está no ar

A validação passou a recusar duas coisas que antes atravessariam como "campos
desconhecidos" e virariam um `data` vazio:

- **envelope cifrado** — uma versão do app que não sabe decifrar não vai
  confundir a cópia da nuvem com backup e salvá-la por cima;
- **objeto sem nenhum campo do Aoii** — arquivo de outro app, ou formato futuro.

Sem isso, a migração para o formato cifrado seria perigosa para quem tivesse um
aparelho na versão antiga. Por isso entrou antes.

### Decisões do desenho

**O código de sincronização deixa de ser credencial** e vira endereço. A senha,
escolhida pelo usuário, vira a chave — e nunca sai do aparelho.

**Token de escrita derivado da senha**, com o servidor guardando só o hash. É o
que impede quem descobriu o código de sobrescrever os dados, sem precisar de um
sistema de contas. Não substitui `auth.uid()` com RLS por usuário; resolve o
caso prático.

**Acesso por função, não por tabela.** RLS não sabe exigir "só se você filtrar
por id": com `SELECT USING (true)`, a chave `anon` baixa a tabela inteira. Duas
funções `SECURITY DEFINER` resolvem isso e ainda dão lugar ao controle de
revisão.

**Não há recuperação de senha**, e isso é dito antes de o usuário escolher uma.
O servidor nunca tem a chave; a nuvem é espelho, não original.

### Um campo esquecido, e a checagem que veio dele

Ao começar a mexer na sincronização, apareceu que `data.snapshotsMensais` não
estava no esquema — então era descartado a cada leitura, e o app mandaria um
snapshot novo pra nuvem toda vez que abrisse. Junto com ele, `revisoesVistas` e
`temaAutoNoite`.

Era exatamente a falha que a rodada 2 documentou (campo em dois dos três lugares
se perde em silêncio), e aconteceu na semana seguinte. Documentar não bastou:
`npm run lint` agora compara todo `data.x` usado em `src/` com o que o esquema
declara.

## Retomada em 08/09/2026 — fila e diálogos da sincronização

Continuação do checkpoint `2e2383d` de Claude, no branch
`refactor/estrutura-seguranca`. A interface de senha, migração e conflito já
existia nesse checkpoint; as seções anteriores registram rodadas históricas.

- A fila agora registra geração, revisão confirmada e pendência no aparelho.
  Alterar durante um envio exige outra rodada; fechar antes dos 1,5 segundos
  não perde a pendência. Reabrir mantém os dados locais até destrancar.
- Abrir, ler e migrar não substituem uma edição feita durante a espera da rede.
  A releitura confirma o próprio envelope, sem adotar uma revisão concorrente.
- Adotar a nuvem não cria um envio de eco. Falhas de rede têm espera crescente;
  adiar conflito pausa a fila até uma ação explícita.
- Senha, conflito e confirmação compartilham foco inicial, Tab circular,
  Escape, bloqueio do fundo por `inert` e restauração do foco. Status e erros
  têm anúncio acessível; os textos novos existem nos cinco idiomas.
- O roteiro de homologação limpa somente seus próprios IDs, inclusive no
  teste de criação abusiva. Não usa mais prefixos amplos de outros ensaios.

Validação final: 367 testes locais (49 novos), 31 verificações contra a homologação
real, lint sem novas violações e auditoria estrutural limpa. A interface foi
ensaiada em duas origens com armazenamento independente no mesmo navegador.
O teste em dois navegadores/perfis distintos ainda precisa ser repetido.
Roteiro, evidências e limites em [HOMOLOGACAO-2026-09-08.md](HOMOLOGACAO-2026-09-08.md).

A continuação da rodada removeu a senha do estado da sessão: depois da entrada,
ficam somente uma `CryptoKey` AES-GCM não exportável e o token de escrita em
memória. Também removeu o fallback de `Math.random()` para códigos de segurança.
Código novo ou legado agora exige a etapa de backup; cancelar restaura o código
e a sessão anteriores. Envelope corrompido também não deixa material parcial na
sessão. O fluxo completo de migração foi exercitado na interface. Os diálogos de
senha e conflito foram separados em módulo próprio; nenhum módulo ficou acima
do limite de manutenção de 400 linhas.

Nenhuma publicação, push, alteração de política ou migração de banco nesta
rodada. As proteções deste branch não devem ser confundidas com o site em produção.

## Retomada em 09/09/2026 — cobertura das traduções

A interface estática e os principais textos montados durante o uso foram
revisados nos cinco idiomas. Temas, moedas, campos, dicas, simuladores,
orçamentos, evolução mensal, onboarding, consultor e alertas de metas agora usam
o mesmo dicionário, com 697 chaves por idioma.

As seis categorias históricas continuam gravadas em português para preservar
backups e cálculos; somente o nome apresentado é traduzido. Categorias criadas
pela pessoa continuam exatamente como foram cadastradas. A moeda escolhida
também atualiza os símbolos dos campos de valor.

A auditoria passou a impedir texto estático, placeholder, título e nome
acessível sem chave de tradução. Ela também recusa `data-i18n` em um elemento
que contenha botões ou outros filhos, pois a substituição do texto apagaria
esses controles. A suíte inclui a tradução das categorias sem mudança nos
dados. A interface foi conferida localmente em português, inglês, espanhol,
francês e italiano, inclusive troca de tema, moeda e preservação das dicas.

Nenhuma publicação, push ou alteração no Supabase foi feita neste bloco.

## O que vem, em ordem

1. **Concluir a preparação da transição.** Repetir a interface em navegadores
   distintos e preparar preview e rollout para aprovação.
   A parte 2 do banco foi aplicada depois disso, com os aparelhos já na versão
   nova. Conferido em 10/09/2026: a tabela não tem mais grants pro anon nem
   políticas, e a linha ativa foi gravada cifrada no mesmo dia. Ver a pendência 1
   de SECURITY.md.

2. **Desempenho e PWA.** Ícones e manifesto para fora do HTML; precache do
   shell; fallback offline; redesenho por seção em vez da tela inteira.
3. **SEO e design.** Landing pública indexável, área do app fora do índice;
   hierarquia do Resumo; estados vazios com ação.

Uma camada de comandos de domínio (`addTransaction()`, `registerIncomePayment()`,
`updateGoal()`…) atravessa a etapa 1; agora que a validação existe, é o próximo passo
estrutural — ver o fim de [ARCHITECTURE.md](ARCHITECTURE.md).


## Retomada em 09/09/2026 — acessibilidade da interface

Configurações, onboarding, tour e os seis painéis inferiores agora controlam
foco inicial, Tab circular, Escape, bloqueio do fundo e retorno do foco ao
controle que abriu a tela. O mesmo mecanismo cobre diálogos aninhados, como a
edição de cartão aberta por dentro das Configurações.

A navegação informa a tela ativa; seletores de categoria, pagamento, renda e
investimento informam o estado selecionado. Campos passaram a ter rótulos
associados, regiões de status anunciam mudanças e ações de editar ou excluir
dizem qual item será afetado. Os textos dinâmicos acrescentados existem nos
cinco idiomas, agora com 705 chaves em cada dicionário.

A interface foi conferida com estado vazio e com o backup fornecido para o
ensaio, sempre em origens locais isoladas. Também foram exercitados abertura
por Enter, foco inicial no valor, fechamento por Escape e restauração do foco.
A suíte mantém 370 testes e ganhou verificações estruturais para os diálogos e
a navegação principal.

Nenhuma publicação, push ou alteração no Supabase foi feita neste bloco.


## Retomada em 09/09/2026 — instalação e uso offline

O manifesto, o favicon, o ícone do iPhone e o logotipo deixaram de ser blocos
base64 dentro da página. Agora são arquivos próprios em `public/`, com caminhos
estáveis para o navegador e para o sistema operacional. O HTML gerado caiu de
1.164.087 para 992.568 bytes, uma redução de aproximadamente 15% na resposta
principal.

O service worker guarda o shell de instalação na primeira abertura e mantém a
navegação em rede primeiro, usando a cópia local quando a rede falha. A versão
do cache passa a ser calculada pelo build a partir do conteúdo; uma publicação
nova não depende mais de incrementar um número manual. O próprio build também
confere se todos os arquivos de `public/` chegaram atualizados a `dist/`.

A auditoria recusa manifesto ou ícones embutidos, caminhos quebrados e service
worker sem versão de conteúdo. A prova no navegador abriu uma origem nova,
instalou o shell, desligou o servidor e recarregou o Aoii completo a partir do
cache. Permanecem para o próximo bloco a medição e a redução dos redesenhos da
interface após cada edição.

Nenhuma publicação, push ou alteração no Supabase foi feita neste bloco.

## Retomada em 09/09/2026 — atualização por aba

`render()` reconstruía as cinco telas depois de qualquer edição, mesmo com quatro
delas ocultas. Listas, gráficos e cartões distantes da ação eram recriados e seus
eventos ligados de novo sem benefício visível.

Os renderizadores agora estão agrupados por `view-*`. Uma alteração marca todas
as telas como pendentes, atualiza a tela ativa imediatamente e adia as demais até
que a pessoa abra a aba correspondente. O painel de configurações também é
preenchido ao abrir, em vez de acompanhar toda alteração feita fora dele.

A regra financeira não mudou: a timeline continua invalidada na persistência e
no início do desenho, e a primeira abertura de cada aba usa o estado mais recente.
O teste no navegador confirmou o caso crítico: um lançamento feito no Resumo não
reconstrói o Diário oculto, mas aparece com valor e descrição corretos assim que o
Diário é aberto. As cinco abas e o painel de configurações foram percorridos, e os
370 testes mais a auditoria estrutural continuaram limpos.

## Retomada em 09/09/2026 — primeiras fronteiras corrigidas

O cálculo de orçamento por categoria continua em `core/budgets.js`, mas a
montagem dos cartões, os eventos dos campos e a gravação passaram para
`ui/budgets.js`. Da mesma forma, `core/insights.js` devolve apenas os dados dos
insights; `ui/insights.js` escolhe o ícone e constrói a interface.

A busca do nome de um cartão foi movida de `ui/effects.js` para
`core/helpers.js`, pois é uma consulta ao estado usada pelo relatório e pelo
resumo enviado à IA. Com isso, seis dependências invertidas saíram da baseline:
ela caiu de 17 para 11, sem criar nenhuma nova.

## Retomada em 09/09/2026 — calculadora e BrasilAPI separadas

`core/interest.js` agora contém somente mediana, consulta da taxa disponível e
as fórmulas de juros. `integrations/brasil-api.js` apenas consulta e interpreta
a resposta pública. Estado, persistência, mensagens e campos ficaram em
`ui/interest.js`.

A mensagem de consulta das taxas deixou de estar fixa em português e ganhou
tradução nos cinco idiomas. A fórmula passou a ter testes diretos de principal,
aporte, taxa zero, juros simples e compostos. Quatro dependências saíram da
baseline, que passou de 11 para 7.

## Retomada em 09/09/2026 — cálculos usados pela IA

O score de saúde financeira, o custo mensal essencial e os tipos de investimento
saíram dos módulos visuais e passaram para `core/health.js`, `core/reserve.js` e
`core/investments.js`. Os componentes continuam nos mesmos arquivos de interface
e chamam as mesmas funções.

O resumo enviado à IA agora depende apenas de dados, internacionalização, núcleo
e integrações. Três dependências invertidas saíram da baseline, que caiu de 7
para 4.

## Retomada em 09/09/2026 — fronteiras zeradas

`defaultData()` e `migrateData()` passaram de `data/defaults.js` para
`core/defaults.js`. Essas rotinas não são dados estáticos: elas criam o estado
inicial, convertem valores de versões antigas e aplicam regras usando datas,
categorias, números e identificadores do núcleo.

As quatro dependências invertidas restantes desapareceram sem copiar funções nem
alterar o formato salvo. A baseline de arquitetura agora está vazia: os 77
módulos respeitam integralmente o fluxo `data → i18n → core → storage →
integrations → ui`.

## Retomada em 09/09/2026 — identificadores locais

A geração de ids foi centralizada em `data/ids.js` e compartilhada pela criação
de itens e pela fronteira de validação. Navegadores atuais usam Web Crypto; o
degrau de compatibilidade usa instante e contador, sem `Math.random()`.

A suíte agora gera 200 ids reais e confere unicidade, tamanho e caracteres. O
projeto passa a ter 78 módulos e continua sem nenhuma inversão de camada.

## Retomada em 09/09/2026 — primeiros comandos de domínio

Criação, edição, remoção e restauração dos lançamentos do Diário passaram a ser
operações únicas em `core/transactions.js`. Cada comando altera o lançamento e
seu efeito no saldo em conta ou no dinheiro vivo no mesmo ponto; a interface não
repete mais a regra de sinais ao editar ou desfazer.

Os comandos recusam valor ou método inválido antes de tocar nos dados e recebem
data, viagem, tags, nota e divisão já na criação. Os testes cobrem troca de gasto
por entrada, mudança entre conta e dinheiro vivo, desfazer e recusa sem efeito
parcial. Este é o primeiro domínio da camada de comandos; os demais serão
movidos em blocos menores.

## Retomada em 09/09/2026 — repetir gasto

O botão “Repetir último gasto” agora procura o lançamento de despesa mais
recente. Antes, uma entrada inesperada no topo do Diário podia ser recriada como
gasto. A repetição também preserva nota, tags, viagem e divisão e usa a data
atual para o novo lançamento.

## Retomada em 09/09/2026 — textos dinâmicos e CSV

Avisos de vencimento e fechamento passaram a usar o dicionário central nos
cinco idiomas. Etiquetas de compras parceladas e cabeçalhos, tipos, categorias,
métodos e números do CSV também respeitam o idioma escolhido.

## Retomada em 09/09/2026 — comandos de metas

Criar, editar, remover e restaurar metas passaram para `core/goals.js`. Alterar
o valor guardado move somente a diferença no saldo da conta; excluir devolve o
valor e desfazer o separa novamente. Assim essas ações não criam nem apagam
patrimônio. Entradas inválidas são recusadas antes de qualquer alteração.

## Retomada em 09/09/2026 — comandos de renda recorrente

Criação, edição, remoção e restauração de rendas recorrentes passaram para
`core/income.js`. Tipo, valor e dia são validados antes da alteração; uma edição
inválida não deixa campos parciais. Os nomes dos tipos também passaram a usar os
cinco dicionários da interface.

## Retomada em 09/09/2026 — comandos de cartões

Criação, edição e remoção de cartões passaram para `core/cards.js`, inclusive o
cartão opcional do onboarding. Os campos são validados antes da alteração. Ao
excluir um cartão, suas faturas e compras planejadas migram para o primeiro cartão
restante; faturas do mesmo mês são fundidas sem perder valores, gastos ou uma
pendência de pagamento. Se era o último cartão, as referências ficam vazias e os
registros financeiros são preservados.

## Retomada em 09/09/2026 — comandos de faturas

Criar, atualizar, quitar e remover faturas passaram para `core/invoices.js`,
assim como editar ou remover seus gastos e excluir todas as parcelas de uma
compra. Quitar uma fatura marca seus gastos como pagos na mesma operação. Datas,
valores e referências são validados antes de alterar o estado; uma fatura
existente também pode ser zerada de forma explícita.

## Retomada em 09/09/2026 — comandos de gastos fixos

Criação, edição, remoção e restauração de gastos fixos passaram para
`core/fixed-expenses.js`. Valor, dia, início, categoria e estado ativo são
validados juntos antes da alteração. A exclusão por gesto e seu desfazer agora
usam os mesmos comandos da ficha de edição.

## Retomada em 09/09/2026 — comandos de investimentos

Investimentos agora são criados, editados, removidos e restaurados por
`core/investments.js`. Tipo, valor, taxa opcional e dividendos são validados
antes da alteração; editar preserva a data de criação e o desfazer restaura a
posição original na lista.

## Retomada em 09/09/2026 — preferências financeiras

Saldo, dinheiro vivo, renda principal, data-alvo e reserva agora passam por
`core/preferences.js`. Entradas inválidas são recusadas antes de alterar a
projeção; valores de saldo registram sua data de atualização e a data-alvo exige
um dia real do calendário.

## Retomada em 09/09/2026 — listas e planejamento

Categorias e viagens passaram para `core/settings-lists.js`. Ao excluir uma
categoria, os registros que a usavam são migrados para uma categoria existente e
o limite de orçamento correspondente sai junto. Ao excluir uma viagem, os
lançamentos continuam preservados sem uma referência inválida.

Entradas extras e compras planejadas passaram para `core/planned.js`. A criação,
edição, conclusão, remoção e restauração validam o conjunto de campos antes de
alterar a lista. Registrar parte de uma entrada também cria a receita no Diário;
concluir uma compra no cartão lança suas parcelas uma única vez.

## Retomada em 09/09/2026 — regras de cálculo na origem

Os limites de orçamento por categoria são validados em `core/budgets.js`, e as
taxas CDI e Selic em `core/interest.js`. Atualizações inválidas são recusadas sem
misturar valores novos e antigos.

`core/dates.js` passou a controlar os dias de trabalho e as folgas. Dias da
semana são ordenados sem repetição; folgas exigem datas reais no formato ISO.
Como a projeção de renda diária depende dessas listas, essa validação agora fica
antes da persistência.

O onboarding usa `configurarPerfilFinanceiro()` em `core/preferences.js`, a mesma
regra que atualiza renda e saldo nas configurações. Assim, o primeiro acesso não
abre uma exceção para dados inválidos ou estado parcial.


## Retomada em 10/09/2026 — calculadora e conversor de moedas

Duas ferramentas no topo, ao lado das configurações. Nenhuma delas escreve em
`data`, e essa foi a decisão que precisava ser tomada.

A calculadora não guarda nada. Ela avalia a expressão em `core/calculator.js`,
com uma gramática de vinte linhas — **não existe `eval()`**, e é de propósito:
o app guarda dinheiro, e "só desta vez" é como essa porta costuma se abrir. O
avaliador devolve `NaN` para tudo que não fecha (expressão pela metade,
parêntese solto, divisão por zero) em vez de chutar um número.

O conversor guarda a tabela de cotações em `localStorage` (`aoii-cambio`), não
em `data`. Dois motivos: a tabela muda todo dia e faria a sincronização gravar
na nuvem por causa de um dado público que qualquer aparelho busca sozinho; e ela
não é informação do usuário — perdê-la custa uma ida à rede, não custa um dado
dele. Por isso ela também não passa pelo esquema nem pela migração; quem valida
é `tabelaDeCambioValida()` em `core/fx.js`, na entrada.

A fonte é a api.frankfurter.dev, que republica as taxas de referência do Banco
Central Europeu: sem chave, sem cadastro, CORS aberto. São taxas de referência
publicadas uma vez por dia útil, não cotação de mercado ao vivo — a tela mostra
a data de cada uma para que as duas coisas não sejam confundidas. Sem rede, a
tabela guardada continua respondendo e a nota passa a dizer de quando ela é.

A conversão entre duas moedas que não são a base é uma divisão só
(`taxas[para]/taxas[de]`), não dois saltos pela base — dois saltos dariam o
mesmo número arredondando duas vezes.

## Retomada em 11/09/2026 — varredura de defeitos e primeira experiência

Varredura completa do `src/` atrás do que o portão de qualidade não vê. Os
`npm run check` passavam inteiros antes e depois: testes, tradução, contraste,
CSS e ids nunca reprovaram nada disto. O que segue é o mapa dos pontos cegos.

### O que o portão não enxergava

**Fuso horário.** Três validações de data comparavam o texto digitado com
`toISOString().slice(0,10)`, que lê a data em UTC. Em UTC+13 e UTC+14 o meio-dia
local já é o dia anterior em UTC, e toda data boa era recusada — em silêncio,
porque a interface descartava o `null` sem avisar. Na Nova Zelândia, UTC+12 no
horário padrão, a falha aparecia só nas datas dentro do horário de verão: de fim
de setembro a início de abril não dava para marcar compra planejada, entrada
extra, meta nem mudar a data-alvo. A suíte roda num fuso só e não tinha como
notar. A sonda (`testes/fuso-sonda.js`) roda num processo à parte porque o fuso
do Node se fixa na partida.

**Campo que o rótulo diz ser opcional.** `parseNum('')` devolve `NaN`, que é
certo para um campo obrigatório e errado para um opcional. O `NaN` descia até a
validação, que recusava o registro inteiro. "Limite (opcional)" em branco
impedia salvar o cartão, sem mensagem nenhuma. `parseNumOpcional()` separa os
dois casos: branco vale zero, texto ilegível continua `NaN`.

**Campo lido e nunca guardado.** A folha "Novo gasto" perguntava Viagem, Tags e
Nota também com "Crédito" selecionado, e lia os três no envio — mas
`lancarParcelamento()` não tinha onde guardar. O efeito passava do cosmético: o
orçamento de viagem era medido só sobre `data.transacoes`, então gasto de viagem
no cartão não contava. Lição de forma: campo que a tela mostra tem que ter
destino no esquema, senão vira dado perdido em silêncio.

**Recusa silenciosa.** O padrão `if(!salvo) return` aparecia em quatro lugares.
Do lado de quem usa, o botão simplesmente não faz nada. O pior era o assistente
de primeiro uso, que fechava e marcava o onboarding como concluído mesmo sem ter
criado o cartão.

### Decisões

**Nome de pessoa e de instituição não vai para a IA.** Credor, nome do cartão e
nome livre da renda saíram do resumo mandado ao Gemini; os cartões vão como
"Cartão 1". A linha que ficou: nome de **pessoa ou instituição** não sai; rótulo
que a própria pessoa escreveu sobre a vida dela (metas, viagens, contas fixas,
compras) sai, porque sem ele não dá para perguntar sobre uma delas pelo nome.
Quem quiser um resumo sem nome nenhum mexe em `montarResumoFinanceiroParaIA()`,
que é o único lugar que monta o texto. Fecha a pendência 6 de
[SECURITY.md](SECURITY.md).

**O palpite de primeiro uso vem do navegador.** Idioma e moeda nasciam fixos em
português e real. A moeda sai da **região** da etiqueta quando ela existe, não
do idioma: `pt-PT` é euro e `pt-BR` é real. Só `defaultData()` — `migrateData()`
não encosta em quem já tem dados salvos.

**Número que mede ausência de problema não é medida.** A saúde financeira dava
70/100 num app recém-instalado: três quartos da nota vinham de ainda não haver
nada cadastrado. Sem renda e sem despesa, `computeSaudeFinanceira()` devolve
`score: null` e o cartão diz o que falta. Vale como regra geral para indicador
novo: se a fórmula pontua a ausência, ela precisa de um estado "ainda não".

**A data-alvo padrão tem horizonte mínimo.** 31 de dezembro funciona dez meses
por ano e falha nos outros dois: em 20 de dezembro a previsão era de onze dias,
em 31 de dezembro de zero. Com menos de um trimestre até lá, o alvo passa a ser
o dezembro seguinte.

**Texto de interface não mora em módulo de tela.** Os 25 pares de título e texto
do tour estavam escritos à mão em `ui/onboarding.js`, um bloco por idioma. Como
não passavam por `L()`, a auditoria não os enxergava: um sexto idioma entraria
com o tour calado em português sem nada reprovar. Em `onboarding.js` ficou só o
alvo de cada passo.

**Afordância de toque fica fora da ordem de tabulação.** Os botões que o
arrastar revela ficam num painel absoluto coberto pelo conteúdo: invisíveis ao
olho, sempre presentes para o teclado, duas paradas por item repetindo ações que
já têm botão visível. Nas compras no crédito nem estavam ligados a nada.

### Pendências que ficaram

- **Dividir com alguém não existe no crédito.** O controle some quando "Crédito"
  está selecionado, e `lancarParcelamento()` recebe o valor cheio. Rachar a
  conta de um restaurante pago no cartão é o caso mais comum de divisão, e hoje
  não tem como. Exige decidir o que a fatura deve mostrar — o valor cheio, que é
  o que o banco vai cobrar, ou a parte de quem lançou.
- **O Resumo vazio ainda é andaime.** Com a saúde sem nota, sobram limite vazio,
  categorias vazias, orçamento e calendário na primeira abertura. O ponto fraco
  não é a estética, é não haver um caminho único e óbvio antes de haver dados.

### Depois de publicar — o que só apareceu com o app no ar

**Buscar da nuvem ao voltar pra tela.** A fila de envio foi consertada e a
sincronização voltou a funcionar, mas ficou lenta de um jeito que não existia
antes: mudar no computador e só ver no telefone um tempo depois. O envio não
era o culpado — os 400 ms do espelho são ~4% da espera. Quem recebe é que só
perguntava de 20 em 20 segundos, e o navegador do celular estrangula
`setInterval` em aba escondida, às vezes congelando de vez.

Pegar o aparelho na mão é o instante em que a resposta importa, e é o mais
barato de atender: buscar no `visibilitychange` troca uma espera de até 20 s
por uma leitura na hora certa e faz **menos** leituras que encurtar o
intervalo, porque não busca nada enquanto ninguém olha. O relógio de 20 s fica
como rede de segurança para quem deixa a aba aberta na frente.

**Conteúdo vivo dentro de elemento animado.** `countUpAll()` anima escrevendo
`textContent` no elemento que carrega o `data-countup`. O botão de ajuda do
hero era filho desse elemento, então sumia na primeira vez que o valor mudava e
só voltava no render seguinte. Regra que vale para o próximo: **nada além do
número mora dentro de um elemento com `data-countup`.**

**Chave a mais engole regra inteira.** Em `enhancements.css` havia um `}` no
meio de uma regra: fechava o `::after` cedo e transformava quatro declarações
em lixo solto, que o navegador descarta sem avisar. Resultado: nenhum botão
informativo do app tinha `cursor:pointer`. E consertar acordou um
`margin-left` que estava dormindo, mudando o espaçamento em outro lugar —
reviver CSS morto mexe na cascata, e o efeito aparece longe do conserto.

### Varredura com o navegador — o que só aparece rodando

Com um arnês de CDP dirigindo o Chrome de verdade (zero dependência: Node 22+
já traz `WebSocket`), deu pra procurar o que nenhum teste de unidade alcança.
Achados, e a lição de cada um:

**O hero corta o que não cabe.** `.hero` tem `overflow:hidden`, então excesso
não vira rolagem: some. Num aparelho de 320 px as fichas em duas colunas
saíam 163 e 140 px — `1fr` não manda sozinho, porque cada faixa também não
pode ficar menor que o conteúdo, e o valor é `white-space:nowrap`. Piorava com
o saldo: R$ 3.500 perdia 19 px do "A pagar", R$ 98.750 perdia 57. O número
grande tinha o mesmo problema por outro caminho — piso de 38 px do clamp num
espaço de 230. **Regra para o próximo:** medir com valor grande e tela
pequena, não com o cenário bonito.

**Dois toques, dois registros.** Todo botão que grava tem um `await persist()`
entre o começo do tratador e o `close()`. O segundo toque cai na fresta. Falha
em quatro dos dez lugares; os outros seis escapavam por acidente, porque
limpam o campo antes do `await`. `umEnvioPorVez()` fecha o ferrolho de forma
síncrona, antes do primeiro `await`, e vale para os dez.

**Medir não é ver.** Três achados desta rodada eram defeito da medição, não do
app: `getBoundingClientRect` devolve caixa para conteúdo de `<details>`
fechado (o Chrome guarda o layout mas não pinta nem deixa tocar), medir a aba
escondida dá zero em tudo, e `navigator.onLine` não acompanha a emulação de
rede do CDP. Quando a pergunta for "dá pra tocar nisso?", quem responde é
`elementFromPoint`, não conta de retângulo.

### O que a varredura confirmou que está de pé

Os cinco caminhos principais fecham do toque ao dado salvo (lançar gasto,
crédito virando parcelas sem mexer no saldo, gasto fixo, meta, remover e
desfazer). O backup vai e volta sem perder nada — 24 lançamentos, tags,
notas, parcelas de fatura, credor e dividendos. Offline o app abre do cache,
anota gasto, e as ferramentas que dependem de rede avisam em vez de quebrar.
Nenhum campo abaixo de 16 px, que é o que faz o iOS dar zoom sozinho.

## Retomada em 11/09/2026 — as duas pendências do Supabase

As duas que mexiam em dado de verdade foram fechadas. Ficam registradas aqui
porque a ordem importa e a segunda não tem desfazer.

**A gêmea de homologação saiu da produção** (`0008`). `financas_homolog` tinha
quatro políticas abertas para `public` — `SELECT`, `INSERT`, `UPDATE`,
`DELETE` — sem token, sem revisão e sem o teto de 5 MB por linha que a
`financas` herdou da parte 1. Qualquer um com a chave `anon`, que está no HTML
publicado porque tem que estar, inseria o que quisesse até estourar a cota.
Tinha zero linhas: a perda era a porta, não o conteúdo. Conferido depois:
tabela, as duas funções `aoii_*_homolog` e as quatro políticas não existem
mais. Rollback é reaplicar `0003` e `0005`, ambos idempotentes.

**Não há mais texto puro na nuvem** (`0007`). Eram 18 linhas, 5 cifradas e 13
em texto puro. Três das 13 eram snapshots mensais do código **ativo**, com o
id derivado do próprio código: quem soubesse o código montava
`CODIGO-snap-2026-9` e lia o mês inteiro pela `aoii_get`, sem senha nenhuma. A
criptografia da linha ativa estava sendo contornada pela porta ao lado.

A ordem foi a que o próprio repositório prescreve, e não dá pra inverter:
exportar com `scripts/exportar-legado.js`, **conferir os arquivos** (13/13
legíveis, com saldo e listas), e só então apagar. O apagamento foi por lista
de ids explícita, não por predicado — conferido antes que os 13 alvos eram
exatamente o conjunto em texto puro e que nenhum deles estava cifrado. Estado
depois: 5 linhas, 5 cifradas, 0 em texto puro. A cópia local ficou em
`aoii-legado-2026-09-11/`, fora do repositório.

**O que sobrou aberto:** a pendência 5 (chave do Gemini em texto puro no
`localStorage`) e a 9 (`aoii_put` cria linha sem exigir token, e não pode ser
diferente — se exigisse, ninguém ligaria a sincronização a primeira vez). As
duas estão descritas em [SECURITY.md](SECURITY.md) e nenhuma expõe dado que já
esteja lá.

### Ainda em 11/09 — o teto que a gêmea escondia

Fechar o `0008` deixou à mostra um efeito colateral: a tabela `aoii_limites`
tinha os quatro valores configurados desde 10/09, mas **quem os consultava era
só a `aoii_put_homolog`**. Removida a gêmea, sobrou em pé apenas a função de
produção — que não lia teto nenhum.

Ou seja: por algumas horas, o único caminho de escrita era o sem limite. A
metade que faltava do `0006` foi aplicada e isso acabou. A lição é de ordem:
**tirar o sandbox pode desproteger a produção, quando era o sandbox que
carregava a proteção.** Vale conferir o que sobra de pé antes de remover
qualquer gêmea.

O corpo novo de `aoii_put` é idêntico ao anterior fora os três tetos lidos da
tabela, então o uso legítimo não muda. Conferido ponta a ponta pela chave
`anon`, como o app faz: criar, reler e atualizar passam; token errado, token
curto, id curto, revisão velha e linha acima de 5 MB são recusados; a tabela e
a própria `aoii_limites` continuam fora do REST (HTTP 401).

### Ainda em 11/09 — a primeira busca era vinte segundos depois

O conserto anterior (buscar no `visibilitychange`) resolveu metade do problema
e eu declarei vitória cedo demais. O relato voltou: "ainda demora".

`setInterval(ciclo, 20000)` **só dispara na primeira virada do relógio**. Abrir
o app era: ler o disco, desenhar o valor velho, restaurar a sessão, e ficar com
o valor velho na cara por 20 segundos antes de perguntar qualquer coisa à
nuvem.

E abrir o app é exatamente o que o celular faz. O sistema descarta a página
quando você troca de aplicativo, então voltar não é "aba reaparecendo" — é
carregar de novo. Por isso o `visibilitychange` não cobria: a página já nasce
visível, não há transição nenhuma para ouvir.

Eram **dois casos diferentes com o mesmo sintoma**, e o primeiro conserto
pegou só um. Medido pela rede (`Network.requestWillBeSent`, tempo entre
carregar e o primeiro `aoii_get`), três voltas cada:

| | antes | depois |
|---|---|---|
| primeira leitura da nuvem | 20,3 s | **0,4 s** |

A lição: quando o sintoma persiste depois de um conserto que você mediu e
aprovou, o mais provável é que existam duas causas, não que a medição
estivesse errada. Medir o caminho certo teria mostrado isso de primeira —
`visibilitychange` foi medido, mas "abrir o app do zero" não.

### 12/09 — o resumo do mês somava dinheiro que ainda não existia

O "Exportar resumo do mês" é o documento que a pessoa entrega ao contador.
Gerado no dia 12 de setembro, ele dizia `Total de receitas R$ 17.500,80` —
somando um salário que só cai no dia 20 — e `Total de despesas R$ 12.154,47`,
misturando um débito do dia 3 com uma assinatura que vence no dia 20 e uma
compra no cartão cuja fatura ninguém pagou.

Nenhum desses dois números batia com extrato nenhum. Um demonstrativo assim
não é conferível, e conferível é a única coisa que ele precisa ser.

**O que mudou.** Toda linha de dinheiro passa a nascer com `realizado`, em
regime de **caixa**: o dinheiro entrou ou saiu até hoje. O documento tem duas
colunas, dois totais por seção e um total do mês; a caixa de resultado mostra o
realizado no período e, abaixo e menor, o projetado para o mês fechado.

O critério está impresso no próprio documento, logo abaixo do período — quem
recebe o papel não precisa perguntar o que a coluna quer dizer:

- renda mensal e recorrente contam depois do dia delas;
- renda diária vira duas linhas, dias trabalhados e dias que faltam;
- conta fixa: passou o dia, ou marcada como paga;
- compra no cartão: fatura paga, ou vencida.

Essa última regra é a mesma que o app já usava para parar de descontar uma
despesa da projeção — e que já valia para conta fixa desde o `fixo-pago`. O
relatório só passou a respeitá-la.

**O que passou a aparecer.** Entradas ainda não recebidas (sumiam do documento
inteiro), dívidas em aberto, investimentos, viagens, reserva de emergência com
objetivo e custo essencial, e o patrimônio aberto em parcelas. Seção sem
conteúdo não é impressa e a numeração se ajusta — quem não tem dívida não
recebe uma folha dizendo "nenhuma dívida".

**Onde mora.** `ui/report.js`, novo. Eram 127 das 400 linhas de `bindings.js`,
e quase tudo ali é marcação de um documento inteiro.

**A planilha, logo depois.** O CSV que existia era do Diário: só
`data.transacoes`. No mesmo cenário isso deixava de fora R$ 6.065,80 de
R$ 12.154,47 — a fatura do cartão e as contas fixas inteiras. Quem recebesse os
dois arquivos via dois totais do mesmo mês e não tinha como saber qual valia.

O botão novo, ao lado do de imprimir, sai do MESMO cálculo do documento: uma
linha por lançamento, com data ISO, a coluna `Situação` (Realizado/Previsto) e
sem emoji dentro de célula. A compra no cartão é datada pelo **vencimento da
fatura**, que é o dia em que o dinheiro sai da conta — é essa data que bate com
o extrato, não a da compra. Conferido no navegador: os quatro subtotais da
planilha fecham com os do documento impresso, centavo por centavo.

O CSV do Diário continua onde estava; ele responde outra pergunta ("o que eu
lancei"), e misturar as duas em um arquivo só é o que criava a confusão.

### 12/09 — a linha do tempo por onde só dava pra rolar

Com onze meses cadastrados, a Linha do tempo tinha **12.992 px de altura no
telefone**. Cada mês era um card com tudo aberto — renda, fixos, fatura,
compras, saldo — e ocupava quase uma tela inteira. Comparar setembro com
janeiro custava meio minuto de rolagem, e todos os cards se pareciam. Uma
linha do tempo por onde só se pode rolar não é uma linha do tempo.

Virou uma lista de faixas que abrem. Fechada, a faixa tem 67 px e diz o que se
quer saber de relance: mês, peso das despesas sobre a renda, saldo e o previsto
em conta. Aberta, é o mesmo detalhe editável de antes. **12.992 px → 1.417 px**,
de quinze telas para menos de duas, e sete meses visíveis de uma vez.

O estado de aberto mora em `mesesAbertos`, um Set fora da montagem. `render()`
remonta a lista a cada valor que muda; com o estado no DOM, editar um gasto
fechava o mês debaixo do dedo.

**Quatro defeitos que apareceram na medição**, e que valiam por si:

1. **O campo de valor da fatura estava soterrado.** `.month-cartao-tag` tinha
   `flex:none` — com nome de cartão comprido ("Nubank Ultravioleta Mastercard
   Black") a etiqueta crescia sem limite, passava por cima do campo e recebia o
   clique no lugar dele. No desktop ainda vazava 112 px para fora do card,
   invadindo o mês vizinho. Com nome de cartão curto ninguém notava.
2. **Número cru ao lado de número formatado:** `430.2` e `R$ 0,00` no mesmo
   card, em 17 campos. Agora tudo passa por `formatValorSemMoeda()` e volta
   por `parseNum()`.
3. **Quatro linhas dizendo "R$ 0,00" no mês corrente.** O card desenhava o
   `custo` — o que ainda falta sair — que zera quando o dia passa. Lia-se
   "meu aluguel é zero". Agora mostra o valor cheio riscado com "paga ✓", e a
   renda já recebida diz "tudo recebido ✓".
4. **Alturas desencontradas**, de 417 a 641 px na mesma fileira. O formato de
   lista resolve por construção: toda faixa fechada tem a mesma altura.

**As duas barrinhas** do topo do card não tinham legenda nem escala — ninguém
sabia o que mediam. Viraram uma barra só, com significado declarado: quanto da
renda do mês as despesas comem, em vermelho quando passa de 100%, e o número
por extenso dentro da faixa aberta. Quando não há renda prevista, a barra não
é desenhada em vez de fingir uma proporção.

O **modo compacto** saiu: era um interruptor tudo-ou-nada que escondia todas as
linhas, e a faixa fechada já é o compacto. O **"+ Adicionar mês"** saiu do meio
da lista, onde tinha o tamanho de um mês e parecia um.

Medido no navegador: nada vaza da faixa, nenhum alvo de toque abaixo de 32 px
(a convenção do resto do app), todo campo de dinheiro formatado, e editar
dentro de um mês aberto não o fecha.

**A roda do mouse não passa por `touch-action`.** O conserto anterior do
encadeamento de rolagem pôs `touch-action:pinch-zoom` nos panos de fundo, e isso
resolve o dedo — mas `touch-action` só governa gesto de toque. No computador,
rolar o trackpad sobre o pano de fundo com uma folha aberta continuava levando a
página de trás junto: 1.112 px medidos, e ao fechar a folha a pessoa estava em
outro lugar da tela.

O cancelamento agora mora em `ativarDialogo()`, por onde toda folha e todo modal
passam: enquanto o diálogo está no topo da pilha, um `wheel` cujo alvo está fora
dele é cancelado. Dentro, nada muda — `overscroll-behavior:contain` já segura o
encadeamento ao chegar no fim. Conferido nos três lugares roláveis (folha de
gasto, Configurações e painel da IA): todos rolam por dentro, nenhum arrasta a
página.

Mesma lição de sempre, de outro ângulo: quando o conserto é medido num caminho
só, o sintoma sobrevive no outro. `touch-action` foi medido com toque; a roda,
não.

### 12/09 — o app rebaixava 1,2 MB por abertura, e o cache guardava a fita

O service worker era rede-primeiro para a página. Toda abertura esperava o
download inteiro antes de desenhar qualquer coisa, e baixava **1,2 MB de novo
mesmo com a cópia salva, mesmo sem nada ter mudado** — cerca de 11 MB por mês de
dados móveis para quem abre o app uma vez por dia.

Agora o cache responde na hora e a rede corre atrás.

| segunda abertura | antes | depois |
|---|---|---|
| baixado | 1.252 KB | **3 KB** |
| primeira pintura (4G) | 424 ms | **124 ms** |
| offline | 324 ms | **140 ms** |

A primeira visita não muda — é outro trabalho.

**Três armadilhas no caminho, e a terceira já estava lá.**

*Recarregar sem laço.* `setupAutoUpdate()` sondava a publicação por `HEAD` e
recarregava. Com o cache respondendo, ele veria a versão nova antes de o cache
trocar, recarregaria, o cache velho responderia outra vez, e o laço não
terminaria. Quem sabe que a troca aconteceu é o worker: ele avisa por
`postMessage` depois de gravar, e a página recarrega então — se puder. Sem
service worker, a sondagem por `HEAD` continua como estava.

*Comparar sem clonar.* `clone()` divide um stream em dois ramos. A página lia
um; a comparação leria o outro segundos depois, e com 1,2 MB o buffer entre
eles enche e **a leitura da página trava** — o app abria em branco. A
comparação passou a reler o cache com `match()`, que devolve uma resposta
independente. (O servidor deste projeto não manda `ETag`, `Last-Modified` nem
`Content-Length`; sem comparar o conteúdo, o aviso nunca sairia e a pessoa
ficaria presa numa versão antiga para sempre.)

*Navegação não quer dizer "a página".* A fita de cotações roda num iframe, e um
iframe navega. O worker respondia a ela com o index inteiro e, pior, **gravava a
fita sob a chave `/`**: o cache da página passava a conter 3 KB de ticker, e era
isso que aparecia offline. Esse defeito **já existia** — com rede-primeiro ficava
escondido, porque a página certa sempre vinha da rede. Só apareceu quando o
cache virou a fonte.

Lição: trocar a ordem entre cache e rede não é ajuste de desempenho. É mudar
quem responde — e revela todo cache que estava errado sem ninguém perceber.

### 12/09 — 172 KB de fonte na frente da primeira pintura

As nove fontes moravam em base64 dentro de `styles/fonts.css`. O `<style>` vive
dentro do HTML, e o navegador não pinta nada antes de o HTML chegar inteiro —
então cada uma delas estava na frente da primeira imagem da tela, para todo
mundo. O `font-display: swap` que já estava lá não tinha o que trocar: a fonte
só existia depois de tudo já ter chegado.

Medido antes: **526 KB precisavam chegar antes da primeira pintura**, de 1.252 KB
no total. 172 KB eram fonte.

Agora elas são arquivos em `public/assets/fonts/`. O texto aparece na hora com a
fonte do sistema e troca quando a de verdade chega.

| primeira visita | antes | depois |
|---|---|---|
| HTML | 1.282 KB | **1.107 KB** |
| primeira pintura, 3G ruim | 9.484 ms | **5.872 ms** |
| primeira pintura, 4G | 1.160 ms | **824 ms** |

Um ganho que não estava no plano: o navegador só baixa a fonte que a tela usa.
São **5 das 9** na abertura (72 KB) em vez das nove sempre. As quatro do IBM Plex
Mono chegam quando alguma tela as pede.

O service worker guarda `/assets/` com cache-primeiro, então a partir da segunda
visita nenhuma volta à rede — conferido.

`npm run audit` passou a reprovar fonte embutida no HTML. Reembutir uma é fácil
de fazer sem perceber: o arquivo continua parecendo certo, e o custo aparece
longe dali, na primeira visita de outra pessoa.

**E 125 KB de máscara na primeira linha do primeiro CSS.** O padrão de ondas do
fundo era um SVG em base64 dentro de `tokens.css` — decoração pura, num
`.bg-pattern` com `z-index:-2`, atrás do app inteiro. Ninguém deve esperar por
ele para ver o saldo, e no entanto ele vinha antes de tudo.

Somando as duas extrações:

| primeira visita | antes | depois |
|---|---|---|
| a esperar antes da 1ª pintura | 526 KB | **230 KB** |
| HTML | 1.252 KB | **957 KB** |
| primeira pintura, 3G ruim | 9.484 ms | **3.324 ms** |
| primeira pintura, 4G | 1.160 ms | **588 ms** |
| primeira pintura, wi-fi | 1.616 ms | **408 ms** |

**O que continua ruim, e por quê.** Em 3G a tela aparece em 3,3 s, mas o app só
fica *utilizável* aos 24 s: faltam os 533 KB de JavaScript, que ainda são um
`<script>` único. Dividi-lo significa quebrar o IIFE de escopo compartilhado
que sustenta todo o resto — outra ordem de mudança, e não cabia aqui.

### 12/09 — a chave da IA morava no disco sem ninguém ter pedido

Era a última pendência aberta do [SECURITY.md](SECURITY.md), das onze.

A chave do Gemini ficava em `localStorage`, **sempre**, sem escolha, num campo
`type="text"` que a mostrava por inteiro na tela — e continuava lá anos depois
de a pessoa ter parado de usar a IA. Guardada assim, é legível para qualquer
extensão do navegador e para quem pegar o aparelho destrancado.

O padrão passou a ser a sessão: a chave vale enquanto a aba estiver aberta e
some ao fechar. Quem não quer colar de novo marca "lembrar", e aí ela desce para
o disco — com o que isso custa dito ao lado do interruptor, e **só depois** da
escolha, porque antes seria um aviso sobre algo que não está acontecendo.
Desligar a IA apaga a chave dos dois lugares.

Ligar e desligar "lembrar" nunca obriga a colar de novo: ligar desce para o
disco o que já está na sessão, desligar sobe o caminho contrário.

**A parte que mais importava é a de quem já usava.** A chave dessas pessoas
estava no `localStorage` porque era o único jeito que existia. Uma atualização
que a apagasse quebraria o recurso sem aviso, na cara de quem não fez nada
errado. Então a presença antiga vale como escolha: "lembrar" aparece já ligado,
e nada se move.

Também corrigido um texto que a mudança tornou falso: a ajuda dizia "sua chave
fica salva só neste aparelho", o que deixou de ser verdade quando ela não é
salva em lugar nenhum. Passou a falar só do que continua certo — que ela não
sai daqui, exceto para falar com o Google.

### 12/09 — o arreio de navegador entra no projeto

Os testes que acharam os defeitos mais caros desta semana viviam numa pasta
temporária, fora do git. Todos os que estão na lista abaixo passaram por
`npm test` sem despertar nada:

| o que quebrou | o que a suíte do motor via |
|---|---|
| a etiqueta do cartão cobria o campo de valor da fatura e recebia o clique | nada: os valores estavam certos |
| o app rebaixava 1,2 MB a cada abertura, sem nada ter mudado | nada: não é conta |
| o cache guardava a fita de cotações sob a chave da página | nada: só aparecia offline |
| onze meses davam 12.992 px de altura no telefone | nada: os totais batiam |
| quatro contas fixas exibindo "R$ 0,00" no mês corrente | nada: zero era o valor certo do campo errado |
| rolar sobre o pano de fundo levava a página 1.112 px | nada |

Agora é `npm run ui`, com 20 arquivos em `testes/interface/`. Sobe o servidor e
o Chrome sozinho e derruba os dois no fim; precisa do Chrome instalado e de mais
nada — o driver do CDP são 90 linhas em cima do `WebSocket` que o Node já traz.

**Fica fora do `npm run check`** de propósito. O `check` precisa rodar em
qualquer lugar, e esta suíte depende de um navegador.

Dos 35 arquivos do rascunho, entraram 20. Ficaram de fora os que não tinham
asserção nenhuma — eram sondas de investigação, não testes — e dois que falam
com o Supabase de verdade: uma suíte que qualquer um roda não pode depender de
credencial nem de rede.

**Três defeitos dos próprios testes, corrigidos na mudança.** Um lia o cenário
de dentro do código-fonte de outro com uma expressão regular. Outro afirmava que
`navigator.onLine` vira `false` sob emulação de rede, o que não acontece — ele
reprovava um app que estava certo. E um terceiro usava `elementFromPoint` sem
garantir que o elemento estava na tela, então passava ou falhava conforme a
rolagem que sobrasse do passo anterior.

O `LEIA-ME.md` da pasta guarda essas armadilhas. Metade delas é a mesma coisa: o
teste medindo o que o navegador não pintou.

### 12/09 — a cobertura que eu media errado

Eu tinha dito que 62 funções do motor estavam sem teste, e que a mais grave era
`moverSaldoParaMeta()` — a que tira dinheiro da conta e põe numa meta.

**Estava errado.** Eu procurava o nome de cada função nos arquivos de teste, e
essa nunca aparece em nenhum: ela é chamada por dentro de `atualizarMeta()`,
`removerMeta()` e `restaurarMeta()`, e os três têm testes que conferem o saldo e
a conservação do patrimônio. A conta por texto erra nos dois sentidos — dá por
descoberto o que só é chamado de dentro de outra função, e dá por coberto o que
aparece só num comentário.

Medindo de verdade — instrumentando o ambiente de teste e contando chamadas —
eram **189 de 218**. Isso virou `npm run cobertura`, para ninguém repetir a
medição ruim; ele separa o que é `core/`, onde moram as contas, do resto.

Com a medida certa apareceram lacunas reais, todas fechadas:

| o que ninguém executava | por que importa |
|---|---|
| `computeCartao()` | é o número que diz se cabe mais uma compra, e aparece em três telas |
| `computeCategoryPrevMonth()` | alimenta a comparação com o mês passado no documento do contador |
| `invalidarTimeline()` | invariante do guia: sem invalidar, a tela mostra número velho |
| `defaultData()` | o estado que toda pessoa nova recebe |
| `remainingWorkDaysUntil()` | decide quanto quem tem renda diária ainda vai receber |
| `remainingInternetCountUntil()`, `metaDaysRemaining()`, `metaMonthsRemaining()` | contagens de prazo que a tela mostra |

**93%**, e nada de `core/` fora. O que sobra é encanamento de sincronização que
depende de navegador.

Três asserções minhas estavam erradas e o código, certo: `defaultData()` não
cria `categorias` (quem entrega as padrão é `CATS()`) nem `iaAtiva` — a IA nasce
desligada por ausência, e quem lê exige `=== true`. E de 12 a 22 de setembro são
onze dias, não dez: a contagem inclui as duas pontas.

### 12/09 — o texto que fica direto sobre o fundo

Relato: as legendas soltas sobre o fundo são difíceis de ler, "ainda mais quando
a arte de fundo está ativada".

`npm run audit` já confere contraste e dava tudo verde. Ele compara a cor do
texto com a cor de fundo **declarada no tema** — e o fundo de verdade não é uma
cor. É a textura das ondas, que escurece até `#D8D0BE`, e com a arte ilustrada
é uma imagem inteira.

Medindo o que está na tela — fotografando o fundo com o texto escondido e lendo
os pixels — apareceu isto:

| | antes | mínimo |
|---|---|---|
| onda, matcha (sem arte) | 4.30 | 4.5 |
| sakura (sem arte) | 4.45 | 4.5 |
| **poupa + arte, legenda** | **1.74** | 4.5 |
| **poupa + arte, título da seção** | **1.30** | 4.5 |

O caso do poupa não é "texto difícil": o tema é **escuro** e a arte dele é um
nascer do sol **bege claro**. Fora dos cards, isso é texto claro sobre fundo
claro — o título da seção desaparecia junto com as legendas. Havia até um
remendo anterior para isso, um contorno no título, aplicado a onda, sakura e
matcha; o poupa, o pior caso, tinha ficado de fora.

Agora são dois tokens, `--sobre-fundo` e `--sobre-fundo-forte`, que cada tema
declara, e que o poupa ilustrado redefine para as cores de um tema claro. Todas
as 42 medidas passam, a pior em 4.95.

**Uma armadilha na medição, que chegou a produzir um número errado.** A primeira
versão separava letra de papel por brilho dentro de uma foto só. Isso funciona
enquanto o texto é mais escuro que o fundo; nos temas escuros é o contrário, e a
conta se inverte sem avisar — o `noite` aparecia reprovado em 2.01 quando está em
5.45. Fotografar o fundo com o texto escondido resolve, e é o que
`testes/interface/t_contraste.js` faz.

Esse teste falha com as três linhas certas quando a correção do poupa é
removida — foi conferido, porque um teste que nunca falhou não prova nada.

**Três instabilidades da própria suíte, que só apareceram com ela cheia.** O
teste de primeiro uso esperava `1500ms` pelo assistente; isso passa na máquina
descansada e falha quando o teste é o décimo oitavo da fila. Agora espera pela
coisa, não pelo relógio. O de cache afirmava que a segunda abertura é mais
rápida que a primeira — 848 ms contra 781 ms não quer dizer nada, e a asserção
virou um limite absoluto. E `limparAparelho()` limpava de dentro da página, o
que depende de a página ter carregado a ponto de rodar o JS da limpeza; passou a
usar `Storage.clearDataForOrigin`, que apaga de fora.
