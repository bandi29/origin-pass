-- Product bulk import: staging sessions, audit logs, optional product columns
-- Safe to run on existing deployments (IF NOT EXISTS / additive only).

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Import audit log (one row per completed / attempted import)
-- -----------------------------------------------------------------------------
create table if not exists product_import_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  file_name text not null,
  total_rows integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status text not null default 'pending',
  mapping jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_product_import_logs_brand_id on product_import_logs(brand_id);
create index if not exists idx_product_import_logs_created_at on product_import_logs(created_at desc);

-- -----------------------------------------------------------------------------
-- Staging session (parsed rows before execute; short TTL)
-- -----------------------------------------------------------------------------
create table if not exists product_import_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  column_headers jsonb not null default '[]'::jsonb,
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz not null default (timezone('utc'::text, now()) + interval '2 hours')
);

create index if not exists idx_product_import_sessions_user_id on product_import_sessions(user_id);
create index if not exists idx_product_import_sessions_expires_at on product_import_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- Products: columns used by import + undo linkage
-- -----------------------------------------------------------------------------
alter table products add column if not exists origin_country text;
alter table products add column if not exists batch_number text;
alter table products add column if not exists manufacture_date date;
alter table products add column if not exists certifications jsonb default '[]'::jsonb;
alter table products add column if not exists import_qr_ref text;
alter table products add column if not exists import_log_id uuid references product_import_logs(id) on delete set null;

create index if not exists idx_products_import_log_id on products(import_log_id) where import_log_id is not null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table product_import_logs enable row level security;
alter table product_import_sessions enable row level security;

drop policy if exists "product_import_logs_select_own" on product_import_logs;
drop policy if exists "product_import_logs_insert_own" on product_import_logs;
drop policy if exists "product_import_logs_update_own" on product_import_logs;

create policy "product_import_logs_select_own" on product_import_logs
  for select using (brand_id = auth.uid());

create policy "product_import_logs_insert_own" on product_import_logs
  for insert with check (brand_id = auth.uid());

create policy "product_import_logs_update_own" on product_import_logs
  for update using (brand_id = auth.uid());

drop policy if exists "product_import_sessions_select_own" on product_import_sessions;
drop policy if exists "product_import_sessions_insert_own" on product_import_sessions;
drop policy if exists "product_import_sessions_update_own" on product_import_sessions;
drop policy if exists "product_import_sessions_delete_own" on product_import_sessions;

create policy "product_import_sessions_select_own" on product_import_sessions
  for select using (user_id = auth.uid());

create policy "product_import_sessions_insert_own" on product_import_sessions
  for insert with check (user_id = auth.uid());

create policy "product_import_sessions_update_own" on product_import_sessions
  for update using (user_id = auth.uid());

create policy "product_import_sessions_delete_own" on product_import_sessions
  for delete using (user_id = auth.uid());

grant select, insert, update on product_import_logs to authenticated;
grant select, insert, update, delete on product_import_sessions to authenticated;
