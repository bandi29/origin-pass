-- Brand default + optional per-product override for public passport page theming.

alter table public.profiles
  add column if not exists passport_template_key text not null default 'classic';

comment on column public.profiles.passport_template_key is
  'Public scan page theme: classic | luxury. Brand default when product has no override.';

alter table public.products
  add column if not exists passport_template_key text;

comment on column public.products.passport_template_key is
  'Optional override for public passport theme; falls back to profiles.passport_template_key.';

-- Allow authenticated users to update their display template preference alongside brand_name.
grant update (brand_name, passport_template_key) on public.profiles to authenticated;
