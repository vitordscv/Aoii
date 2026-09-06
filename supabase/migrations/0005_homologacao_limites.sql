-- ═══════════════════════════════════════════════════════════════════════════
-- Homologação: faxina e gêmea dos limites — PROPOSTA. Não aplicada.
--
-- Duas coisas, as duas restritas a `financas_homolog`. A tabela `financas` não
-- é tocada por este arquivo.
--
--   1. política de DELETE na tabela de homologação. Sem ela, o ensaio não
--      consegue apagar o que ele mesmo criou — a produção não tem DELETE de
--      propósito, e a de homologação herdou isso sem querer. Ali é o contrário:
--      é uma tabela descartável, e não conseguir descartar é o defeito.
--
--   2. os tetos contra criação abusiva (0004), aplicados primeiro aqui, pra dar
--      pra testar criação em massa sem arriscar a produção.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. faxina ─────────────────────────────────────────────────────────────
drop policy if exists "homolog remocao" on public.financas_homolog;
create policy "homolog remocao" on public.financas_homolog for delete using (true);

delete from public.financas_homolog;

-- ── 2. os números ─────────────────────────────────────────────────────────
create table if not exists public.aoii_limites (
  chave  text primary key,
  valor  bigint not null,
  nota   text
);

insert into public.aoii_limites (chave, valor, nota) values
  ('criacoes_por_hora', 30,      'linhas NOVAS por hora. Usuário real cria uma e depois só atualiza.'),
  ('linhas_no_total',   5000,    'freio de mão: acima disto, nenhuma linha nova.'),
  ('bytes_por_linha',   5242880, 'teto de tamanho do envelope, por linha.'),
  ('homolog_criacoes_por_hora', 10, 'teto menor em homologação, pra dar pra testar o limite rápido.')
on conflict (chave) do nothing;

revoke all on public.aoii_limites from anon, authenticated;
alter table public.aoii_limites enable row level security;

-- ── 3. a gêmea, agora com tetos ───────────────────────────────────────────
create or replace function public.aoii_put_homolog(
  p_id text, p_data jsonb, p_expected_revision integer, p_write_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  atual        public.financas_homolog%rowtype;
  hash         text;
  lim_bytes    bigint;
  lim_hora     bigint;
  criadas_hora bigint;
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
  select * into atual from public.financas_homolog where id = p_id for update;

  if not found then
    select valor into lim_hora from public.aoii_limites where chave = 'homolog_criacoes_por_hora';
    select count(*) into criadas_hora from public.financas_homolog
      where created_at > now() - interval '1 hour';
    if criadas_hora >= coalesce(lim_hora, 10) then
      return jsonb_build_object('erro', 'limite-criacao');
    end if;

    insert into public.financas_homolog (id, data, revision, device_id, write_token_hash, updated_at)
    values (p_id, p_data, 1, p_data->>'device_id', hash, now());
    return jsonb_build_object('ok', true, 'revision', 1);
  end if;

  if atual.write_token_hash is not null and atual.write_token_hash <> hash then
    return jsonb_build_object('erro', 'token');
  end if;

  if coalesce(p_expected_revision, -1) <> atual.revision then
    return jsonb_build_object('conflito', true, 'revision', atual.revision);
  end if;

  update public.financas_homolog
     set data = p_data, revision = atual.revision + 1, device_id = p_data->>'device_id',
         write_token_hash = hash, updated_at = now()
   where id = p_id;

  return jsonb_build_object('ok', true, 'revision', atual.revision + 1);
end;
$$;

revoke all on function public.aoii_put_homolog(text, jsonb, integer, text) from public;
grant execute on function public.aoii_put_homolog(text, jsonb, integer, text) to anon, authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Depois disto: npm run homolog  (o ensaio passa a incluir criação abusiva)
--
-- Se o ensaio esbarrar no teto de 10 durante o desenvolvimento:
--   delete from public.financas_homolog;
--   -- ou, temporariamente:
--   update aoii_limites set valor = 100 where chave = 'homolog_criacoes_por_hora';
-- ═══════════════════════════════════════════════════════════════════════════
