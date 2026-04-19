-- Async product import: job queue metadata, per-row errors, SKU upsert support
-- Requires pgcrypto (already enabled in prior migrations).

do $$ begin
  create type import_job_status as enum (
    'UPLOADED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'PARTIAL_SUCCESS'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  file_url text not null,
  file_name text not null,
  content_hash text,
  mapping jsonb not null default '{}'::jsonb,
  status import_job_status not null default 'UPLOADED',
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  product_import_log_id uuid references product_import_logs(id) on delete set null,
  last_error text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_import_jobs_user_id on import_jobs(user_id);
create index if not exists idx_import_jobs_brand_id on import_jobs(brand_id);
create index if not exists idx_import_job_status on import_jobs(status);
create index if not exists idx_import_jobs_created_at on import_jobs(created_at desc);

create table if not exists import_errors (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references import_jobs(id) on delete cascade,
  row_number integer not null,
  error_message text not null,
  raw_data jsonb
);

create index if not exists idx_import_errors_job_id on import_errors(job_id);

-- Normalized SKU for idempotent imports (CSV "product_id" → products.sku)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'sku_normalized'
  ) then
    alter table products add column sku_normalized text
      generated always as (
        case
          when sku is null or length(trim(sku)) = 0 then null
          else lower(trim(sku))
        end
      ) stored;
  end if;
end $$;

drop index if exists uq_products_brand_sku_norm;
create unique index if not exists uq_products_brand_sku_norm on products (brand_id, sku_normalized);

create or replace function public.merge_products_import_batch(
  p_brand_id uuid,
  p_organization_id uuid,
  p_import_log_id uuid,
  p_rows jsonb
) returns integer
language sql
security definer
set search_path = public
as $$
  with expanded as (
    select
      p_brand_id as brand_id,
      p_organization_id as organization_id,
      nullif(trim(value->>'name'), '') as name,
      nullif(trim(value->>'sku'), '') as sku,
      nullif(trim(value->>'category'), '') as category,
      nullif(trim(value->>'brand'), '') as brand,
      null::text as story,
      nullif(value->>'materials', '') as materials,
      nullif(trim(value->>'origin'), '') as origin,
      nullif(trim(value->>'origin_country'), '') as origin_country,
      nullif(trim(value->>'batch_number'), '') as batch_number,
      case
        when value->>'manufacture_date' is null or trim(value->>'manufacture_date') = '' then null
        else (value->>'manufacture_date')::date
      end as manufacture_date,
      coalesce(value->'certifications', '[]'::jsonb) as certifications,
      nullif(trim(value->>'import_qr_ref'), '') as import_qr_ref,
      p_import_log_id as import_log_id,
      null::text as lifecycle,
      null::text as image_url,
      false as is_archived,
      value->'json_ld' as json_ld
    from jsonb_array_elements(p_rows) as t(value)
  ),
  upserted as (
    insert into products (
      brand_id, organization_id, name, sku, category, brand, story, materials, origin,
      origin_country, batch_number, manufacture_date, certifications, import_qr_ref,
      import_log_id, lifecycle, image_url, is_archived, json_ld
    )
    select * from expanded
    on conflict (brand_id, sku_normalized) do update set
      organization_id = excluded.organization_id,
      name = excluded.name,
      sku = excluded.sku,
      category = excluded.category,
      brand = excluded.brand,
      materials = excluded.materials,
      origin = excluded.origin,
      origin_country = excluded.origin_country,
      batch_number = excluded.batch_number,
      manufacture_date = excluded.manufacture_date,
      certifications = excluded.certifications,
      import_qr_ref = excluded.import_qr_ref,
      import_log_id = excluded.import_log_id,
      json_ld = excluded.json_ld,
      updated_at = timezone('utc'::text, now())
    returning 1
  )
  select count(*)::integer from upserted;
$$;

revoke all on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) to service_role;

alter table import_jobs enable row level security;
alter table import_errors enable row level security;

drop policy if exists "import_jobs_select_own" on import_jobs;
drop policy if exists "import_jobs_insert_own" on import_jobs;
drop policy if exists "import_jobs_update_own" on import_jobs;

create policy "import_jobs_select_own" on import_jobs
  for select using (user_id = auth.uid());

create policy "import_jobs_insert_own" on import_jobs
  for insert with check (user_id = auth.uid());

create policy "import_jobs_update_own" on import_jobs
  for update using (user_id = auth.uid());

drop policy if exists "import_errors_select_own" on import_errors;
drop policy if exists "import_errors_insert_own" on import_errors;
drop policy if exists "import_errors_delete_own" on import_errors;

create policy "import_errors_select_own" on import_errors
  for select using (
    exists (select 1 from import_jobs j where j.id = import_errors.job_id and j.user_id = auth.uid())
  );

create policy "import_errors_insert_own" on import_errors
  for insert with check (
    exists (select 1 from import_jobs j where j.id = import_errors.job_id and j.user_id = auth.uid())
  );

create policy "import_errors_delete_own" on import_errors
  for delete using (
    exists (select 1 from import_jobs j where j.id = import_errors.job_id and j.user_id = auth.uid())
  );

grant select, insert, update on import_jobs to authenticated;
grant select, insert, delete on import_errors to authenticated;
