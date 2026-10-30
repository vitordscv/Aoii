# Datas e planejamento — revisão de lógica

## Regras aplicadas

| Uso | Comportamento |
| --- | --- |
| Saldo estimado | Hoje em diante; anos anteriores não aparecem, meses e dias vencidos ficam indisponíveis |
| Compra planejada pendente | Hoje em diante, tanto para criar quanto para reagendar |
| Nova meta | Seletor começa em hoje e oferece prazos futuros |
| Entrada extra e dívida | Histórico permitido: um vencimento antigo pode representar atraso real |
| Gasto e provento | Histórico preservado para registrar ou corrigir movimentos realizados |
| Falta ou recesso | Continua permitindo passado e futuro |
| Compra concluída | Data anterior pode continuar como referência histórica |

Nenhum registro antigo é reescrito automaticamente. Ao abrir uma projeção ou compra pendente com data vencida, o calendário começa no mês atual e pede reagendamento. Cancelar mantém o valor original. A projeção vencida também recebe um aviso no Resumo.

O saldo estimado ganhou atalhos para fim do mês e fim do ano atuais. Essas escolhas só são gravadas depois de confirmar.

## Erros corrigidos além da seleção de datas

- O comando de alterar a data da projeção também recusa novas datas passadas.
- A criação e o reagendamento de compras pendentes recusam datas passadas; editar nome, nota ou valor de uma compra antiga preserva seu histórico.
- Marcar uma compra planejada no cartão como comprada usava a data prevista para lançar as parcelas. Agora usa a data da confirmação e o fechamento do cartão, com a mesma regra do Diário.
- A primeira parcela guarda a data real da confirmação. A previsão anterior continua no registro como referência.
- Repetir a confirmação não duplica parcelas nem troca a data já registrada.
- Desmarcar uma compra já parcelada podia somar novamente a compra pendente, além das parcelas. Essa reabertura simples fica bloqueada, com explicação na interface. Ajustes dos lançamentos continuam nas faturas.
- Uma edição não pode apagar a indicação de parcelas já lançadas nem mudar o cartão de origem dessa compra.

Essas regras são aplicadas a novas ações. Não há migração, reconstrução de faturas antigas ou alteração automática dos dados pessoais.

## Próximas melhorias úteis

1. **Confirmar a data real da compra:** hoje a caixinha de comprado assume o dia da confirmação. Um pequeno formulário permitiria informar uma compra feita antes, apresentando a fatura de destino antes de gravar.
2. **Central de pendências vencidas:** reunir compras, entradas e dívidas atrasadas, com ações de reagendar, registrar recebimento ou pagamento, conforme o tipo.
3. **Desfazer guiado de compras parceladas:** mostrar as parcelas vinculadas e conferir se foram editadas ou pagas antes de desfazer. Exige vínculo explícito e validação; não deve procurar parcelas apenas pelo nome.

## Verificação

Testes do motor cobrem rejeição de novas datas passadas, preservação de registros antigos, recebíveis vencidos, fechamento e virada de ano, repetição da confirmação e proteção contra dupla contagem. A regressão de fuso horário continua verificando que datas históricas são válidas no calendário, enquanto a projeção exige data atual ou futura.

Os testes de interface conferem os limites por contexto, atalhos, cancelamento de uma data antiga, preservação do histórico e a explicação para compras já parceladas. Os cenários usam dados fictícios em perfil isolado. A revisão não executa operações no banco conectado do usuário.
