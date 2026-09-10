# Retomada da sincronização — 08/09/2026

Base: `2e2383d`, branch `refactor/estrutura-seguranca`. Continuação da última
solicitação feita a Claude: salvar durante envio lento, fechar antes do debounce,
reabrir com pendência e revisar acessibilidade dos diálogos novos.

## Resultado

367 testes locais passaram (318 anteriores + 49 regressões). O roteiro real
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
| Backup antes de legado | A interface bloqueou a migração até a confirmação; cancelar restaura código e sessão em regressão automatizada |
| Migração do legado | Comparou local R$ 666,00 com nuvem R$ 4.346,99; após escolher nuvem, adotou saldo R$ 4.321,99 + R$ 25,00 e ficou em dia |
| Conteúdo após migração | Revisão 2, envelope `aoii: sync`; nome do cartão e saldo fictício não aparecem no JSON armazenado |
| Material da sessão | A senha não é propriedade do estado; fica somente `CryptoKey` não exportável + token em memória |
| Código sem Web Crypto | Falha com `cripto-indisponivel`; não usa `Math.random()` como fallback |

A verificação visual confirmou que a identidade do app e os diálogos se mantêm.
Não foi usado leitor de tela: foram verificados atributos, teclado e foco.

## Rede e limpeza

[Registro das chamadas](homologacao-2026-09-08-rede.json): 77 entradas. As únicas
funções chamadas foram `aoii_get_homolog` e `aoii_put_homolog`; os dois DELETEs
foram restritos aos IDs fictícios na tabela `financas_homolog`. As três respostas
503 foram provocadas pelo simulador de indisponibilidade. Nenhuma tentativa foi
bloqueada pela lista permitida; nenhuma chamada à tabela ou RPC de produção.

[Registro da migração completa](homologacao-2026-09-08-migracao-rede.json): 20
entradas, somente tabela descartável para semear/limpar e as RPCs de homologação.
Sem resposta HTTP de erro, chamada bloqueada ou acesso à produção. Os códigos
novo e legado foram relidos como ausentes depois da limpeza.

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
  perfis distintos. Chrome estava em uso e o controle recusou interferir; Edge
  não estava disponível. Esse ensaio adicional permanece pendente.
- Acessibilidade desta rodada cobre senha, conflito e confirmação compartilhada;
  não representa auditoria completa de todos os painéis e formulários.
- Nesta rodada original não houve push, deploy, política RLS ou migração SQL. Em
  09/09/2026, a branch validada foi integrada à `main` e a Vercel passou a servir
  o build compatível. A parte 2 continua pendente até os aparelhos ativos abrirem
  essa versão.

Próxima etapa: repetir o ensaio em dois navegadores/perfis quando houver uma
sessão livre e revisar compatibilidade com clientes antigos antes de propor
publicação ou alteração de acesso à tabela de produção.
