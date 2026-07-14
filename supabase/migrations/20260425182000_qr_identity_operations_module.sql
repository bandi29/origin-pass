-- QR Identity Operations module: lifecycle logs, analytics events, batch jobs and secure export traces.

create table if not exists qr_scan_events (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid references qr_identities(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  scanned_at timestamptz not null default timezone('utc'::text, now()),
  ip_address text,
  device_fingerprint text,
  geo_country text,
  geo_city text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  user_agent text,
  risk_score integer,
  anomaly_score numeric(5,2),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists qr_activation_logs (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid references qr_identities(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  previous_status qr_activation_status,
  next_status qr_activation_status not null,
  reason text,
  changed_at timestamptz not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists qr_security_events (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid references qr_identities(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  event_type text not null,
  severity verification_severity not null default 'medium',
  confidence numeric(5,2),
  risk_delta integer not null default 0,
  details text,
  detected_at timestamptz not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists qr_batch_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  job_name text,
  input_count integer not null default 0,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists qr_label_exports (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid references qr_identities(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  exported_by uuid references users(id) on delete set null,
  export_format text not null,
  label_template text,
  secure_link text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  exported_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists qr_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  qr_identity_id uuid references qr_identities(id) on delete cascade not null,
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  anomaly_type text not null,
  severity verification_severity not null default 'medium',
  score integer not null default 0,
  occurred_at timestamptz not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_qr_scan_events_qr_time on qr_scan_events(qr_identity_id, scanned_at desc);
create index if not exists idx_qr_scan_events_product_time on qr_scan_events(product_id, scanned_at desc);
create index if not exists idx_qr_scan_events_geo on qr_scan_events(geo_country, geo_city);
create index if not exists idx_qr_activation_logs_qr_time on qr_activation_logs(qr_identity_id, changed_at desc);
create index if not exists idx_qr_security_events_qr_time on qr_security_events(qr_identity_id, detected_at desc);
create index if not exists idx_qr_batch_jobs_org_time on qr_batch_jobs(organization_id, created_at desc);
create index if not exists idx_qr_label_exports_org_time on qr_label_exports(organization_id, exported_at desc);
create index if not exists idx_qr_anomaly_events_qr_time on qr_anomaly_events(qr_identity_id, occurred_at desc);

alter table qr_scan_events enable row level security;
alter table qr_activation_logs enable row level security;
alter table qr_security_events enable row level security;
alter table qr_batch_jobs enable row level security;
alter table qr_label_exports enable row level security;
alter table qr_anomaly_events enable row level security;

drop policy if exists "org_select_qr_scan_events" on qr_scan_events;
drop policy if exists "org_insert_qr_scan_events" on qr_scan_events;
create policy "org_select_qr_scan_events" on qr_scan_events for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_qr_scan_events" on qr_scan_events for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_activation_logs" on qr_activation_logs;
drop policy if exists "org_insert_qr_activation_logs" on qr_activation_logs;
create policy "org_select_qr_activation_logs" on qr_activation_logs for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_qr_activation_logs" on qr_activation_logs for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_security_events" on qr_security_events;
drop policy if exists "org_insert_qr_security_events" on qr_security_events;
create policy "org_select_qr_security_events" on qr_security_events for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_qr_security_events" on qr_security_events for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_batch_jobs" on qr_batch_jobs;
drop policy if exists "org_write_qr_batch_jobs" on qr_batch_jobs;
create policy "org_select_qr_batch_jobs" on qr_batch_jobs for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_qr_batch_jobs" on qr_batch_jobs for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_label_exports" on qr_label_exports;
drop policy if exists "org_insert_qr_label_exports" on qr_label_exports;
create policy "org_select_qr_label_exports" on qr_label_exports for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_qr_label_exports" on qr_label_exports for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_anomaly_events" on qr_anomaly_events;
drop policy if exists "org_insert_qr_anomaly_events" on qr_anomaly_events;
create policy "org_select_qr_anomaly_events" on qr_anomaly_events for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_qr_anomaly_events" on qr_anomaly_events for insert
  with check (organization_id = public.originpass_auth_user_organization_id());
