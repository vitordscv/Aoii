-- ═══════════════════════════════════════════════════════════════════════════
-- Homologação: tabela e funções gêmeas, para ensaiar o ciclo inteiro sem
-- encostar nos dados reais.
--
-- Mesma estrutura, mesmas regras e mesmas políticas temporárias da produção —
-- a ideia é que o ensaio reproduza o estado real, inclusive a leitura ainda
-- aberta. Só o nome muda: financas_homolog, aoii_get_homolog, aoii_put_homolog.
--
-- Os corpos são cópia dos de 0001_sync_seguro.sql. Se um dia aquele mudar, este
-- precisa mudar junto — está anotado como risco em docs/SYNC-DESIGN.md.
--
-- Isto é aditivo e descartável: o rodapé tem o SQL que apaga tudo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.financas_homolog (
  id                text primary key,
  data              jsonb not null,
  updated_at        timestamptz not null default now(),
  revision          integer not null default 0,
  device_id         text,
  write_token_hash  text,
  created_at        timestamptz not null default now()
);

alter table public.financas_homolog enable row level security;

drop policy if exists "homolog leitura"     on public.financas_homolog;
drop policy if exists "homolog insercao"    on public.financas_homolog;
drop policy if exists "homolog atualizacao" on public.financas_homolog;
create policy "homolog leitura"     on public.financas_homolog for select using (true);
create policy "homolog insercao"    on public.financas_homolog for insert with check (true);
create policy "homolog atualizacao" on public.financas_homolog for update using (true) with check (true);

create or replace function public.aoii_get_homolog(p_id text)
returns jsonb language sql security definer set search_path = public, pg_temp stable as $$
  select jsonb_build_object('data', f.data, 'revision', f.revision,
                            'device_id', f.device_id, 'updated_at', f.updated_at)
  from public.financas_homolog f where f.id = p_id limit 1;
$$;

create or replace function public.aoii_put_homolog(
  p_id text, p_data jsonb, p_expected_revision integer, p_write_token text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  atual public.financas_homolog%rowtype;
  hash  text;
begin
  if p_id is null or length(p_id) < 8 or length(p_id) > 64 then
    return jsonb_build_object('erro', 'id');
  end if;
  if p_write_token is null or length(p_write_token) < 32 then
    return jsonb_build_object('erro', 'token');
  end if;
  if pg_column_size(p_data) > 5 * 1024 * 1024 then
    return jsonb_build_object('erro', 'tamanho');
  end if;

  hash := encode(sha256(convert_to(p_write_token, 'UTF8')), 'hex');
  select * into atual from public.financas_homolog where id = p_id for update;

  if not found then
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

revoke all on function public.aoii_get_homolog(text) from public;
revoke all on function public.aoii_put_homolog(text, jsonb, integer, text) from public;
grant execute on function public.aoii_get_homolog(text) to anon, authenticated;
grant execute on function public.aoii_put_homolog(text, jsonb, integer, text) to anon, authenticated;

-- limpa a linha de teste que ficou da conferência da parte 1
delete from public.financas where id in ('ZZTESTE001','TESTE0001');

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Descartar a homologação quando ela não for mais necessária:
--   begin;
--   drop function if exists public.aoii_put_homolog(text, jsonb, integer, text);
--   drop function if exists public.aoii_get_homolog(text);
--   drop table if exists public.financas_homolog;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
