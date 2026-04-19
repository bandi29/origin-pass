-- Scalable core schema aligned to product wireframe requirements.
-- This migration is additive and backward-compatible with existing OriginPass tables.

create extension if not exists "pgcrypto";

-- Enumerations
do $$
begin
  if not exists (select 1 from pg_type where typname = 'passport_status') then
    create type passport_status as enum ('active', 'revoked', 'expired', 'counterfeit_flagged');
  end if;
  if not exists (select 1 from pg_type where typname = 'passport_scan_result') then
    create type passport_scan_result as enum ('valid', 'duplicate', 'invalid', 'suspicious');
  end if;
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- Organizations
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  subscription_plan text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table organizations add column if not exists name text;
alter table organizations add column if not exists industry text;
alter table organizations add column if not exists subscription_plan text;
alter table organizations add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

-- Application users (mapped to auth.users for identity)
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  password_hash text,
  name text,
  organization_id uuid references organizations(id) on delete set null,
  role text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table users add column if not exists email text;
alter table users add column if not exists password_hash text;
alter table users add column if not exists name text;
alter table users add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table users add column if not exists role text;
alter table users add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

-- Align existing products table with requested structure
alter table if exists products add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table if exists products add column if not exists description text;
alter table if exists products add column if not exists category text;

-- Backfill organizations/users from existing profile/auth setup
insert into organizations (id, name, subscription_plan, created_at)
select p.id, coalesce(p.brand_name, 'Organization'), p.subscription_status, p.created_at
from profiles p
on conflict (id) do update
set name = excluded.name;

-- Ensure every legacy product.brand_id has an organization row before FK-backed updates.
insert into organizations (id, name, created_at)
select distinct
  p.brand_id,
  coalesce(pr.brand_name, 'Organization'),
  coalesce(pr.created_at, timezone('utc'::text, now()))
from products p
left join profiles pr on pr.id = p.brand_id
where p.brand_id is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'brand_id'
  )
  and not exists (
    select 1 from organizations o where o.id = p.brand_id
  );

-- Backfill organization_id from legacy brand linkage when available (safe FK-aware update).
update products p
set organization_id = p.brand_id
where p.organization_id is null
  and p.brand_id is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'brand_id'
  )
  and exists (
    select 1 from organizations o where o.id = p.brand_id
  );

insert into users (id, email, name, organization_id, role, created_at)
select
  au.id,
  au.email,
  coalesce(au.raw_user_meta_data->>'full_name', p.brand_name, 'User'),
  p.id,
  'owner',
  au.created_at
from auth.users au
left join profiles p on p.id = au.id
on conflict (id) do update
set email = excluded.email,
    name = excluded.name,
    organization_id = coalesce(users.organization_id, excluded.organization_id);

-- Passports
create table if not exists passports (
  id uuid primary key default gen_random_uuid(),
  passport_uid text not null unique,
  product_id uuid references products(id) on delete cascade not null,
  serial_number text not null unique,
  blockchain_hash text,
  status passport_status not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table passports add column if not exists passport_uid text;
alter table passports add column if not exists product_id uuid references products(id) on delete cascade;
alter table passports add column if not exists serial_number text;
alter table passports add column if not exists blockchain_hash text;
alter table passports add column if not exists status passport_status not null default 'active';
alter table passports add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
create unique index if not exists uq_passports_passport_uid on passports(passport_uid);
create unique index if not exists uq_passports_serial_number on passports(serial_number);

-- Passport scans (high-volume fact table)
create table if not exists passport_scans (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  scan_timestamp timestamptz not null default timezone('utc'::text, now()),
  location_country text,
  location_city text,
  device_type text,
  ip_address text,
  scan_result passport_scan_result not null default 'valid',
  risk_score numeric(5,2),
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table passport_scans add column if not exists passport_id uuid references passports(id) on delete cascade;
alter table passport_scans add column if not exists scan_timestamp timestamptz not null default timezone('utc'::text, now());
alter table passport_scans add column if not exists location_country text;
alter table passport_scans add column if not exists location_city text;
alter table passport_scans add column if not exists device_type text;
alter table passport_scans add column if not exists ip_address text;
alter table passport_scans add column if not exists scan_result passport_scan_result not null default 'valid';
alter table passport_scans add column if not exists risk_score numeric(5,2);
alter table passport_scans add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

-- Verifications
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  verification_type text not null,
  status verification_status not null default 'pending',
  reviewed_by uuid references users(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table verifications add column if not exists passport_id uuid references passports(id) on delete cascade;
alter table verifications add column if not exists verification_type text;
alter table verifications add column if not exists status verification_status not null default 'pending';
alter table verifications add column if not exists reviewed_by uuid references users(id) on delete set null;
alter table verifications add column if not exists review_notes text;
alter table verifications add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

-- API keys
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  key_hash text not null unique,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table api_keys add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table api_keys add column if not exists key_hash text;
alter table api_keys add column if not exists permissions jsonb not null default '[]'::jsonb;
alter table api_keys add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
create unique index if not exists uq_api_keys_key_hash on api_keys(key_hash);

-- Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  resource text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
alter table audit_logs add column if not exists user_id uuid references users(id) on delete set null;
alter table audit_logs add column if not exists action text;
alter table audit_logs add column if not exists resource text;
alter table audit_logs add column if not exists metadata jsonb default '{}'::jsonb;
alter table audit_logs add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

-- Performance indexes for scale
create index if not exists idx_users_organization_id on users(organization_id);
create index if not exists idx_products_organization_id on products(organization_id);
create index if not exists idx_passports_product_id on passports(product_id);
create index if not exists idx_passports_status on passports(status);
create index if not exists idx_passport_scans_passport_id on passport_scans(passport_id);
create index if not exists idx_passport_scans_scan_timestamp on passport_scans(scan_timestamp desc);
create index if not exists idx_passport_scans_result on passport_scans(scan_result);
create index if not exists idx_passport_scans_location_country on passport_scans(location_country);
create index if not exists idx_verifications_passport_id on verifications(passport_id);
create index if not exists idx_verifications_status on verifications(status);
create index if not exists idx_api_keys_organization_id on api_keys(organization_id);
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);

-- RLS baseline
alter table organizations enable row level security;
alter table users enable row level security;
alter table passports enable row level security;
alter table passport_scans enable row level security;
alter table verifications enable row level security;
alter table api_keys enable row level security;
alter table audit_logs enable row level security;

-- Minimal ownership policies
drop policy if exists "Org members view organizations" on organizations;
create policy "Org members view organizations" on organizations
  for select using (
    exists (
      select 1
      from users u
      where u.id = auth.uid()
        and u.organization_id = organizations.id
    )
  );

drop policy if exists "Users view own row" on users;
create policy "Users view own row" on users
  for select using (id = auth.uid());

drop policy if exists "Users view org users" on users;
create policy "Users view org users" on users
  for select using (
    exists (
      select 1
      from users me
      where me.id = auth.uid()
        and me.organization_id is not null
        and me.organization_id = users.organization_id
    )
  );
