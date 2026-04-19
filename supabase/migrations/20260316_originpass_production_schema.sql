-- =============================================================================
-- OriginPass Production Schema
-- =============================================================================
-- Production-ready PostgreSQL schema for OriginPass SaaS platform.
-- Optimized for: multi-tenant organizations, high-volume scans, scalability.
--
-- DESIGN DECISIONS:
-- - passport_scans uses BIGSERIAL for append-only, partition-ready design
-- - organization_id denormalized on passports and passport_scans for tenant isolation
-- - ip_hash instead of raw IP for privacy/GDPR; use SHA256(ip) for lookups
-- - JSONB metadata for flexible schema evolution without migrations
--
-- DEPLOYMENT: For fresh installs. Existing deployments may need data migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. ENUM TYPES
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'originpass_passport_status') then
    create type originpass_passport_status as enum (
      'active',
      'inactive',
      'revoked',
      'flagged'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'originpass_verification_result') then
    create type originpass_verification_result as enum (
      'valid',
      'suspicious',
      'fraud'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2b. ALTER EXISTING TABLES (for incremental migration from legacy schema)
-- -----------------------------------------------------------------------------
-- Add organization_id to passports if missing; backfill from product
alter table passports add column if not exists organization_id uuid references organizations(id) on delete cascade;
update passports p set organization_id = pr.organization_id
from products pr
where p.product_id = pr.id and p.organization_id is null and pr.organization_id is not null;

-- Add organization_id to passport_scans if missing; backfill from passport
alter table passport_scans add column if not exists organization_id uuid references organizations(id) on delete cascade;
update passport_scans ps set organization_id = p.organization_id
from passports p
where ps.passport_id = p.id and ps.organization_id is null and p.organization_id is not null;

-- Add missing columns to products (organization_id may exist from 20260309)
alter table products add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table products add column if not exists sku text;
alter table products add column if not exists brand text;
alter table products add column if not exists metadata jsonb default '{}'::jsonb;
alter table products add column if not exists updated_at timestamptz default timezone('utc'::text, now());
create index if not exists idx_products_organization_id on products(organization_id);

-- Add missing columns to organizations
alter table organizations add column if not exists plan text default 'starter';
alter table organizations add column if not exists updated_at timestamptz default timezone('utc'::text, now());

-- Add missing columns to users
alter table users add column if not exists updated_at timestamptz default timezone('utc'::text, now());

-- Add missing columns to passports
alter table passports add column if not exists manufactured_at date;
alter table passports add column if not exists origin_country text;
alter table passports add column if not exists metadata jsonb default '{}'::jsonb;
alter table passports add column if not exists updated_at timestamptz default timezone('utc'::text, now());

-- Add missing columns to qr_codes (may have different structure)
alter table qr_codes add column if not exists qr_value text;
alter table qr_codes add column if not exists qr_url text;
alter table qr_codes add column if not exists updated_at timestamptz default timezone('utc'::text, now());
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'qr_codes' and column_name = 'verify_url') then
    update qr_codes set qr_value = verify_url, qr_url = verify_url where qr_value is null or qr_url is null;
  end if;
end $$;

-- Add missing columns to ownership_records
alter table ownership_records add column if not exists owner_identifier text;
alter table ownership_records add column if not exists updated_at timestamptz default timezone('utc'::text, now());
update ownership_records set owner_identifier = coalesce(owner_email, owner_name, 'unknown') where owner_identifier is null;

-- Add verification_result to passport_scans if missing (use originpass_verification_result)
alter table passport_scans add column if not exists verification_result text default 'valid';
alter table passport_scans add column if not exists ip_hash text;
alter table passport_scans add column if not exists country text;
alter table passport_scans add column if not exists city text;

-- -----------------------------------------------------------------------------
-- 3. ORGANIZATIONS
-- -----------------------------------------------------------------------------
-- Multi-tenant root. All data scoped by organization_id.
create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan text default 'starter',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_organizations_plan on organizations(plan);

-- -----------------------------------------------------------------------------
-- 4. USERS
-- -----------------------------------------------------------------------------
-- Application users. Link to auth.users via id for Supabase Auth.
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  email text unique not null,
  role text not null default 'member',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_users_organization_id on users(organization_id);
create index if not exists idx_users_email on users(email);

-- -----------------------------------------------------------------------------
-- 5. PRODUCTS
-- -----------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,
  sku text,
  brand text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_products_organization_id on products(organization_id);
create index if not exists idx_products_sku on products(organization_id, sku) where sku is not null;
create index if not exists idx_products_category on products(organization_id, category) where category is not null;

-- -----------------------------------------------------------------------------
-- 6. PASSPORTS
-- -----------------------------------------------------------------------------
-- Digital product passports. passport_uid = public-facing identifier (e.g. in QR).
-- organization_id denormalized for fast tenant filtering without product join.
create table if not exists passports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  passport_uid text not null,
  serial_number text not null,
  status originpass_passport_status not null default 'active',
  manufactured_at date,
  origin_country text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_passports_passport_uid unique (passport_uid),
  constraint uq_passports_serial_number unique (serial_number)
);

create unique index if not exists idx_passports_passport_uid on passports(passport_uid);
create index if not exists idx_passports_serial_number on passports(serial_number);
create index if not exists idx_passports_product_id on passports(product_id);
create index if not exists idx_passports_organization_id on passports(organization_id);
create index if not exists idx_passports_status on passports(status);
create index if not exists idx_passports_org_status on passports(organization_id, status);

-- -----------------------------------------------------------------------------
-- 7. QR_CODES
-- -----------------------------------------------------------------------------
-- One-to-many: passport can have multiple QR variants (label, packaging, etc.)
create table if not exists qr_codes (
  id uuid primary key default uuid_generate_v4(),
  passport_id uuid not null references passports(id) on delete cascade,
  qr_value text not null,
  qr_url text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_qr_codes_qr_value unique (qr_value)
);

create unique index if not exists idx_qr_codes_qr_value on qr_codes(qr_value);
create index if not exists idx_qr_codes_passport_id on qr_codes(passport_id);

-- -----------------------------------------------------------------------------
-- 8. OWNERSHIP_RECORDS
-- -----------------------------------------------------------------------------
-- Consumer ownership claims. owner_identifier = email or hashed user id.
create table if not exists ownership_records (
  id uuid primary key default uuid_generate_v4(),
  passport_id uuid not null references passports(id) on delete cascade,
  owner_identifier text not null,
  claimed_at timestamptz not null default timezone('utc'::text, now()),
  status text not null default 'active',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_ownership_records_passport_id on ownership_records(passport_id);
create index if not exists idx_ownership_records_owner on ownership_records(owner_identifier);
create index if not exists idx_ownership_records_claimed_at on ownership_records(claimed_at desc);

-- -----------------------------------------------------------------------------
-- 9. PASSPORT_SCANS (HIGH VOLUME - APPEND ONLY)
-- -----------------------------------------------------------------------------
-- BIGSERIAL for partition-friendly sequential IDs. Denormalized organization_id
-- avoids join to passports for tenant-scoped analytics.
--
-- PARTITIONING: When scan volume exceeds ~10M rows, partition by scan_timestamp:
--   CREATE TABLE passport_scans (...) PARTITION BY RANGE (scan_timestamp);
--   CREATE TABLE passport_scans_2024_q1 PARTITION OF passport_scans
--     FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
--
-- ip_hash: Store SHA256(ip) for fraud detection without storing PII.
create table if not exists passport_scans (
  id bigserial primary key,
  passport_id uuid not null references passports(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  scan_timestamp timestamptz not null default timezone('utc'::text, now()),
  country text,
  city text,
  device_type text,
  ip_hash text,
  verification_result originpass_verification_result not null default 'valid',
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Required indexes per spec
create index if not exists idx_passport_scans_passport_id on passport_scans(passport_id);
create index if not exists idx_passport_scans_scan_timestamp on passport_scans(scan_timestamp desc);
create index if not exists idx_passport_scans_organization_id on passport_scans(organization_id);

-- Composite for common query: org + time range (analytics dashboards)
create index if not exists idx_passport_scans_org_timestamp on passport_scans(organization_id, scan_timestamp desc);

-- Partial index for fraud review (small subset of rows)
create index if not exists idx_passport_scans_suspicious on passport_scans(passport_id, scan_timestamp desc)
  where verification_result in ('suspicious', 'fraud');

-- -----------------------------------------------------------------------------
-- 10. UPDATED_AT TRIGGERS
-- -----------------------------------------------------------------------------
create or replace function originpass_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'organizations', 'users', 'products', 'passports', 'qr_codes', 'ownership_records'
  ];
begin
  foreach t in array tables_with_updated_at
  loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'updated_at')
    then
      execute format(
        'drop trigger if exists trg_%s_updated_at on %I; create trigger trg_%s_updated_at before update on %I for each row execute function originpass_updated_at();',
        t, t, t, t
      );
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (Supabase)
-- -----------------------------------------------------------------------------
alter table organizations enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table passports enable row level security;
alter table qr_codes enable row level security;
alter table ownership_records enable row level security;
alter table passport_scans enable row level security;

-- Organizations: users see own org
drop policy if exists "org_select_own" on organizations;
create policy "org_select_own" on organizations for select
  using (id in (select organization_id from users where id = auth.uid()));

-- Users: see org members
drop policy if exists "users_select_org" on users;
create policy "users_select_org" on users for select
  using (organization_id in (select organization_id from users where id = auth.uid()));

-- Products: org-scoped
drop policy if exists "products_select_org" on products;
drop policy if exists "products_insert_org" on products;
drop policy if exists "products_update_org" on products;
create policy "products_select_org" on products for select
  using (organization_id in (select organization_id from users where id = auth.uid()));
create policy "products_insert_org" on products for insert
  with check (organization_id in (select organization_id from users where id = auth.uid()));
create policy "products_update_org" on products for update
  using (organization_id in (select organization_id from users where id = auth.uid()));

-- Passports: org-scoped (fallback to product.org when organization_id null for legacy)
drop policy if exists "passports_select_org" on passports;
drop policy if exists "passports_insert_org" on passports;
drop policy if exists "passports_update_org" on passports;
create policy "passports_select_org" on passports for select
  using (
    coalesce(organization_id, (select organization_id from products where id = passports.product_id))
    in (select organization_id from users where id = auth.uid())
    or product_id in (select id from products where brand_id = auth.uid())
  );
create policy "passports_insert_org" on passports for insert
  with check (
    coalesce(organization_id, (select organization_id from products where id = passports.product_id))
    in (select organization_id from users where id = auth.uid())
    or product_id in (select id from products where brand_id = auth.uid())
  );
create policy "passports_update_org" on passports for update
  using (
    coalesce(organization_id, (select organization_id from products where id = passports.product_id))
    in (select organization_id from users where id = auth.uid())
    or product_id in (select id from products where brand_id = auth.uid())
  );

-- QR codes: via passport
drop policy if exists "qr_codes_select" on qr_codes;
drop policy if exists "qr_codes_insert" on qr_codes;
create policy "qr_codes_select" on qr_codes for select
  using (passport_id in (select p.id from passports p left join products pr on pr.id = p.product_id where coalesce(p.organization_id, pr.organization_id) in (select organization_id from users where id = auth.uid()) or pr.brand_id = auth.uid()));
create policy "qr_codes_insert" on qr_codes for insert
  with check (passport_id in (select p.id from passports p left join products pr on pr.id = p.product_id where coalesce(p.organization_id, pr.organization_id) in (select organization_id from users where id = auth.uid()) or pr.brand_id = auth.uid()));

-- Ownership: org can view; authenticated can insert (consumer claim)
drop policy if exists "ownership_select_org" on ownership_records;
drop policy if exists "ownership_insert_auth" on ownership_records;
create policy "ownership_select_org" on ownership_records for select
  using (passport_id in (select p.id from passports p left join products pr on pr.id = p.product_id where coalesce(p.organization_id, pr.organization_id) in (select organization_id from users where id = auth.uid()) or pr.brand_id = auth.uid()));
create policy "ownership_insert_auth" on ownership_records for insert
  with check (auth.uid() is not null);

-- Scans: org-scoped (passport_scans may have organization_id or derive from passport)
drop policy if exists "scans_select_org" on passport_scans;
drop policy if exists "scans_insert_org" on passport_scans;
create policy "scans_select_org" on passport_scans for select
  using (
    organization_id in (select organization_id from users where id = auth.uid())
    or (organization_id is null and passport_id in (select p.id from passports p left join products pr on pr.id = p.product_id where coalesce(p.organization_id, pr.organization_id) in (select organization_id from users where id = auth.uid()) or pr.brand_id = auth.uid()))
  );
create policy "scans_insert_org" on passport_scans for insert
  with check (
    organization_id in (select organization_id from users where id = auth.uid())
    or (organization_id is null and passport_id in (select p.id from passports p left join products pr on pr.id = p.product_id where coalesce(p.organization_id, pr.organization_id) in (select organization_id from users where id = auth.uid()) or pr.brand_id = auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 12. COMMENTS
-- -----------------------------------------------------------------------------
comment on table passport_scans is 'Append-only. Partition by scan_timestamp when >10M rows.';
comment on column passport_scans.ip_hash is 'SHA256(ip) for fraud detection without storing PII';
comment on column passport_scans.verification_result is 'valid=trusted, suspicious=review, fraud=blocked';
