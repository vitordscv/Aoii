-- ═══════════════════════════════════════════════════════════════════════════
-- Sincronização segura — PROPOSTA. Não aplicada.
--
-- Ler docs/SYNC-DESIGN.md antes. Resumo do que muda:
--
--   1. a tabela `financas` deixa de ser acessível pelo papel `anon`;
--   2. o acesso passa por duas funções SECURITY DEFINER, porque RLS não sabe
--      exigir "só se você filtrar por id" — com SELECT USING (true), a chave
--      anon baixa a tabela inteira;
--   3. gravar exige um token derivado da senha do usuário (o servidor guarda
--      só o hash), então quem descobrir o código consegue ler o texto cifrado
--      mas não consegue escrever;
--   4. gravar exige a revisão esperada, então dois aparelhos não se
--      sobrescrevem em silêncio.
--
-- Aplicar primeiro num projeto de teste. O SQL de reversão está no fim.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. colunas novas ──────────────────────────────────────────────────────
-- `data` continua sendo o envelope inteiro (jsonb). O resto é controle.

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

-- ── 2. tranca a tabela ────────────────────────────────────────────────────
-- Sem política nenhuma + RLS ligada = ninguém acessa direto. As funções abaixo
-- rodam como dono (SECURITY DEFINER) e são a única porta.

alter table public.financas enable row level security;
alter table public.financas force row level security;

revoke all on public.financas from anon, authenticated;

-- ── 3. leitura ────────────────────────────────────────────────────────────
-- Uma linha, pelo id exato. Nunca devolve o hash do token.

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

-- ── 4. gravação ───────────────────────────────────────────────────────────
-- Regras, nesta ordem:
--   linha não existe            → cria, revision 1, guarda o hash do token
--   token não confere           → {"erro":"token"}                (não grava)
--   revisão diferente da atual  → {"conflito":true,"revision":N}  (não grava)
--   tudo certo                  → grava, revision + 1
--
-- O token chega em claro pela conexão TLS e é comparado por hash. Ele não sai
-- daqui: aoii_get não o devolve, e a tabela não é legível pelo anon.

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
  atual   public.financas%rowtype;
  novo_ok boolean;
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

  select * into atual from public.financas where id = p_id for update;

  if not found then
    insert into public.financas (id, data, revision, device_id, write_token_hash, updated_at)
    values (p_id, p_data, 1, p_data->>'device_id', encode(digest(p_write_token, 'sha256'), 'hex'), now());
    return jsonb_build_object('ok', true, 'revision', 1);
  end if;

  novo_ok := atual.write_token_hash is null   -- linha do formato antigo, ainda sem token
             or atual.write_token_hash = encode(digest(p_write_token, 'sha256'), 'hex');
  if not novo_ok then
    return jsonb_build_object('erro', 'token');
  end if;

  if coalesce(p_expected_revision, -1) <> atual.revision then
    return jsonb_build_object('conflito', true, 'revision', atual.revision);
  end if;

  update public.financas
     set data = p_data,
         revision = atual.revision + 1,
         device_id = p_data->>'device_id',
         write_token_hash = encode(digest(p_write_token, 'sha256'), 'hex'),
         updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'revision', atual.revision + 1);
end;
$$;

-- digest() vem do pgcrypto
create extension if not exists pgcrypto with schema extensions;

-- ── 5. permissões ─────────────────────────────────────────────────────────

revoke all on function public.aoii_get(text) from public;
revoke all on function public.aoii_put(text, jsonb, integer, text) from public;
grant execute on function public.aoii_get(text) to anon, authenticated;
grant execute on function public.aoii_put(text, jsonb, integer, text) to anon, authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Conferir depois de aplicar (com a chave anon, não a de serviço):
--
--   select * from financas;                    -- deve FALHAR (sem permissão)
--   select aoii_get('CODIGO-QUE-EXISTE');      -- deve devolver uma linha
--   select aoii_get('NAO-EXISTE');             -- deve devolver nulo
--   select aoii_put('CODIGO', '{}'::jsonb, 0, 'token-errado-com-32-caracteres!!');
--                                              -- deve devolver {"erro":"token"}
--   select aoii_put('CODIGO', '{}'::jsonb, 999, '<token certo>');
--                                              -- deve devolver {"conflito":true,...}
--
-- ── reversão ───────────────────────────────────────────────────────────────
--   begin;
--   drop function if exists public.aoii_put(text, jsonb, integer, text);
--   drop function if exists public.aoii_get(text);
--   alter table public.financas disable row level security;
--   grant all on public.financas to anon, authenticated;
--   -- as colunas podem ficar sem uso; para tirar de vez:
--   -- alter table public.financas
--   --   drop column if exists revision,
--   --   drop column if exists device_id,
--   --   drop column if exists write_token_hash,
--   --   drop column if exists created_at;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
