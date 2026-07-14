-- Shopify App Store compliance: install lifecycle + GDPR shop/redact tracking.
-- Standalone portal tenants (shop_domain IS NULL) keep default shopify_install_status = 'active'.

alter table public.organizations
  add column if not exists shopify_shop_id bigint,
  add column if not exists shopify_install_status text not null default 'active',
  add column if not exists shopify_uninstalled_at timestamptz,
  add column if not exists shopify_redacted_at timestamptz;

comment on column public.organizations.shopify_shop_id is
  'Numeric Shopify shop id from OAuth / GDPR webhooks. NULL for standalone portal tenants.';
comment on column public.organizations.shopify_install_status is
  'Shopify install lifecycle: active | uninstalled | redacted. Meaningful when shop_domain is set.';
comment on column public.organizations.shopify_uninstalled_at is
  'Timestamp of the most recent app/uninstalled webhook (token revoked at same time).';
comment on column public.organizations.shopify_redacted_at is
  'Timestamp shop/redact GDPR webhook completed final data purge.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_shopify_install_status_check'
  ) then
    alter table public.organizations
      add constraint organizations_shopify_install_status_check
      check (shopify_install_status in ('active', 'uninstalled', 'redacted'));
  end if;
end$$;

create index if not exists idx_organizations_shopify_shop_id
  on public.organizations (shopify_shop_id)
  where shopify_shop_id is not null;

create index if not exists idx_organizations_shopify_install_status
  on public.organizations (shopify_install_status)
  where shop_domain is not null;
