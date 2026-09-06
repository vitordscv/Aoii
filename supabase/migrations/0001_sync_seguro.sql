-- ═══════════════════════════════════════════════════════════════════════════
-- Sincronização segura — PARTE 1 (aditiva)
--
-- Ler docs/SYNC-DESIGN.md antes.
--
-- Esta parte NÃO tira permissão de ninguém: acrescenta colunas de controle,
-- cria as duas funções de acesso e tira só o DELETE do acesso público (o app
-- nunca apaga linha). O app que está no ar continua funcionando exatamente
-- como antes, falando com a tabela por REST.
--
-- Trancar a tabela é a PARTE 2 (0002_sync_fecha_tabela.sql), e só pode ser
-- aplicada DEPOIS que o app publicado passar a usar aoii_get/aoii_put. Aplicar
-- antes derruba a sincronização de quem estiver na versão anterior.
--
-- Estado de partida deste projeto, conferido em 06/09/2026:
--   create policy "acesso publico" on financas for all using (true) with check (true);
--   -- ou seja: quem tem a chave anon (publicada no HTML) lê, altera e apaga
--   -- qualquer linha da tabela.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. colunas de controle ────────────────────────────────────────────────
-- "data" continua sendo o envelope inteiro (jsonb). O resto é controle.

create table if not exists public.financas (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.financas
  add column if not exists revision          integer     not null default 0,
  add column if not exists device_id         text,
  add column if not exists write_token_hash  text,
  add column if not exists created_at        timestamptz not null default now();

-- ── 2. leitura ────────────────────────────────────────────────────────────
-- Uma linha, pelo id exato. Nunca devolve o hash do token.
--
-- Sem "force row level security" de propósito: SECURITY DEFINER roda como dono
-- da tabela, e "force" sujeitaria o próprio dono às políticas — como não há
-- política nenhuma depois da parte 2, as funções passariam a falhar.

create or replace function public.aoii_get(p_id text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
           'data',       f.data,
           'revision',   f.revision,
           'device_id',  f.device_id,
           'updated_at', f.updated_at
         )
  from public.financas f
  where f.id = p_id
  limit 1;
$$;

-- ── 3. gravação ───────────────────────────────────────────────────────────
-- Regras, nesta ordem:
--   linha não existe            → cria, revision 1, guarda o hash do token
--   token não confere           → {"erro":"token"}                (não grava)
--   revisão diferente da atual  → {"conflito":true,"revision":N}  (não grava)
--   tudo certo                  → grava, revision + 1
--
-- Linha do formato antigo ainda não tem token: a primeira gravação define o
-- dela. É o que permite a migração acontecer sem uma janela em que ninguém
-- consegue escrever.
--
-- Hash com sha256() nativo, não com digest() do pgcrypto: no Supabase o
-- pgcrypto vive no schema "extensions", que não está no search_path desta
-- função — digest() daria "function does not exist" na hora de gravar.

create or replace function public.aoii_put(
  p_id                text,
  p_data              jsonb,
  p_expected_revision integer,
  p_write_token       text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  atual public.financas%rowtype;
  hash  text;
begin
  if p_id is null or length(p_id) < 8 or length(p_id) > 64 then
    return jsonb_build_object('erro', 'id');
  end if;
  if p_write_token is null or length(p_write_token) < 32 then
    return jsonb_build_object('erro', 'token');
  end if;
  -- teto de tamanho no servidor também: o cliente já limita, mas o servidor
  -- não confia no cliente
  if pg_column_size(p_data) > 5 * 1024 * 1024 then
    return jsonb_build_object('erro', 'tamanho');
  end if;

  hash := encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');

  select * into atual from public.financas where id = p_id for update;

  if not found then
    insert into public.financas (id, data, revision, device_id, write_token_hash, updated_at)
    values (p_id, p_data, 1, p_data->>'device_id', hash, now());
    return jsonb_build_object('ok', true, 'revision', 1);
  end if;

  if atual.write_token_hash is not null and atual.write_token_hash <> hash then
    return jsonb_build_object('erro', 'token');
  end if;

  if coalesce(p_expected_revision, -1) <> atual.revision then
    return jsonb_build_object('conflito', true, 'revision', atual.revision);
  end if;

  update public.financas
     set data = p_data,
         revision = atual.revision + 1,
         device_id = p_data->>'device_id',
         write_token_hash = hash,
         updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'revision', atual.revision + 1);
end;
$$;

revoke all on function public.aoii_get(text) from public;
revoke all on function public.aoii_put(text, jsonb, integer, text) from public;
grant execute on function public.aoii_get(text) to anon, authenticated;
grant execute on function public.aoii_put(text, jsonb, integer, text) to anon, authenticated;

-- ── 4. tira o DELETE do acesso público ────────────────────────────────────
-- O app nunca apaga linha. Manter DELETE aberto só oferece a alguém com a
-- chave anon a chance de destruir o espelho de todo mundo. Ler e escrever
-- continuam abertos até a parte 2 — é o que mantém o app atual funcionando.

drop policy if exists "acesso publico" on public.financas;

create policy "leitura publica (temporario)" on public.financas
  for select using (true);
create policy "insercao publica (temporario)" on public.financas
  for insert with check (true);
create policy "atualizacao publica (temporario)" on public.financas
  for update using (true) with check (true);

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Conferir depois de aplicar:
--
--   select aoii_get('CODIGO-QUE-EXISTE');   -- devolve data/revision/updated_at
--   select aoii_get('NAO-EXISTE');          -- devolve nulo
--   select aoii_put('TESTE0001', '{"a":1}'::jsonb, 0, repeat('t',40));
--                                           -- {"ok":true,"revision":1}
--   select aoii_put('TESTE0001', '{"a":2}'::jsonb, 1, repeat('x',40));
--                                           -- {"erro":"token"}
--   select aoii_put('TESTE0001', '{"a":2}'::jsonb, 99, repeat('t',40));
--                                           -- {"conflito":true,"revision":1}
--   select aoii_put('TESTE0001', '{"a":2}'::jsonb, 1, repeat('t',40));
--                                           -- {"ok":true,"revision":2}
--   delete from financas where id='TESTE0001';   -- limpa o teste
--
-- ── reversão desta parte ───────────────────────────────────────────────────
--   begin;
--   drop function if exists public.aoii_put(text, jsonb, integer, text);
--   drop function if exists public.aoii_get(text);
--   drop policy if exists "leitura publica (temporario)" on public.financas;
--   drop policy if exists "insercao publica (temporario)" on public.financas;
--   drop policy if exists "atualizacao publica (temporario)" on public.financas;
--   create policy "acesso publico" on public.financas for all using (true) with check (true);
--   -- as colunas podem ficar sem uso; para tirar de vez:
--   -- alter table public.financas
--   --   drop column if exists revision,
--   --   drop column if exists device_id,
--   --   drop column if exists write_token_hash,
--   --   drop column if exists created_at;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
