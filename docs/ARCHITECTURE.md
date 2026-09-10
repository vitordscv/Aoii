# Arquitetura

## O formato

O núcleo do Aoii é entregue em `dist/index.html`, com CSS e JavaScript
embutidos. Ícones, manifesto, service worker e artes ficam em `public/` e são
copiados para `dist/`; juntos, eles permitem instalar e abrir o app offline sem
um servidor de aplicação. O que mudou na extração foi de onde esse arquivo vem: antes ele *era*
a fonte; agora é gerado a partir de `src/`.

```
src/index.html          esqueleto com três marcadores
  <!--build:fonts-->      → src/styles/fonts.css
  <!--build:styles-->     → os outros 5 CSS, na ordem do manifesto
  <!--build:scripts-->    → os 78 módulos JS, na ordem do manifesto,
                            embrulhados num único (function(){ "use strict"; … })()
```

`scripts/build.js` faz a substituição e escreve `dist/`. `public/` é copiado
como está. Não há minificação nem transformação: o que se lê em `src/` é
exatamente o que roda.

### Por que concatenação e não módulos ES

Os módulos continuam compartilhando um escopo só. Isso não é elegante, mas é o
que permitiu partir 5.400 linhas em 63 arquivos sem tocar em nenhuma linha de
lógica — e provar isso: o `dist/` da extração era byte a byte igual ao arquivo
publicado antes dela.

Converter para `import`/`export` de verdade é passo de outra rodada, feito folha
por folha (`core/money.js` e `core/dates.js` primeiro, que não dependem de
ninguém). Enquanto isso, quem faz o papel do sistema de módulos é o
`scripts/lint.js`.

## Camadas

```
data ─→ i18n ─→ core ─→ storage ─→ integrations ─→ ui
```

Cada camada só pode usar as que vêm antes. `npm run lint` lê os nomes declarados
e usados em cada arquivo, monta o grafo e reprova quem aponta para cima.

| camada | o que é | pode usar |
|---|---|---|
| `data` | constantes, esquema e o objeto `data` | nada |
| `i18n` | dicionários e `L()` | `data` |
| `core` | regras e cálculos: defaults, migração, dinheiro, datas, projeção, cartão e métricas | `data`, `i18n` |
| `storage` | localStorage e sincronização | + `core` |
| `integrations` | Gemini, BrasilAPI | + `storage` |
| `ui` | desenho, eventos, DOM | tudo |

### Fronteiras sem exceções

A verificação de camadas está zerada: `scripts/lint-baseline.json` não contém
nenhuma dependência invertida. A criação dos dados iniciais e a migração de
versões antigas ficam em `core/defaults.js`, pois aplicam regras e normalizam o
estado usando os utilitários do núcleo.

## Fluxos

### Abrir o app

```
init()                          src/ui/boot.js
 ├─ store.get(STORAGE_KEY)      lê o localStorage
 ├─ migrateData(d)              normaliza e completa campos
 ├─ aplicarAportesAutomaticos() move dinheiro das metas se o mês virou
 ├─ sincronização (se houver código configurado)
 └─ render()
```

### Uma alteração financeira

```
evento na UI
 → altera `data`
 → persist()            invalida a timeline, grava, marca o status
 → render()             atualiza a aba visível e marca as demais como pendentes
```

`persist()` sem `render()` é o erro clássico: os dados mudam, a tela não. Foi
exatamente o que aconteceu com a data prevista das compras planejadas. Cada
chamada de `render()` redesenha a aba ativa e deixa as outras pendentes;
`showTab()` atualiza a aba pendente antes de exibi-la. Configurações são
preenchidas quando o painel abre.

### De onde vem cada número

```
data
 └─ buildTimeline()              memoizado; um ponto por mês
     ├─ mesMetrics/monthMetrics  renda, despesa e saldo de cada mês
     ├─ entradas extras          só o que falta receber, fora as "sem previsão"
     ├─ compras planejadas
     └─ aportes automáticos das metas
        ↓
   pontos[]  ──→ getTrajectoryPoints()  → gráfico da trajetória
             ──→ saldoPrevistoEm()      → número do hero
             ──→ computeTotals()        → chips
             ──→ renderMonths()         → cartões do mês
             ──→ suggestPurchaseTiming()→ "melhor momento pra comprar"
```

Um motor só. Qualquer tela que precise de saldo futuro lê daqui — é o que faz o
hero bater com o gráfico e com o cartão do mês.

`buildTimeline()` guarda o resultado em memória; `invalidarTimeline()` limpa.
`render()` e `persist()` já chamam.

### Persistência

```
persist() → invalidarTimeline()
          → store.set()   localStorage (com fallback silencioso)
          → status "salvo"
```

A sincronização é separada e opcional. Códigos novos têm 12 caracteres; o app
cifra o objeto com AES-GCM antes do envio e usa revisão otimista para detectar
conflitos. O fechamento do acesso REST direto à tabela ainda depende do rollout
coordenado descrito em [SECURITY.md](SECURITY.md).

## O que ainda não existe

Os lançamentos do Diário já passam por comandos em `core/transactions.js`.
Metas passam por `core/goals.js`; editar o valor guardado, remover e desfazer
movem o mesmo valor no saldo da conta e preservam o patrimônio. Rendas
recorrentes passam pelos comandos de `core/income.js`. Cartões e a migração das
suas referências passam por `core/cards.js`. Faturas e seus gastos passam por
`core/invoices.js`; gastos fixos passam por `core/fixed-expenses.js`. A interface
ainda altera diretamente as preferências gerais de configuração.

Expandir esse padrão domínio por domínio é a mudança estrutural seguinte — ver
[MIGRATION.md](MIGRATION.md).
