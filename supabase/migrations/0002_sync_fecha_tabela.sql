-- ═══════════════════════════════════════════════════════════════════════════
-- Sincronização segura — PARTE 2: trancar a tabela
--
-- NÃO APLICAR AINDA.
--
-- Isto tira do papel `anon` o acesso direto à tabela. A partir daqui, só
-- aoii_get e aoii_put funcionam — e o app publicado precisa JÁ estar usando as
-- duas. Aplicar antes disso derruba a sincronização de todo aparelho que ainda
-- estiver na versão anterior: leitura, gravação e snapshot mensal param de
-- funcionar na hora.
--
-- Pré-requisitos, todos:
--   1. o app em produção chama aoii_get/aoii_put, não /rest/v1/financas;
--   2. esse app está publicado e você abriu em cada aparelho pelo menos uma vez;
--   3. a parte 1 foi aplicada e conferida.
--
-- Por que isto é necessário: RLS não sabe exigir "só se você filtrar por id".
-- Com `for select using (true)`, quem tem a chave anon — que está no HTML
-- publicado, e isso é normal — baixa a tabela inteira, de todo mundo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "leitura publica (temporario)"     on public.financas;
drop policy if exists "insercao publica (temporario)"    on public.financas;
drop policy if exists "atualizacao publica (temporario)" on public.financas;
drop policy if exists "acesso publico"                   on public.financas;

alter table public.financas enable row level security;

-- Sem política nenhuma + RLS ligada = ninguém acessa direto. As funções da
-- parte 1 rodam como dono (SECURITY DEFINER) e passam a ser a única porta.
--
-- Sem `force row level security`: `force` sujeitaria o próprio dono às
-- políticas, e as funções deixariam de funcionar junto com todo o resto.

revoke all on public.financas from anon, authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Conferir depois de aplicar, com a chave anon (não com a de serviço):
--
--   select * from financas;              -- deve FALHAR: permission denied
--   select aoii_get('CODIGO');           -- deve continuar funcionando
--   select aoii_put(...);                -- idem
--
-- ── reversão ───────────────────────────────────────────────────────────────
--   begin;
--   grant select, insert, update on public.financas to anon, authenticated;
--   create policy "leitura publica (temporario)" on public.financas
--     for select using (true);
--   create policy "insercao publica (temporario)" on public.financas
--     for insert with check (true);
--   create policy "atualizacao publica (temporario)" on public.financas
--     for update using (true) with check (true);
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
