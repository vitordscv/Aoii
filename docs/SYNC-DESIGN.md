# Sincronização: desenho proposto

**Estado: proposta. Nada aqui foi aplicado no Supabase.**
O código de criptografia já existe e está testado (`src/storage/encryption.js`),
mas a sincronização continua gravando em texto puro até esta proposta ser
aprovada. Ver "Como sair daqui", no fim.

## O problema

Hoje, `src/storage/sync.js`:

- manda o objeto financeiro inteiro, **sem criptografia**, para a tabela
  `financas` do Supabase;
- usa um código de 8 caracteres como **id da linha e única credencial** — quem
  souber o código lê e **escreve**;
- gera esse código com `Math.random()`;
- grava com `Prefer: resolution=merge-duplicates`, ou seja, **última gravação
  vence**: dois aparelhos editando no mesmo dia perdem trabalho em silêncio;
- guarda snapshots mensais na mesma tabela, também em texto puro.

A URL e a chave `anon` estarem no código publicado é normal e esperado — não é
o problema. O problema é o que a chave `anon` permite fazer.

## O desenho

### Três segredos, com papéis diferentes

| | o que é | quem sabe | vai pro servidor? |
|---|---|---|---|
| **código** | localizador da linha, 12 caracteres | quem o usuário contar | sim, é o `id` |
| **senha** | escolhida pelo usuário | só o usuário | **nunca** |
| **token de escrita** | derivado da senha | só quem tem a senha | só o *hash* dele |

O código deixa de ser credencial e passa a ser endereço. A senha vira a chave.
O token de escrita é o que impede alguém que descobriu o código de sobrescrever
os dados — e ele é derivado da senha, então nenhum aparelho precisa guardá-lo
nem transportá-lo separadamente.

```
chave de leitura  = PBKDF2(senha, salt, 310000, SHA-256)     → AES-GCM 256
token de escrita  = PBKDF2(senha, salt || "escrita", 310000) → enviado no put
o servidor guarda   sha256(token)                            → só compara
```

O salt fica na linha, em claro. Isso é normal: salt não é segredo, existe pra
impedir tabela pré-computada.

### O envelope

Cabe no campo `data` (`jsonb`) que já existe — a criptografia sozinha **não
exige mudança de esquema**. As colunas novas são para o controle de conflito.

```json
{
  "aoii": "sync",
  "format_version": 1,
  "revision": 12,
  "device_id": "id-aparelho-a",
  "updated_at": "2026-09-06T12:00:00.000Z",
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 310000, "salt": "base64" },
  "cipher": { "name": "AES-GCM", "iv": "base64", "ciphertext": "base64" }
}
```

`format_version`, `revision` e `device_id` ficam em claro porque o servidor
compara revisão — e entram como **dados autenticados** (AAD) do AES-GCM. Dá pra
ler; não dá pra falsificar: trocar qualquer um deles faz a decifragem falhar.
Isso está coberto por teste.

Nunca vão para o servidor: senha, chave derivada, token em claro, nome de
pessoa, valor, categoria, resumo financeiro em texto, nem dado de recuperação
que permita decifrar.

### Acesso: função, não tabela

RLS não sabe dizer "só se você filtrar por id" — com `SELECT USING (true)`,
qualquer um baixa a tabela inteira. Por isso o acesso passa a ser por duas
funções `SECURITY DEFINER`, e a tabela deixa de ser acessível ao papel `anon`:

- `aoii_get(p_id)` → devolve **uma** linha, ou nada. Não devolve o hash do
  token. Sem o id, não há o que listar.
- `aoii_put(p_id, p_data, p_expected_revision, p_write_token)` → grava só se o
  token confere **e** a revisão é a esperada. Senão devolve conflito.

SQL proposto: [`supabase/migrations/0001_sync_seguro.sql`](../supabase/migrations/0001_sync_seguro.sql).

### Conflito entre aparelhos

Some o "última gravação vence":

1. o aparelho carrega e guarda a `revision` que veio;
2. ao gravar, manda essa revisão como `p_expected_revision`;
3. o servidor grava e incrementa **só se** a revisão ainda for aquela;
4. se mudou, devolve `{"conflito": true, "revision": N}` e **não grava**;
5. o app mostra a tela de conflito, sem escolher sozinho.

A tela de conflito oferece: ver os dados deste aparelho, ver os da nuvem, ficar
com este aparelho, usar a versão da nuvem, exportar os dois backups. Não há
merge automático de valores financeiros — juntar dois saldos sem regra é pior do
que perguntar.

O status na tela passa a distinguir: salvando localmente · salvo neste aparelho ·
sincronizando · sincronizado · sem conexão · falha de sincronização · conflito.

E some o `catch(e){}` vazio da sincronização: hoje um erro de rede é engolido
sem nenhum sinal.

## Recuperação

**Não existe recuperar a senha.** O servidor nunca teve a chave; se a senha se
perder, a cópia na nuvem vira ruído. Os dados do aparelho continuam intactos —
a nuvem é espelho, não original.

Por isso, antes de ativar a criptografia o app vai:

1. exigir um backup local (o botão de exportar JSON que já existe);
2. explicar em uma frase que senha perdida = cópia da nuvem perdida;
3. só então pedir a senha.

Opcional e explícito: "lembrar a chave neste aparelho". Guarda a chave derivada
(não a senha) no `localStorage` deste aparelho, com o aviso de que quem abrir o
aparelho desbloqueado tem acesso. Desligado por padrão.

## Migração

Feita uma vez, por aparelho, e sem apagar nada antes de confirmar que o novo
formato foi lido de volta:

1. detectar linha no formato antigo (sem `"aoii":"sync"`);
2. pedir a senha (com o backup local já feito);
3. cifrar localmente e **decifrar de volta na hora**, conferindo que bate;
4. gravar o envelope com `revision = 1`;
5. **reler do servidor e decifrar** — só se isso funcionar a migração é dada
   como concluída;
6. qualquer falha em 3–5: nada muda, a linha antiga fica como está.

Os snapshots mensais antigos, em texto puro, ficam onde estão até o usuário
mandar apagar — apagar sem pedir seria destruir backup. A tela de sincronização
ganha um "apagar cópias antigas em texto puro", com a contagem do que será
apagado.

**Aparelho ainda na versão antiga:** ao ler um envelope cifrado, ele veria um
objeto sem nenhum campo conhecido. Isso já está resolvido: a validação recusa
tanto envelope cifrado quanto objeto sem nenhum campo do Aoii, em vez de virar
um `data` vazio que seria salvo por cima. Essa proteção **já está no ar** neste
branch, antes de qualquer criptografia — é o que torna a migração segura.

## Rollback

- **Do app:** a versão anterior não escreve por cima de um envelope (ver acima),
  então voltar o código não corrompe a nuvem. O aparelho continua com os dados
  locais.
- **Do banco:** as funções são aditivas. Reverter é `drop function` e devolver
  as permissões antigas na tabela; `revision`, `device_id` e `write_token_hash`
  podem ficar sem uso, ou sair com `drop column`. O SQL de reversão está no fim
  do arquivo de migração.
- **Os dados:** enquanto a migração de um código não for concluída, a linha
  antiga em texto puro continua intacta.

## O que isto não resolve

- **Força bruta no código.** 12 caracteres num alfabeto de 31 dão ~7,9 × 10¹⁷
  combinações; sem limite de taxa, ainda assim vale pôr um. O Supabase oferece
  isso na borda, e a função pode recusar acima de N chamadas por minuto por id.
  Fica anotado, não implementado.
- **Aparelho desbloqueado.** Os dados locais continuam em texto puro no
  `localStorage`. Cifrar o armazenamento local exigiria pedir a senha a cada
  abertura, o que muda o app de lugar. Não é para agora.
- **Autenticação de verdade.** O token de escrita resolve o caso prático
  (quem descobriu o código não escreve), mas não substitui contas com
  `auth.uid()` e RLS por usuário. Se um dia o app tiver contas, as funções
  saem e viram políticas.

## Como sair daqui

Nesta ordem, e a etapa 1 depende de você:

1. **Você revisa e aprova** este documento e o SQL. Nada é aplicado antes disso.
2. Aplicar o SQL num projeto de teste do Supabase e conferir: listar a tabela
   com a chave `anon` falha; `aoii_get` com id certo funciona; `aoii_put` com
   token errado falha; com revisão velha devolve conflito.
3. Implementar no app: código de 12 caracteres com `crypto.getRandomValues`,
   tela de senha, migração, tela de conflito, estados de status.
4. Testes de dois aparelhos na mesma revisão, conflito sem sobrescrita, falha de
   rede, modo offline, retomada, snapshot cifrado.
5. Só então aplicar no projeto de produção.
