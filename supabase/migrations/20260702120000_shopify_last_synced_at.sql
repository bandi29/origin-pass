-- Catalog sync freshness: shown in the embedded admin next to the Sync button
-- ("Last synced 2 hours ago"). Set by the sync engine whenever a run commits data.
alter table public.organizations
  add column if not exists shopify_last_synced_at timestamptz;

comment on column public.organizations.shopify_last_synced_at is
  'When the Shopify catalog sync last committed data for this store (full or capped run).';
