-- Passport translations (cached AI translations) and QR scan analytics events.
-- Accessed via service role from Next.js API routes / route handlers.

create table if not exists passport_translations (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references passports(id) on delete cascade,
  language text not null check (char_length(language) >= 2 and char_length(language) <= 12),
  story text,
  materials jsonb default '[]'::jsonb,
  timeline jsonb default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint uq_passport_translations_passport_lang unique (passport_id, language)
);

create index if not exists idx_passport_translations_passport_id on passport_translations(passport_id);

alter table passport_translations enable row level security;

create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references passports(id) on delete cascade,
  scanned_at timestamptz not null default timezone('utc'::text, now()),
  ip_hash text,
  country text,
  device text
);

create index if not exists idx_scan_events_passport_id on scan_events(passport_id);
create index if not exists idx_scan_events_passport_scanned_at on scan_events(passport_id, scanned_at desc);
create index if not exists idx_scan_events_ip_passport_recent on scan_events(passport_id, ip_hash, scanned_at desc);

alter table scan_events enable row level security;

comment on table passport_translations is 'Cached multilingual passport content (AI translations).';
comment on table scan_events is 'Lightweight QR /scan/{id} funnel events; ip_hash is SHA-256 (salted) for privacy.';
comment on column scan_events.ip_hash is 'HMAC-SHA256 of client IP; no raw IP stored.';
