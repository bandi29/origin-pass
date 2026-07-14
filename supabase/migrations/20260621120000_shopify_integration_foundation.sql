-- Shopify app integration foundation (non-breaking, backwards-compatible).
-- Maps to existing tenant model:
--   organizations  → stores / tenants
--   products         → product master profiles
--   passports        → variant-level passport records (Shopify ProductVariant anchor)
--
-- Standalone web-portal rows remain valid: all Shopify-specific columns are NULLABLE
-- (or DEFAULT 'manual' on external_source) so existing INSERT/UPDATE paths unchanged.

-- ---------------------------------------------------------------------------
-- 1. ORGANIZATIONS (stores / tenants)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists shop_domain text,
  add column if not exists shopify_access_token text,
  add column if not exists global_production_location text,
  add column if not exists global_care_instructions text;

comment on column public.organizations.shop_domain is
  'Shopify shop hostname (e.g. brand-name.myshopify.com). NULL for standalone portal tenants.';
comment on column public.organizations.shopify_access_token is
  'Shopify offline access token for background sync. NULL for standalone tenants. Read/write via service_role only — never expose to client RLS policies.';
comment on column public.organizations.global_production_location is
  'Tenant-wide fallback facility / production location for on-the-fly passports when record-level data is absent.';
comment on column public.organizations.global_care_instructions is
  'Tenant-wide fallback care instructions for on-the-fly passports when record-level data is absent.';

-- One Shopify shop ↔ one OriginPass organization (standalone orgs keep shop_domain NULL).
create unique index if not exists uq_organizations_shop_domain
  on public.organizations (shop_domain)
  where shop_domain is not null;

-- ---------------------------------------------------------------------------
-- 2. PRODUCTS (master catalog profiles)
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists external_source text not null default 'manual',
  add column if not exists external_product_id text;

comment on column public.products.external_source is
  'Origin of the product row: manual (web portal wizard), shopify (app sync/webhook), etc.';
comment on column public.products.external_product_id is
  'External catalog identifier, e.g. Shopify Admin GraphQL gid://shopify/Product/123456789. NULL for portal-created products.';

-- Existing rows backfill to external_source = 'manual' via column DEFAULT on ADD.
-- Portal INSERTs that omit the column continue to receive 'manual' automatically.

-- Tenant-scoped Shopify product lookup (webhook upsert + admin reconciliation).
create index if not exists idx_products_org_external_product_id
  on public.products (organization_id, external_product_id)
  where external_product_id is not null;

create index if not exists idx_products_external_product_id
  on public.products (external_product_id)
  where external_product_id is not null;

create unique index if not exists uq_products_org_external_product_id
  on public.products (organization_id, external_product_id)
  where external_product_id is not null and organization_id is not null;

create index if not exists idx_products_external_source
  on public.products (external_source);

-- ---------------------------------------------------------------------------
-- 3. PASSPORTS (variant-level passport / traceability records)
-- ---------------------------------------------------------------------------
alter table public.passports
  add column if not exists external_variant_id text,
  add column if not exists material_composition jsonb,
  add column if not exists carbon_footprint numeric;

comment on column public.passports.external_variant_id is
  'External variant identifier, e.g. Shopify gid://shopify/ProductVariant/123456789. NULL for wizard/batch passports without a commerce variant.';
comment on column public.passports.material_composition is
  'Variant-level material allocation map, e.g. {"organic_cotton": 80, "recycled_polyester": 20}. Overrides product-level defaults when present.';
comment on column public.passports.carbon_footprint is
  'Variant-level carbon footprint metric for sustainability transparency (unit defined by application layer).';

-- Primary scan / sync lookup paths: resolve passport by Shopify variant within tenant.
create index if not exists idx_passports_org_external_variant_id
  on public.passports (organization_id, external_variant_id)
  where external_variant_id is not null;

create index if not exists idx_passports_product_external_variant_id
  on public.passports (product_id, external_variant_id)
  where external_variant_id is not null;

create index if not exists idx_passports_external_variant_id
  on public.passports (external_variant_id)
  where external_variant_id is not null;

create unique index if not exists uq_passports_org_external_variant_id
  on public.passports (organization_id, external_variant_id)
  where external_variant_id is not null and organization_id is not null;
