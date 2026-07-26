-- DPP-03: variant-level GTINs on passports (passport ~= Shopify variant).
-- products.gtin remains the optional catalog/default GTIN.

alter table public.passports
  add column if not exists gtin text;

comment on column public.passports.gtin is
  'Optional GS1 GTIN for this variant/passport. When set, /01/{gtin} resolves with ?variant=external_variant_id.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'passports_gtin_length_check'
  ) then
    alter table public.passports
      add constraint passports_gtin_length_check
      check (gtin is null or (char_length(gtin) <= 14 and gtin ~ '^[0-9]+$'));
  end if;
end $$;

create index if not exists idx_passports_gtin on public.passports (gtin)
  where gtin is not null;

create unique index if not exists uq_passports_organization_gtin
  on public.passports (organization_id, gtin)
  where gtin is not null;
