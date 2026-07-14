-- Shopify now rejects legacy non-expiring Admin API tokens. Offline tokens are
-- issued as expiring (access_token + expires_in + refresh_token); we persist the
-- refresh material and rotate server-side before expiry.
alter table public.organizations
  add column if not exists shopify_refresh_token text,
  add column if not exists shopify_token_expires_at timestamptz;

comment on column public.organizations.shopify_refresh_token is
  'OAuth refresh token for expiring offline Admin tokens; rotated on every refresh.';
comment on column public.organizations.shopify_token_expires_at is
  'Expiry of the current shopify_access_token; refreshed ~2 minutes before this.';
