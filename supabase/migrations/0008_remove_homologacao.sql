-- ═══════════════════════════════════════════════════════════════════════════
-- Tira a homologação de dentro da produção.
--
-- PROPOSTA — NÃO APLICADA. Precisa de autorização.
--
-- Por que
-- -------
-- O 0003 criou `financas_homolog` como gêmea de `financas` para o ensaio, com
-- as políticas abertas de propósito: era um sandbox. O ensaio acabou. A gêmea
-- ficou.
--
-- Conferido no banco de produção em 10/09/2026:
--
--   tabela              RLS   políticas   grants pro anon
--   financas            on    0           nenhum                 ← fechada (0002)
--   financas_homolog    on    4           SELECT INSERT UPDATE
--                                         DELETE TRUNCATE        ← aberta
--
--   POLICY homolog leitura      SELECT using (true)
--   POLICY homolog insercao     INSERT with check (true)
--   POLICY homolog atualizacao  UPDATE using (true) with check (true)
--   POLICY homolog remocao      DELETE using (true)
--
-- Ou seja: o buraco que o 0002 fechou na `financas` continua escancarado numa
-- tabela ao lado, no mesmo projeto. Sem token, sem revisão, sem limite de
-- tamanho de linha (a gêmea não herdou o teto de 5 MB da parte 1) e sem teto
-- de criação. Qualquer um com a chave `anon` — que está no HTML publicado, e
-- isso é normal — insere linhas do tamanho que quiser, quantas quiser, até
-- estourar a cota do projeto. E pode apagar o que houver ali.
--
-- Hoje ela tem 0 linhas, então não há dado a perder. O que existe é a porta.
--
-- Isto é mais grave que a pendência 9 (aoii_put sem teto de criação): lá ainda
-- há a função no caminho e o teto de 5 MB por linha; aqui não há nada.
--
-- O que se perde
-- --------------
-- A capacidade de ensaiar contra produção pelo atalho do
-- localStorage['aoii-homolog']. É o certo: ensaio não se faz no projeto onde
-- moram os dados reais. Quando precisar de novo, o lugar é outro projeto
-- Supabase (ou um branch), não uma tabela vizinha.
--
-- O app não quebra: `sufixoDeHomologacao()` só devolve '_homolog' quando o
-- atalho está ligado, e ninguém liga por acidente.
--
-- Rollback
-- --------
-- Reaplicar 0003_homologacao.sql e 0005_homologacao_limites.sql, nessa ordem.
-- Os dois são idempotentes (create if not exists / create or replace).
--
-- Conferência depois de aplicar (esperado: zero linhas nas três)
-- --------------------------------------------------------------
--   select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
--    where n.nspname='public' and c.relname='financas_homolog';
--   select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname like 'aoii_%_homolog';
--   select 1 from pg_policies where tablename='financas_homolog';
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- as funções primeiro: elas dependem da tabela
drop function if exists public.aoii_put_homolog(text, jsonb, integer, text);
drop function if exists public.aoii_get_homolog(text);

-- a tabela leva junto as quatro políticas e os grants
drop table if exists public.financas_homolog;

commit;
