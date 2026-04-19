-- Share tracking: tracked links /s/{passportId}?sid=&ch= → redirect to /p/{id}

create table if not exists share_events (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references passports(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'direct')),
  clicks int not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_share_events_passport_id on share_events(passport_id);
create index if not exists idx_share_events_passport_channel on share_events(passport_id, channel);

create table if not exists share_clicks (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references share_events(id) on delete cascade,
  passport_id uuid not null references passports(id) on delete cascade,
  clicked_at timestamptz not null default timezone('utc'::text, now()),
  ip_hash text,
  user_agent text
);

create index if not exists idx_share_clicks_passport_id on share_clicks(passport_id);
create index if not exists idx_share_clicks_share_id on share_clicks(share_id);

alter table share_events enable row level security;
alter table share_clicks enable row level security;

comment on table share_events is 'Tracked share links per channel; clicks denormalized counter + share_clicks detail.';
comment on table share_clicks is 'One row per visit via /s/?sid= link; ip stored as hash only.';
