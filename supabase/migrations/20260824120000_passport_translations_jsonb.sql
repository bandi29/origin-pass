-- EU DPP multi-language passport copy (merchant + Google Translate cache).
-- Shape: { "fr": { materials, origin, care, sustainability }, "de": {...}, ..., "_meta": { "sourceHash": "..." } }

alter table public.passports
  add column if not exists translations jsonb not null default '{}'::jsonb;

comment on column public.passports.translations is
  'Cached EU-language DPP fields (fr/de/es/it). Keys: materials, origin, care, sustainability. _meta.sourceHash invalidates stale rows when EN source changes.';

create index if not exists idx_passports_translations_gin
  on public.passports using gin (translations);
