# Aoii — guia de trabalho

App de planejamento financeiro pessoal. HTML, CSS e JavaScript puros, sem
framework, sem dependências. Roda como PWA e guarda tudo no aparelho, com
sincronização opcional via Supabase.

## Comandos

```bash
npm run dev      # servidor local em :4173, remonta a cada recarga
npm run build    # src/ → dist/index.html
npm test         # build + suíte do motor financeiro
npm run audit    # build + auditoria estrutural (tradução, contraste, CSS, ids)
npm run lint     # fronteiras entre camadas + higiene dos arquivos
npm run check    # tudo acima, na ordem. Rode antes de concluir qualquer coisa.
```

## O que se edita e o que é gerado

| caminho | o que é |
|---|---|
| `src/` | **a fonte.** É aqui que se mexe. |
| `public/` | estático copiado como está (service worker, artes de fundo) |
| `dist/` | **gerado.** Fora do git. Nunca edite, nunca leia pra entender o app. |
| `scripts/` | build, lint, servidor de desenvolvimento, extração histórica |
| `testes/` | suíte do motor + auditoria estrutural |

`dist/index.html` tem 1 MB e é a concatenação de tudo. Ler esse arquivo pra
entender o projeto é desperdício: o mesmo conteúdo está em `src/`, dividido em
arquivos de 100 a 400 linhas com nome que diz o assunto. Use `src/`.

## Onde fica cada coisa

```
src/data/          constantes, estado (`data`), defaults e migração
src/i18n/          um arquivo por idioma + a montagem + L()
src/core/          cálculo puro: dinheiro, datas, projeção, cartão, métricas
src/storage/       localStorage e sincronização Supabase
src/integrations/  Gemini, BrasilAPI
src/ui/            tudo que desenha, escuta evento ou mexe no DOM
src/styles/        tokens, temas, base, componentes, melhorias
```

A ordem em `src/build.manifest.json` **é** a ordem de execução: os módulos são
concatenados dentro de um único IIFE e compartilham escopo. Mudar a ordem é
mudança de comportamento. Módulo novo entra no manifesto na posição certa.

`npm run lint` guarda a direção das dependências:

```
data → i18n → core → storage → integrations → ui
```

Cada camada só pode usar as anteriores. As 18 dependências que já apontavam
para cima quando as fronteiras foram criadas estão em
`scripts/lint-baseline.json`. Essa lista **só encolhe**: nunca acrescente uma
entrada à mão para fazer o lint passar.

## Invariantes financeiros

Estas regras já quebraram uma vez. Se um teste falhar em cima de uma delas, o
teste está certo.

- **Um motor só.** `buildTimeline()` é a fonte de todo número projetado. Hero,
  gráfico, cartões do mês e sugestão de compra leem dele. Não calcule saldo
  futuro em outro lugar.
- **Nada é contado por cartão.** Com dois cartões há duas faturas no mesmo mês;
  renda e gastos fixos entram uma vez por **mês**, nunca uma vez por fatura.
- **Receita não é gasto.** `transacoesGasto()` existe para isso. Somar
  `data.transacoes` direto conta entrada como saída.
- **Dia 29, 30 e 31 não vazam para o mês seguinte.** Use `dataNoMes()`.
- **Número digitado passa por `parseNum()`.** `parseFloat("1.234,56")` dá 1234.
- **O que entra na projeção é o que falta**, não o total: veja
  `restanteEntrada()`. Entrada em modo `semPrevisao` fica fora da projeção.
- **A projeção não chuta gasto futuro.** O histórico do Diário não vira média
  descontada dos meses seguintes — isso existiu e foi removido de propósito.
- **`invalidarTimeline()` antes de recalcular.** `render()` e `persist()` já
  fazem. Handler que altera `data` e não chama `render()` deixa a tela velha.

## Segurança

- Não renderize dado externo com `innerHTML`. Vindo de backup, Supabase, Gemini
  ou de campo digitado, use `textContent` / `createElement` / `dataset`.
- Não monte atributo HTML com concatenação de string.
- Não coloque o objeto financeiro em `console.log`.
- Não mande nome de pessoa, banco, cartão ou nota para a IA sem necessidade.
- Chave de API não entra em backup nem em sincronização.
- Id vindo de fora não é confiável: gere com `crypto.randomUUID()`.

Detalhes e o que ainda falta: [docs/SECURITY.md](docs/SECURITY.md).

## Como fazer as coisas

**Adicionar uma tradução.** A chave nasce em `src/i18n/pt.js` e tem que existir
nos cinco arquivos (`pt, en, es, fr, it`). Marcador `{mes}` no português tem que
aparecer em todas as línguas. `npm test` reprova se faltar; `npm run audit`
conta as chaves usadas contra as definidas.

**Adicionar um campo persistido.** Coloque o padrão em `defaultData()` e a
normalização em `migrateData()` (`src/data/defaults.js`) — `migrateData` roda em
todo dado que entra, inclusive importado, e precisa aceitar o formato antigo sem
quebrar. Documente o campo em [docs/DATA-MODEL.md](docs/DATA-MODEL.md). Hoje não
há número de versão de schema; criar um é a primeira tarefa da fase de validação
(ver [docs/MIGRATION.md](docs/MIGRATION.md)).

**Mexer em cálculo.** Leia primeiro `docs/DATA-MODEL.md` e o teste do assunto em
`testes/`. Cálculo sem teste que o cubra não deve ser alterado — escreva o teste
que descreve o comportamento atual, depois mude.

**Dividir um módulo grande.** Corte em ponto de fronteira de assunto, mantenha a
ordem original no manifesto, rode `npm run check`.

## Antes de concluir

1. `npm run check` passa (lint, build, testes, auditoria, dist em dia).
2. Cálculo alterado tem teste que falharia sem a mudança.
3. Chave de tradução nova existe nos cinco idiomas.
4. Nada de dado externo indo para `innerHTML`.
5. Decisão de arquitetura registrada em `docs/MIGRATION.md`.
6. Um commit por assunto — refatoração estrutural não anda junto com mudança de
   regra financeira.

## Mais

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — fluxos e limites entre módulos
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — o objeto `data`, campo a campo
- [docs/SECURITY.md](docs/SECURITY.md) — modelo de ameaça e pendências
- [docs/MIGRATION.md](docs/MIGRATION.md) — o que já mudou e o que vem
