-- Shopify app sync creates organization-scoped products without a portal profile (brand_id).
-- Legacy portal rows keep brand_id; Shopify rows use organization_id instead.

alter table public.products
  alter column brand_id drop not null;

comment on column public.products.brand_id is
  'Legacy portal owner (profiles.id). NULL for Shopify-synced catalog rows keyed by organization_id.';
