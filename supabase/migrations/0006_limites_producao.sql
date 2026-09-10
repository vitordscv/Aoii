-- ═══════════════════════════════════════════════════════════════════════════
-- 0006 — a metade de produção do 0004, que nunca foi aplicada.
--
-- Conferido em 10/09/2026, direto no banco:
--
--   aoii_put_homolog  consulta aoii_limites ......... SIM
--   aoii_put          consulta aoii_limites ......... NÃO
--   view aoii_crescimento .......................... não existe
--
-- A tabela aoii_limites EXISTE e tem os quatro valores configurados — mas quem
-- a criou foi o 0005, que é de homologação. Por isso o estado parece aplicado
-- quando se olha só a tabela: a função de produção nunca passou a consultá-la.
--
-- Efeito prático: produção segue sem teto de criação de linhas. Qualquer um com
-- a chave anon (que está no HTML publicado, e isso é normal) pode criar linhas
-- até estourar a cota do plano. Cifrar não protege contra isso — criptografia
-- protege o conteúdo, não o espaço.
--
-- O corpo de aoii_put em produção foi lido e é exatamente o do 0001, sem
-- nenhuma correção posterior: aplicar isto não sobrescreve trabalho de ninguém.
--
-- O teto vale só na CRIAÇÃO de linha. Atualizar linha existente não é limitado:
-- é o caminho normal, e já está protegido pelo token de escrita.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.aoii_limites (
  chave  text primary key,
  valor  bigint not null,
  nota   text
);

insert into public.aoii_limites (chave, valor, nota) values
  ('criacoes_por_hora', 30,      'linhas NOVAS por hora. Usuário real cria uma e depois só atualiza.'),
  ('linhas_no_total',   5000,    'freio de mão: acima disto, nenhuma linha nova.'),
  ('bytes_por_linha',   5242880, 'teto de tamanho do envelope, por linha.')
on conflict (chave) do nothing;

revoke all on public.aoii_limites from anon, authenticated;
alter table public.aoii_limites enable row level security;

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
  atual        public.financas%rowtype;
  hash         text;
  lim_bytes    bigint;
  lim_hora     bigint;
  lim_total    bigint;
  criadas_hora bigint;
  total_linhas bigint;
begin
  if p_id is null or length(p_id) < 8 or length(p_id) > 64 then
    return jsonb_build_object('erro', 'id');
  end if;
  if p_write_token is null or length(p_write_token) < 32 then
    return jsonb_build_object('erro', 'token');
  end if;

  select valor into lim_bytes from public.aoii_limites where chave = 'bytes_por_linha';
  if pg_column_size(p_data) > coalesce(lim_bytes, 5242880) then
    return jsonb_build_object('erro', 'tamanho');
  end if;

  hash := encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');

  select * into atual from public.financas where id = p_id for update;

  if not found then
    select valor into lim_hora  from public.aoii_limites where chave = 'criacoes_por_hora';
    select valor into lim_total from public.aoii_limites where chave = 'linhas_no_total';

    select count(*) into criadas_hora from public.financas
      where created_at > now() - interval '1 hour';
    if criadas_hora >= coalesce(lim_hora, 30) then
      return jsonb_build_object('erro', 'limite-criacao');
    end if;

    select count(*) into total_linhas from public.financas;
    if total_linhas >= coalesce(lim_total, 5000) then
      return jsonb_build_object('erro', 'limite-total');
    end if;

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

revoke all on function public.aoii_put(text, jsonb, integer, text) from public;
grant execute on function public.aoii_put(text, jsonb, integer, text) to anon, authenticated;

-- monitoramento de crescimento; não acessível pelo anon
create or replace view public.aoii_crescimento as
  select date_trunc('day', created_at)::date as dia,
         count(*)                            as linhas_criadas,
         pg_size_pretty(sum(pg_column_size(data))) as tamanho
  from public.financas
  group by 1
  order by 1 desc;

revoke all on public.aoii_crescimento from anon, authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Conferir depois de aplicar:
--
--   select proname,
--          position('limite-criacao' in prosrc) > 0 as tem_teto
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and proname = 'aoii_put';        -- deve dar true
--
--   select * from aoii_crescimento;                             -- deve listar
--
-- Reversão: recriar aoii_put com o corpo de 0001_sync_seguro.sql e
--   drop view if exists public.aoii_crescimento;
-- ═══════════════════════════════════════════════════════════════════════════
