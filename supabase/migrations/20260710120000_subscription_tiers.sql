-- 3-tier subscription architecture: Boutique Free / Grower $29 / Enterprise $79.
-- Tier is updated by the app_subscriptions/update webhook after merchant approval.
alter table public.organizations
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'grower', 'enterprise')),
  add column if not exists shopify_subscription_id text;

comment on column public.organizations.subscription_tier is
  'Billing tier: free (15 products, no evidence uploads) | grower (500 products, evidence) | enterprise (unlimited + Bulk Operations).';
comment on column public.organizations.shopify_subscription_id is
  'Admin GraphQL AppSubscription GID of the active recurring charge, for reconciliation.';
