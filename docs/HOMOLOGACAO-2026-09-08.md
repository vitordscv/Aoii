# Retomada da sincronização — 08/09/2026

Base: `2e2383d`, branch `refactor/estrutura-seguranca`. Continuação da última
solicitação feita a Claude: salvar durante envio lento, fechar antes do debounce,
reabrir com pendência e revisar acessibilidade dos diálogos novos.

## Resultado

353 testes locais passaram (318 anteriores + 35 regressões). O roteiro real
`testes/ciclo-homologacao.js` passou nas 31 verificações, incluindo migração,
senha errada, token inválido, revisão concorrente, retomada, tamanho máximo e
teto de criação. A limpeza final verificou que nenhum ID dessa execução ficou.

Lint: 70 módulos, 17 violações históricas de camada, nenhuma nova; nenhum campo
fora do esquema ou interpolação de texto do usuário detectada sem escape.
Auditoria: traduções completas, 91 pares de contraste aprovados, classes e IDs
consistentes. O build continua determinístico.

## Interface exercitada

App construído de `src/`, servido por `testes/servidor-interface.js`. Duas
origens, `http://localhost:4173` e `http://localhost:4174`, no navegador integrado.
Cada origem tem seu próprio localStorage, ID de aparelho e sessão de senha.
Código fictício desta execução: `UIA926192451`; senha exclusivamente de ensaio.

| Cenário | Observação |
|---|---|
| Senha: foco inicial e nome | Campo Senha focado, título associado, `aria-modal=true` |
| Senha: Tab / Shift+Tab | Circulou entre o primeiro e o último controle |
| Senha: Escape | Fechou, removeu `inert` e devolveu foco a Usar este código |
| Senha curta | Mensagem visível e `aria-invalid=true` |
| Ativação / segundo aparelho | Criou cópia cifrada e abriu com a mesma senha |
| Envio lento | PUT com atraso de 5 segundos; edições 333 e 444 foram enviadas em duas rodadas; B recebeu 444 |
| Fechamento antes do debounce | Salvou 555, exibiu pendência e fechou antes do envio; reabriu com 555 e pendência |
| Retomada | Após a senha, enviou 555; B recebeu 555 |
| Falha de rede | B editou 777 com respostas 503 simuladas; a pendência permaneceu |
| Conflito | A gravou 666; ao retomar B mostrou local 777 e nuvem 666 sem escolha automática |
| Conflito: acessibilidade | `alertdialog`, título, `aria-modal`, fundo inerte, foco em Decidir depois e Tab circular |
| Adiar conflito | Escape manteve pendência; nova tentativa foi iniciada explicitamente nas Configurações |
| Escolher nuvem | B adotou 666, mostrou em dia, restaurou foco a Usar este código e liberou o fundo |
| Senha incorreta após recarga | Mostrou alerta e preservou saldo 666 no aparelho |

A verificação visual confirmou que a identidade do app e os diálogos se mantêm.
Não foi usado leitor de tela: foram verificados atributos, teclado e foco.

## Rede e limpeza

[Registro das chamadas](homologacao-2026-09-08-rede.json): 77 entradas. As únicas
funções chamadas foram `aoii_get_homolog` e `aoii_put_homolog`; os dois DELETEs
foram restritos aos IDs fictícios na tabela `financas_homolog`. As três respostas
503 foram provocadas pelo simulador de indisponibilidade. Nenhuma tentativa foi
bloqueada pela lista permitida; nenhuma chamada à tabela ou RPC de produção.

O servidor de ensaio usa CSP `connect-src 'self'`, bloqueia service workers e
encaminha somente as duas RPCs de homologação, limitadas ao código desta execução
e seus snapshots. Não registra senha, token ou conteúdo financeiro. As chamadas
de limpeza e as releituras finais retornaram ausência de ambos os registros.

O roteiro real anterior usava DELETE por prefixos amplos e considerava registros
de outros ensaios como sujeira. Foi corrigido para gerar IDs exclusivos e limpar
somente a lista da execução. Na repetição final, a limpeza foi confirmada sem
afetar os dois registros do ensaio de interface que ainda estavam em uso.

## Como repetir

1. `npm run check`.
2. `npm run homolog` para o roteiro de motor + banco real.
3. `node testes/servidor-interface.js`; abrir as duas URLs mostradas e usar o
   código fictício impresso no terminal nas Configurações do app.
4. No serviço local, `/controle?lento=1` atrasa PUT; `lento=0` normaliza.
   `/controle?offline=1` simula indisponibilidade; `offline=0` normaliza. O modo
   vale para a porta consultada. `/evidencias` lista as chamadas.
5. Fechar as páginas e enviar POST a `/limpar`. Conferir os próprios IDs por RPC
   antes de encerrar o processo. Nunca usar dados pessoais nessas origens.

## Limites e próximo passo

- Duas origens independentes não equivalem à cobertura de dois navegadores ou
  perfis distintos. Esse ensaio adicional permanece pendente.
- Migração de legado foi testada contra o banco e em testes de concorrência;
  a sequência completa de backup + migração pela interface ainda requer ensaio.
- A sessão conserva a senha em memória. Não há persistência dela, mas manter
  somente a chave derivada ainda é trabalho pendente do roteiro original.
- Acessibilidade desta rodada cobre senha, conflito e confirmação compartilhada;
  não representa auditoria completa de todos os painéis e formulários.
- Nenhum push, deploy, merge, política RLS ou migração SQL nesta rodada. A parte
  2 e o rollout continuam pendentes; o site público não recebeu estas correções.

Próxima etapa: fechar os ensaios de interface pendentes e revisar backup,
credenciais em memória e compatibilidade com clientes antigos antes de propor
publicação ou alteração de acesso à tabela de produção.
