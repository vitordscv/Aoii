# Recuperação da sincronização

## O que o e-mail resolve

O Supabase Auth pode enviar um link ou código por e-mail para provar que a
mesma pessoa está entrando. Isso permite recuperar o acesso à conta e proteger
o uso do serviço contra terceiros.

Ele não pode revelar a senha atual da sincronização: ela nunca é enviada ao
servidor e é a única coisa que abre o conteúdo cifrado. Um fluxo que prometesse
isso seria falso ou exigiria guardar uma cópia legível dos dados no servidor.

## Modelo adotado

Cada sincronização nova deve criar, além da senha escolhida, uma **chave de
recuperação** aleatória. A pessoa a salva fora do Aoii (gerenciador de senhas,
arquivo guardado ou papel). O app a mostra uma única vez e oferece cópia.

A chave não é a senha. Ela cifra localmente um segredo de recuperação dentro do
envelope já cifrado; o Supabase guarda apenas esse bloco opaco. Com ela, a
pessoa pode criar uma senha nova para continuar sincronizando. Sem a senha e
sem a chave, os dados locais ainda podem ser exportados, mas a cópia remota não
pode ser aberta.

## Etapas de entrega

1. Concluído: cópias antigas pedem para **criar e confirmar** a primeira senha,
   com backup obrigatório antes da migração.
2. Próximo código: versão 2 do envelope, geração e apresentação única da chave
   de recuperação, preservando a leitura dos envelopes atuais de versão 1.
3. Depois: tela de “esqueci a senha”, que aceita a chave de recuperação e gira
   a senha de sincronização sem expor os dados.
4. Por fim: Supabase Auth por código de e-mail para vincular uma conta à chave
   de sincronização. A migração de banco deve validar a sessão antes de aceitar
   leitura e gravação, mantendo a chave de recuperação apenas no envelope
   cifrado.

## Regras de segurança

- Não guardar senha, chave de recuperação ou conteúdo financeiro em texto puro.
- Não enviar a senha para Auth, RPC, logs, analytics ou backups.
- Não tornar a recuperação por e-mail um atalho que decifre dados sem a chave
  de recuperação.
- Não bloquear aparelhos já atualizados: envelopes versão 1 continuam abrindo
  até que a pessoa crie a chave de recuperação.
