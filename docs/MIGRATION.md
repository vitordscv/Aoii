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

## O que vem, em ordem

1. **Criptografia da sincronização.** `docs/SYNC-DESIGN.md` primeiro, com formato
   e migração, **antes** de qualquer alteração no Supabase.
2. **RLS e conflitos.** Políticas em `supabase/migrations/`; `revision`,
   `updated_at` e `device_id`; gravação condicionada à revisão e tela de conflito
   em vez de sobrescrita silenciosa.
3. **Acessibilidade.** `role="dialog"`, foco inicial, focus trap, Escape,
   `inert` no fundo, nome acessível em botão de emoji, `aria-live` no status de
   salvamento.
4. **Desempenho e PWA.** Ícones e manifesto para fora do HTML; precache do
   shell; fallback offline; redesenho por seção em vez da tela inteira.
5. **SEO e design.** Landing pública indexável, área do app fora do índice;
   hierarquia do Resumo; estados vazios com ação.

Uma camada de comandos de domínio (`addTransaction()`, `registerIncomePayment()`,
`updateGoal()`…) atravessa as etapas 1 e 2; agora que a validação existe, é o próximo passo
estrutural — ver o fim de [ARCHITECTURE.md](ARCHITECTURE.md).
