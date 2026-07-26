-- GS1 Digital Link identifiers (optional, non-breaking).
-- Existing rows keep NULL; internal /p and /sp routes are unchanged.

alter table public.products
  add column if not exists gtin text,
  add column if not exists gln text,
  add column if not exists default_lot_number text;

comment on column public.products.gtin is
  'GS1 GTIN (8/12/13/14 digits). Optional; when set, QR labels may encode /01/{gtin} Digital Links.';
comment on column public.products.gln is
  'Optional GS1 Global Location Number (max 13 digits) associated with this product.';
comment on column public.products.default_lot_number is
  'Optional default batch/lot (AI 10) for GS1 Digital Link QR encoding.';

-- Length guards (NULL-safe). CHECK is not applied to existing NULL rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_gtin_length_check'
  ) then
    alter table public.products
      add constraint products_gtin_length_check
      check (gtin is null or (char_length(gtin) <= 14 and gtin ~ '^[0-9]+$'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'products_gln_length_check'
  ) then
    alter table public.products
      add constraint products_gln_length_check
      check (gln is null or (char_length(gln) <= 13 and gln ~ '^[0-9]+$'));
  end if;
end $$;

create index if not exists idx_products_gtin on public.products (gtin)
  where gtin is not null;

-- One GTIN per organization when set (allows shared NULL across catalog).
create unique index if not exists uq_products_organization_gtin
  on public.products (organization_id, gtin)
  where gtin is not null;
