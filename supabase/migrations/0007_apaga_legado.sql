-- ═══════════════════════════════════════════════════════════════════════════
-- 0007 — apaga as linhas que ficaram em texto puro. NÃO APLICAR AINDA.
--
-- SÓ DEPOIS de rodar scripts/exportar-legado.js e conferir os arquivos.
-- Isto apaga dados. Não há desfazer.
--
-- Por que precisa acontecer
-- ------------------------
-- A linha ativa (CXY3HQUM) está cifrada. Os snapshots mensais dela, não — e o
-- id de cada um sai do próprio código de sincronização:
--
--     CXY3HQUM                → cifrado
--     CXY3HQUM-snap-2026-9    → texto puro, id derivado do código
--
-- aoii_get aceita qualquer id e é acessível pela chave anon. Então quem
-- descobrir o código não lê a linha ativa, mas lê setembro inteiro no snapshot.
-- Enquanto isso existir, a criptografia da linha ativa protege menos do que
-- parece: o atacante que ela deveria deter tem outra porta, ao lado, aberta.
--
-- Estado conferido em 10/09/2026:
--     14 linhas, 1 cifrada, 13 em texto puro
--     3 snapshots do código ativo (2026-7, 2026-8, 2026-9)
--     9 códigos antigos, de julho e agosto, aparentemente abandonados
--     1 snapshot de um código antigo
--
-- Snapshots novos já nascem cifrados (ensureMonthlySnapshot), então isto é uma
-- faxina do passado, não um remendo permanente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Confira a lista ANTES de apagar. Se este select não devolver exatamente o
-- que você exportou, pare aqui.
--
--   select id, updated_at, pg_size_pretty(pg_column_size(data)::bigint)
--   from public.financas
--   where not (data ? 'aoii')
--   order by updated_at desc;

delete from public.financas
where not (data ? 'aoii');

-- deve sobrar só a linha ativa, cifrada
select count(*) as linhas, count(*) filter (where data ? 'aoii') as cifradas
from public.financas;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Alternativa mais conservadora, se quiser manter os códigos antigos e apagar
-- só os snapshots (que são o vazamento por id previsível):
--
--   delete from public.financas
--   where id like '%-snap-%' and not (data ? 'aoii');
-- ═══════════════════════════════════════════════════════════════════════════
