# Aoii

Planejamento financeiro pessoal. Diz quanto você vai ter em cada mês daqui pra
frente — contando salário, contas fixas, faturas do cartão, o que ainda têm a
lhe pagar, o que você planeja comprar e o que separa para as metas — e a partir
disso responde a pergunta prática: *dá pra comprar isso, e quando?*

HTML, CSS e JavaScript puros. Sem framework, sem dependências. Instala como PWA,
funciona offline e guarda tudo no aparelho; sincronizar entre aparelhos é
opcional.

## Rodar

```bash
npm run dev      # http://localhost:4173
```

Edite `src/` e recarregue a página.

```bash
npm run build    # src/ → dist/index.html
npm run check    # lint + build + testes + auditoria
```

Não é preciso instalar nada: só Node 18 ou mais novo.

## Como o projeto é organizado

`src/` é a fonte; `dist/` é gerado pelo build e não fica no git.

```
src/data/          constantes, estado, defaults e migração
src/i18n/          um arquivo por idioma (pt, en, es, fr, it)
src/core/          cálculo puro: dinheiro, datas, projeção, cartão
src/storage/       localStorage e sincronização
src/integrations/  Gemini, BrasilAPI
src/ui/            desenho e eventos
src/styles/        tokens, temas, componentes
public/            service worker e artes de fundo
```

## Documentação

- [CLAUDE.md](CLAUDE.md) — guia de trabalho: comandos, invariantes, checklist
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — fluxos e limites entre módulos
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — o objeto `data`, campo a campo
- [docs/SECURITY.md](docs/SECURITY.md) — modelo de ameaça e pendências
- [docs/MIGRATION.md](docs/MIGRATION.md) — decisões tomadas e o que vem

## Aviso

A sincronização entre aparelhos ainda envia os dados **sem criptografia**, e o
código de 8 caracteres é a única credencial: quem souber o código lê e escreve.
Enquanto isso não mudar, trate a sincronização como opcional e ciente do risco —
os detalhes e o plano estão em [docs/SECURITY.md](docs/SECURITY.md).
