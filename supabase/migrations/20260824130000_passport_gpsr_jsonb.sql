-- GPSR (EU General Product Safety Regulation) structured fields on passports.
-- Shape matches Zod `gpsrSchema` in passport-wizard-schemas.ts.

alter table public.passports
  add column if not exists gpsr jsonb not null default '{}'::jsonb;

comment on column public.passports.gpsr is
  'EU GPSR compliance payload: euResponsiblePerson, safetyInformation[], productIdentifiers { gtin, hsCode, batchNumber }.';

create index if not exists idx_passports_gpsr_gin
  on public.passports using gin (gpsr);
