-- Remap Boutique Free / Grower / Enterprise → Starter Free / Pro / Scale.
-- Handles: free | pro-plan | scale-plan (Shopify App Pricing / Billing).

alter table public.organizations
  drop constraint if exists organizations_subscription_tier_check;

update public.organizations
set subscription_tier = 'pro-plan'
where subscription_tier in ('grower', 'pro');

update public.organizations
set subscription_tier = 'scale-plan'
where subscription_tier in ('enterprise', 'scale');

update public.organizations
set subscription_tier = 'free'
where subscription_tier is null
   or subscription_tier not in ('free', 'pro-plan', 'scale-plan');

alter table public.organizations
  alter column subscription_tier set default 'free';

alter table public.organizations
  add constraint organizations_subscription_tier_check
  check (subscription_tier in ('free', 'pro-plan', 'scale-plan'));

comment on column public.organizations.subscription_tier is
  'Billing handle: free (10 passports, EN only, no PDF) | pro-plan (250 + EU translate + PDF + Avery/Thermal) | scale-plan (unlimited + bulk CSV + badge customization).';
