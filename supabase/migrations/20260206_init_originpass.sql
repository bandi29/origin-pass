-- Initial OriginPass schema migration
-- Generated from supabase/schema.sql

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
join profiles on profiles.id = items.brand_id;

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
