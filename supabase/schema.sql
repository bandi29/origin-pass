-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USAGE EVENT TYPE
create type usage_event as enum ('item_created', 'scan');

-- PROFILES: Linked to auth.users
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  brand_name text,
  paddle_customer_id text,
  paddle_subscription_id text,
  subscription_status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- PRODUCTS: General product details
create table products (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  story text,
  materials text,
  origin text,
  lifecycle text,
  is_archived boolean default false,
  image_url text, -- for product image
  json_ld jsonb default null, -- canonical JSON-LD for EU DPP compliance (future-proof)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- BATCHES: Production runs
create table batches (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references profiles(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  production_run_name text,
  artisan_name text,
  location text,
  produced_at date,
  is_active boolean default true not null,
  -- EU DPP / ESPR 2026 fields
  material_composition jsonb default '[]'::jsonb,
  maintenance_instructions text,
  end_of_life_instructions text,
  facility_info text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ITEMS: Individual items
-- Serial ID is immutable and never deleted.
create table items (
  id uuid default gen_random_uuid() primary key,
  serial_id text unique not null,
  brand_id uuid references profiles(id) on delete cascade not null,
  batch_id uuid references batches(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- USAGE_LOGS: Tracking for billing
create table usage_logs (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references profiles(id) on delete cascade not null,
  event_type usage_event,
  paddle_txn_id text, -- Sync reference
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table products enable row level security;
alter table batches enable row level security;
alter table items enable row level security;
alter table usage_logs enable row level security;

-- PROFILES
create policy "Brands can view own profile" on profiles
  for select using (auth.uid() = id);

create policy "Brands can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Restrict updates to non-sensitive fields (subscription fields should be server-side only)
create policy "Brands update profile info" on profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent user updates to subscription fields
revoke update (subscription_status, paddle_customer_id, paddle_subscription_id) on profiles from authenticated;
grant update (brand_name) on profiles to authenticated;

-- PRODUCTS
create policy "Brands can view own products" on products
  for select using (auth.uid() = brand_id);

create policy "Brands can insert own products" on products
  for insert with check (auth.uid() = brand_id);

create policy "Brands can update own products" on products
  for update using (auth.uid() = brand_id);

-- Prefer soft delete via is_archived; no delete policy for products.

-- BATCHES
create policy "Brands can view own batches" on batches
  for select using (auth.uid() = brand_id);

create policy "Brands can insert own batches" on batches
  for insert with check (auth.uid() = brand_id);

create policy "Brands can update own batches" on batches
  for update using (auth.uid() = brand_id);

create policy "Brands can delete own batches" on batches
  for delete using (auth.uid() = brand_id);

-- ITEMS
create policy "Brands can view own items" on items
  for select using (auth.uid() = brand_id);

create policy "Brands can insert own items" on items
  for insert with check (auth.uid() = brand_id);
-- No delete policy for items to ensure immutability as per requirements

-- USAGE LOGS
create policy "Brands can view own usage" on usage_logs
  for select using (auth.uid() = brand_id);
-- Logs are immutable by nature, no update/delete policies for users.

-- PUBLIC READ VIEW (SAFE FIELDS ONLY)
-- Restricted to active batches; SECURITY DEFINER by design (see migration comment).
create or replace view public_item_scan with (security_invoker = false) as
select
  items.serial_id,
  products.name as product_name,
  products.story,
  products.image_url,
  batches.production_run_name,
  profiles.brand_name
from items
join batches on batches.id = items.batch_id
join products on products.id = batches.product_id
join profiles on profiles.id = items.brand_id
where batches.is_active = true;

grant select on public_item_scan to anon;

-- INDEXES
create index if not exists idx_items_serial_id on items(serial_id);
create index if not exists idx_products_brand_id on products(brand_id);
create index if not exists idx_batches_brand_id on batches(brand_id);
create index if not exists idx_items_brand_id on items(brand_id);
create index if not exists idx_usage_logs_brand_id on usage_logs(brand_id);

-- PUBLIC ACCESS POLICIES (ONLY FOR SAFE VIEW)
drop policy if exists "Public can view items by serial_id" on items;
drop policy if exists "Public can view products via item" on products;

-- SUBSCRIPTION FIELD GUARD (DEFENSE IN DEPTH)
create or replace function handle_subscription_protection()
returns trigger as $$
begin
  if (old.subscription_status is distinct from new.subscription_status) then
    if current_setting('role', true) != 'service_role' then
      new.subscription_status := old.subscription_status;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists check_subscription_update on profiles;
drop trigger if exists enforce_subscription_protection on profiles;
create trigger enforce_subscription_protection
  before update on profiles
  for each row execute function handle_subscription_protection();

-- =====================================================
-- SCALABLE CORE TABLES (additive, enterprise-ready)
-- =====================================================

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

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  subscription_plan text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  password_hash text,
  name text,
  organization_id uuid references organizations(id) on delete set null,
  role text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table products add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table products add column if not exists description text;
alter table products add column if not exists category text;

create table if not exists passports (
  id uuid primary key default gen_random_uuid(),
  passport_uid text not null unique,
  product_id uuid references products(id) on delete cascade not null,
  serial_number text not null unique,
  blockchain_hash text,
  status passport_status not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now())
);

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

create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  verification_type text not null,
  status verification_status not null default 'pending',
  reviewed_by uuid references users(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  key_hash text not null unique,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  action text not null,
  resource text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_users_organization_id on users(organization_id);
create index if not exists idx_products_organization_id on products(organization_id);
create index if not exists idx_passports_product_id on passports(product_id);
create index if not exists idx_passports_status on passports(status);
create index if not exists idx_passport_scans_passport_id on passport_scans(passport_id);
create index if not exists idx_passport_scans_scan_timestamp on passport_scans(scan_timestamp desc);
create index if not exists idx_verifications_passport_id on verifications(passport_id);
create index if not exists idx_api_keys_organization_id on api_keys(organization_id);
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);

-- =====================================================
-- QR_CODES: QR identity metadata per passport
-- =====================================================
create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  format text not null default 'url',
  verify_url text not null,
  label_spec jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_qr_codes_passport_id on qr_codes(passport_id);

-- =====================================================
-- OWNERSHIP_RECORDS: Consumer ownership claims per passport
-- =====================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ownership_status') then
    create type ownership_status as enum ('claimed', 'transferred', 'revoked');
  end if;
end $$;

create table if not exists ownership_records (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  owner_email text,
  owner_name text,
  status ownership_status not null default 'claimed',
  claimed_at timestamptz not null default timezone('utc'::text, now()),
  transferred_to uuid references ownership_records(id) on delete set null,
  proof_of_purchase text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);
create index if not exists idx_ownership_records_passport_id on ownership_records(passport_id);
create index if not exists idx_ownership_records_owner_email on ownership_records(owner_email);
create index if not exists idx_ownership_records_claimed_at on ownership_records(claimed_at desc);

-- =====================================================
-- VERIFICATION_LOGS: View alias for verifications
-- =====================================================
create or replace view verification_logs as
select id, passport_id, verification_type, status, reviewed_by, review_notes, created_at
from verifications;
