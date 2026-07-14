-- PART 2 — Scalable verification schema (evidence rows, not hardcoded store columns).
--
-- Canonical model:
--   organizations.id  → certificates.store_id  (Shopify store / tenant)
--   products.id       → certificates.product_id (NULL = brand/global evidence)
--   field_key         → extensible claim key (production_location, care_instructions, …)
--
-- Legacy columns such as location_proof_url / care_proof_url on organizations (or stores)
-- are backfilled here when present, then dropped. No proof URL columns remain on the store.

-- 1. Verification status enum.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'certificate_verification_status') then
    create type certificate_verification_status as enum (
      'unverified',
      'self_attested',
      'third_party_verified'
    );
  end if;
end$$;

-- 2. Certificates table (idempotent — matches production spec).
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  field_key text not null,
  file_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size integer not null,
  verification_status certificate_verification_status not null default 'self_attested',
  uploaded_at timestamptz not null default now()
);

comment on table public.certificates is
  'Verification evidence for passport field claims. One row per (store, field) at global scope, or per (store, product, field) when product-scoped. file_path is a private-bucket object key — never a public URL.';

comment on column public.certificates.store_id is
  'Tenant store (organizations.id). Derived from Shopify session in app routes.';

comment on column public.certificates.product_id is
  'NULL = brand/global-level evidence; set = product-specific evidence for that claim.';

comment on column public.certificates.field_key is
  'Extensible claim key, e.g. production_location, care_instructions, materials, carbon_footprint, substances, recycling.';

comment on column public.certificates.file_path is
  'Object path in supplier-certificates bucket. Signed URLs are minted on demand.';

comment on column public.certificates.original_filename is
  'Merchant-facing filename (display metadata only). Stored object name is a UUID.';

comment on column public.certificates.verification_status is
  'unverified | self_attested (default on upload) | third_party_verified.';

-- Ensure columns exist on environments that created an early partial table.
alter table public.certificates
  add column if not exists product_id uuid references public.products(id) on delete cascade,
  add column if not exists field_key text,
  add column if not exists file_path text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size integer,
  add column if not exists verification_status certificate_verification_status not null default 'self_attested',
  add column if not exists uploaded_at timestamptz not null default now();

alter table public.certificates alter column field_key set not null;
alter table public.certificates alter column file_path set not null;
alter table public.certificates alter column original_filename set not null;
alter table public.certificates alter column mime_type set not null;
alter table public.certificates alter column file_size set not null;

create index if not exists certificates_store_id_idx on public.certificates (store_id);
create index if not exists certificates_product_id_idx on public.certificates (product_id);
create index if not exists certificates_store_field_idx on public.certificates (store_id, field_key);

create unique index if not exists certificates_store_field_global_uniq
  on public.certificates (store_id, field_key) where product_id is null;

create unique index if not exists certificates_store_product_field_uniq
  on public.certificates (store_id, product_id, field_key) where product_id is not null;

alter table public.certificates drop constraint if exists certificates_field_key_format;
alter table public.certificates add constraint certificates_field_key_format
  check (field_key ~ '^[a-z][a-z0-9_]*$');

alter table public.certificates drop constraint if exists certificates_file_path_not_url;
alter table public.certificates add constraint certificates_file_path_not_url
  check (file_path !~* '^https?://');

-- 3. Backfill legacy hardcoded proof URL columns → certificates rows (preserve data).
create or replace function public.migrate_legacy_store_proof_column(
  p_table regclass,
  p_column text,
  p_field_key text
) returns void
language plpgsql
as $$
declare
  v_sql text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = split_part(p_table::text, '.', 1)
      and table_name = split_part(p_table::text, '.', 2)
      and column_name = p_column
  ) then
    return;
  end if;

  v_sql := format($q$
    insert into public.certificates (
      store_id,
      product_id,
      field_key,
      file_path,
      original_filename,
      mime_type,
      file_size,
      verification_status,
      uploaded_at
    )
    select
      s.id,
      null,
      %L,
      case
        when s.%I ~* '^https?://.*/storage/v1/object/(public|sign)/supplier-certificates/(.+)$'
          then regexp_replace(s.%I, '^https?://.*/storage/v1/object/(public|sign)/supplier-certificates/', '')
        when s.%I ~* '^https?://'
          then regexp_replace(s.%I, '^https?://[^/]+/', '')
        else btrim(s.%I)
      end,
      coalesce(
        nullif(regexp_replace(s.%I, '^.*/', ''), ''),
        'legacy-document.pdf'
      ),
      case
        when s.%I ~* '\.png($|\?)' then 'image/png'
        else 'application/pdf'
      end,
      0,
      'self_attested'::certificate_verification_status,
      now()
    from %s s
    where s.%I is not null
      and btrim(s.%I::text) <> ''
      and not exists (
        select 1
        from public.certificates c
        where c.store_id = s.id
          and c.product_id is null
          and c.field_key = %L
      )
  $q$,
    p_field_key,
    p_column, p_column, p_column, p_column, p_column, p_column, p_column, p_column,
    p_table,
    p_column, p_column,
    p_field_key
  );

  execute v_sql;
  execute format('alter table %s drop column if exists %I', p_table, p_column);
end;
$$;

select public.migrate_legacy_store_proof_column('public.organizations'::regclass, 'location_proof_url', 'production_location');
select public.migrate_legacy_store_proof_column('public.organizations'::regclass, 'care_proof_url', 'care_instructions');
select public.migrate_legacy_store_proof_column('public.organizations'::regclass, 'production_location_proof_url', 'production_location');
select public.migrate_legacy_store_proof_column('public.organizations'::regclass, 'care_instructions_proof_url', 'care_instructions');

do $$
begin
  if to_regclass('public.stores') is not null then
    perform public.migrate_legacy_store_proof_column('public.stores'::regclass, 'location_proof_url', 'production_location');
    perform public.migrate_legacy_store_proof_column('public.stores'::regclass, 'care_proof_url', 'care_instructions');
    perform public.migrate_legacy_store_proof_column('public.stores'::regclass, 'production_location_proof_url', 'production_location');
    perform public.migrate_legacy_store_proof_column('public.stores'::regclass, 'care_instructions_proof_url', 'care_instructions');
  end if;
end$$;

drop function if exists public.migrate_legacy_store_proof_column(regclass, text, text);

-- 4. RLS (service role only — tenant isolation in app layer).
alter table public.certificates enable row level security;

drop policy if exists "certificates_service_role_all" on public.certificates;
create policy "certificates_service_role_all"
  on public.certificates for all
  to service_role
  using (true) with check (true);
