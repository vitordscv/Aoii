# Revisão de design — 30/10/2026

Revisão realizada em uma cópia isolada do projeto, com cenários fictícios. Não foi usada a sessão pessoal do usuário nem foram alterados seus registros financeiros.

## Cobertura

| Área | O que foi conferido |
| --- | --- |
| Resumo | Topbar, saldo e data-alvo, cartões, indicadores e alinhamento em quatro larguras |
| Entradas | Rendas recorrentes, entradas extras, dívidas e compras planejadas |
| Fixos | Contas, evolução, trajetória e linha do tempo |
| Diário | Histórico, filtros, lançamento e edição por formulário |
| Economias | Patrimônio, metas, investimentos e proventos |
| Configurações | As oito seções, navegação e fechamento |
| Ferramentas | Calculadora, conversor, chat e campos com teclado |
| Datas | Todos os oito pontos de criação de campos de data, incluindo linhas recriadas dinamicamente |

Larguras: 320, 390, 768 e 1440 px. Conferidos cenários com dados e telas vazias. O calendário também foi exercitado com altura reduzida para 500 px, cancelamento, confirmação, restauração do foco e modais sobrepostos.

## Problemas corrigidos

1. **Calendário de faltas permanente e grande:** substituído pelo botão “Marcar faltas ou recesso”. O calendário abre em um painel com título explícito. A lista salva fica recolhida com a quantidade visível.
2. **Calendários diferentes no restante do app:** seleção compartilhada para saldo, entradas, compras, metas, dívidas, gastos e proventos. O campo mostra a data por extenso abreviada; selecionar um dia não fecha o painel. Há confirmação, cancelamento, escolha de mês/ano, Hoje e remoção da data quando permitida.
3. **Perda do contexto ao fechar um calendário sobre outro formulário:** o painel usa a pilha de diálogos do app. Escape fecha apenas o calendário e devolve o foco ao acionador.
4. **Topbar com metade da largura no tablet:** largura explícita compatível com o conteúdo e alvos de 44 px nos atalhos.
5. **Configurações com oito abas para arrastar no celular:** seletor com seção atual visível. Tablet e computador mantêm as abas.
6. **Entradas com duas caixas sobrepostas:** removida a superfície externa redundante, recuperando largura para os formulários. Ações de editar/remover receberam mais espaço.
7. **Ações pequenas em listas:** ampliados alvos de remoção e campos de descrição nas áreas afetadas.
8. **Descrições desalinhadas no celular:** títulos e explicações das seções passam a ler da esquerda para a direita, sem descrições alinhadas ao canto oposto.
9. **Cotações dominando Investimentos:** bloco recolhido, disponível sob demanda.
10. **Instrução confusa para restaurar backup:** texto aponta para o botão de carregar JSON, nos cinco idiomas.
11. **Resumo alto e texto secundário apagado:** ajustes de espaçamento no celular e uso da cor de texto do hero nos rótulos.
12. **Atualização automática durante a seleção de uma data:** o seletor aberto passa a bloquear a recarga automática, como os outros formulários.

## Validação

- `npm run check`: lint, build, 1.402 testes do motor, traduções e auditoria estrutural.
- `t_checkup_design`: telas, subtelas, configurações, ferramentas, cenários vazios e ausência de erros JavaScript; 100 verificações.
- `t_datas_unificadas`: campos estáticos e dinâmicos, data ISO sem deslocamento, cancelar, foco, Escape e viewport reduzida; 26 verificações.
- `t_calendario_faltas`: períodos, sobreposição, virada de ano, dias separados, persistência e dimensões responsivas.
- Regressões de celular, configurações, chat, contraste e teclado. O contraste foi medido nos sete temas, com e sem arte de fundo.

## Melhorias que ainda podem agregar valor

- **Listas extensas:** oferecer busca e ordenação também nas entradas/dívidas, se o volume real justificar. O Diário já tem busca.
- **Descrições longas:** uma visão de detalhes ao tocar no nome daria mais conforto do que editar diretamente um campo de uma linha.
- **Personalização de densidade:** uma opção compacta para computador pode reduzir a rolagem em contas com muitos registros, mantendo os alvos maiores no celular.

Essas sugestões não foram apresentadas como defeitos corrigidos nem adicionadas automaticamente ao modelo financeiro.

## Limites da revisão

A emulação de celular no Chrome não substitui um teste físico no Safari do iPhone, especialmente para teclado e seletores do sistema. Não foram exercitadas importações bancárias reais, autenticação do usuário, recuperação de senha ou sincronização entre seus aparelhos. Esta revisão de interface não certifica a segurança inteira do sistema.
