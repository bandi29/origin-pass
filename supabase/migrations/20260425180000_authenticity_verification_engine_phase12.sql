-- Authenticity & Verification Engine (Phase 1+2) foundation.
-- Extends existing multi-tenant model with rule-driven verification and audit-ready events.

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_verification_status') then
    create type product_verification_status as enum ('unverified', 'verified', 'in_review', 'suspicious', 'high_risk');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_lifecycle_status') then
    create type product_lifecycle_status as enum ('draft', 'validated', 'passport_generated', 'active', 'suspended', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'qr_activation_status') then
    create type qr_activation_status as enum ('pending', 'active', 'revoked', 'compromised');
  end if;
  if not exists (select 1 from pg_type where typname = 'verification_rule_type') then
    create type verification_rule_type as enum (
      'duplicate_scan',
      'impossible_travel',
      'scan_velocity',
      'ownership_break',
      'geo_mismatch',
      'invalid_supplier',
      'missing_documents'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'verification_severity') then
    create type verification_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type document_type as enum ('certificate', 'invoice', 'lab_report', 'eudr_declaration', 'esg_report', 'customs_doc');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_verification_status') then
    create type document_verification_status as enum ('pending', 'verified', 'expired', 'invalid');
  end if;
  if not exists (select 1 from pg_type where typname = 'ownership_actor_type') then
    create type ownership_actor_type as enum ('manufacturer', 'distributor', 'retailer', 'customer');
  end if;
  if not exists (select 1 from pg_type where typname = 'supplier_verification_level') then
    create type supplier_verification_level as enum ('unverified', 'basic', 'enhanced', 'trusted');
  end if;
  if not exists (select 1 from pg_type where typname = 'alert_channel') then
    create type alert_channel as enum ('in_app', 'email');
  end if;
  if not exists (select 1 from pg_type where typname = 'alert_status') then
    create type alert_status as enum ('open', 'acknowledged', 'resolved');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- PRODUCTS EXTENSIONS
-- ---------------------------------------------------------------------------
alter table products add column if not exists verification_status product_verification_status not null default 'unverified';
alter table products add column if not exists risk_score integer not null default 0;
alter table products add column if not exists lifecycle_status product_lifecycle_status not null default 'draft';
alter table products add column if not exists batch_id text;
alter table products add column if not exists serial_number text;
alter table products add column if not exists origin_country text;
alter table products add column if not exists origin_region text;
alter table products add column if not exists manufacturer_name text;
alter table products add column if not exists supplier_id text;
alter table products add column if not exists passport_url text;
alter table products add column if not exists created_by uuid references users(id) on delete set null;
alter table products add column if not exists deleted_at timestamptz;

create index if not exists idx_products_verification_status on products(verification_status);
create index if not exists idx_products_risk_score on products(risk_score);
create index if not exists idx_products_serial_number on products(serial_number) where serial_number is not null;
create index if not exists idx_products_batch_id on products(batch_id) where batch_id is not null;

-- ---------------------------------------------------------------------------
-- PRODUCT MATERIALS
-- ---------------------------------------------------------------------------
create table if not exists product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  material_name text not null,
  composition_percentage numeric(5,2),
  origin_country text,
  supplier_name text,
  certification_reference text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create index if not exists idx_product_materials_product_id on product_materials(product_id);
create index if not exists idx_product_materials_org on product_materials(organization_id);

-- ---------------------------------------------------------------------------
-- PRODUCT DOCUMENTS
-- ---------------------------------------------------------------------------
create table if not exists product_documents (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  document_type document_type not null,
  document_name text not null,
  storage_path text not null,
  hash_checksum text,
  issued_by text,
  issued_at date,
  expires_at date,
  verification_status document_verification_status not null default 'pending',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create index if not exists idx_product_documents_product_id on product_documents(product_id);
create index if not exists idx_product_documents_status on product_documents(verification_status);
create unique index if not exists uq_product_documents_hash on product_documents(hash_checksum)
  where hash_checksum is not null;

-- ---------------------------------------------------------------------------
-- QR IDENTITIES (canonical immutable QR issuance records)
-- ---------------------------------------------------------------------------
create table if not exists qr_identities (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  qr_code text not null,
  qr_token_hash text not null,
  qr_url text not null,
  activation_status qr_activation_status not null default 'pending',
  issued_at timestamptz not null default timezone('utc'::text, now()),
  first_scan_at timestamptz,
  last_scan_at timestamptz,
  total_scans integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists uq_qr_identities_qr_code on qr_identities(qr_code);
create unique index if not exists uq_qr_identities_qr_token_hash on qr_identities(qr_token_hash);
create index if not exists idx_qr_identities_product_id on qr_identities(product_id);
create index if not exists idx_qr_identities_org on qr_identities(organization_id);

alter table products add column if not exists qr_identity_id uuid references qr_identities(id) on delete set null;
create index if not exists idx_products_qr_identity_id on products(qr_identity_id) where qr_identity_id is not null;

-- ---------------------------------------------------------------------------
-- VERIFICATION RULES
-- ---------------------------------------------------------------------------
create table if not exists verification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rule_name text not null,
  rule_type verification_rule_type not null,
  rule_description text,
  threshold_value numeric(12,4),
  score_impact integer not null default 0,
  severity verification_severity not null default 'low',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_verification_rules_org_active on verification_rules(organization_id, is_active);
create unique index if not exists uq_verification_rules_org_type_name on verification_rules(organization_id, rule_type, rule_name);

-- ---------------------------------------------------------------------------
-- VERIFICATION EVENTS (append-only)
-- ---------------------------------------------------------------------------
create table if not exists verification_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  rule_id uuid references verification_rules(id) on delete set null,
  event_type text not null,
  event_message text not null,
  score_change integer not null default 0,
  risk_before integer not null default 0,
  risk_after integer not null default 0,
  triggered_at timestamptz not null default timezone('utc'::text, now()),
  metadata_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_verification_events_product on verification_events(product_id, triggered_at desc);
create index if not exists idx_verification_events_org on verification_events(organization_id, triggered_at desc);
create index if not exists idx_verification_events_rule on verification_events(rule_id);

-- ---------------------------------------------------------------------------
-- SCAN EVENTS (canonical scan telemetry)
-- ---------------------------------------------------------------------------
create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  qr_identity_id uuid references qr_identities(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  scanned_at timestamptz not null default timezone('utc'::text, now()),
  ip_address text,
  device_fingerprint text,
  geo_country text,
  geo_city text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  user_agent text,
  scan_source text,
  metadata_json jsonb not null default '{}'::jsonb
);

-- In some environments scan_events exists from older migrations with a different shape.
-- Ensure required columns exist before adding indexes/policies.
alter table scan_events add column if not exists product_id uuid references products(id) on delete cascade;
alter table scan_events add column if not exists qr_identity_id uuid references qr_identities(id) on delete set null;
alter table scan_events add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table scan_events add column if not exists scanned_at timestamptz not null default timezone('utc'::text, now());
alter table scan_events add column if not exists ip_address text;
alter table scan_events add column if not exists device_fingerprint text;
alter table scan_events add column if not exists geo_country text;
alter table scan_events add column if not exists geo_city text;
alter table scan_events add column if not exists latitude numeric(10,6);
alter table scan_events add column if not exists longitude numeric(10,6);
alter table scan_events add column if not exists user_agent text;
alter table scan_events add column if not exists scan_source text;
alter table scan_events add column if not exists metadata_json jsonb not null default '{}'::jsonb;

create index if not exists idx_scan_events_product_time on scan_events(product_id, scanned_at desc);
create index if not exists idx_scan_events_qr_time on scan_events(qr_identity_id, scanned_at desc);
create index if not exists idx_scan_events_org_time on scan_events(organization_id, scanned_at desc);
create index if not exists idx_scan_events_geo on scan_events(geo_country, geo_city);

-- ---------------------------------------------------------------------------
-- OWNERSHIP CHAIN
-- ---------------------------------------------------------------------------
create table if not exists ownership_chain (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  owner_type ownership_actor_type not null,
  owner_name text,
  owner_id text,
  transfer_from text,
  transfer_to text,
  transferred_at timestamptz not null default timezone('utc'::text, now()),
  verification_signature text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_ownership_chain_product_time on ownership_chain(product_id, transferred_at desc);
create index if not exists idx_ownership_chain_org on ownership_chain(organization_id);

-- ---------------------------------------------------------------------------
-- SUPPLIER TRUST SCORES
-- ---------------------------------------------------------------------------
create table if not exists supplier_trust_scores (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null,
  organization_id uuid references organizations(id) on delete set null,
  trust_score integer not null default 50,
  verification_level supplier_verification_level not null default 'unverified',
  verified_documents_count integer not null default 0,
  flagged_events_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists uq_supplier_trust_scores_org_supplier on supplier_trust_scores(organization_id, supplier_id);
create index if not exists idx_supplier_trust_scores_score on supplier_trust_scores(trust_score);

-- ---------------------------------------------------------------------------
-- ALERT NOTIFICATIONS (in-app + email-ready)
-- ---------------------------------------------------------------------------
create table if not exists alert_notifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  verification_event_id uuid references verification_events(id) on delete set null,
  channel alert_channel not null default 'in_app',
  severity verification_severity not null default 'medium',
  title text not null,
  body text not null,
  status alert_status not null default 'open',
  recipient_user_id uuid references users(id) on delete set null,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_notifications_org_status on alert_notifications(organization_id, status, created_at desc);
create index if not exists idx_alert_notifications_product on alert_notifications(product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ANOMALY FEATURES (AI-ready historical feature store)
-- ---------------------------------------------------------------------------
create table if not exists anomaly_features (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  organization_id uuid references organizations(id) on delete set null,
  feature_window text not null default '15m',
  duplicate_scan_count integer not null default 0,
  distinct_country_count integer not null default 0,
  scan_velocity_per_min numeric(10,2) not null default 0,
  ownership_breaks integer not null default 0,
  document_invalid_count integer not null default 0,
  feature_vector jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_anomaly_features_product_time on anomaly_features(product_id, computed_at desc);
create index if not exists idx_anomaly_features_org on anomaly_features(organization_id, computed_at desc);

-- ---------------------------------------------------------------------------
-- ROLE MODEL (RBAC)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'originpass_role') then
    create type originpass_role as enum ('super_admin', 'tenant_admin', 'compliance_manager', 'supplier', 'viewer');
  end if;
end $$;

alter table users add column if not exists role_v2 originpass_role;
update users set role_v2 = coalesce(role_v2, 'viewer'::originpass_role);
alter table users alter column role_v2 set default 'viewer'::originpass_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table product_materials enable row level security;
alter table product_documents enable row level security;
alter table qr_identities enable row level security;
alter table verification_rules enable row level security;
alter table verification_events enable row level security;
alter table scan_events enable row level security;
alter table ownership_chain enable row level security;
alter table supplier_trust_scores enable row level security;
alter table alert_notifications enable row level security;
alter table anomaly_features enable row level security;

-- shared helper pattern for org-scoped tables.
drop policy if exists "org_select_product_materials" on product_materials;
drop policy if exists "org_write_product_materials" on product_materials;
create policy "org_select_product_materials" on product_materials for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_product_materials" on product_materials for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_product_documents" on product_documents;
drop policy if exists "org_write_product_documents" on product_documents;
create policy "org_select_product_documents" on product_documents for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_product_documents" on product_documents for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_qr_identities" on qr_identities;
drop policy if exists "org_write_qr_identities" on qr_identities;
create policy "org_select_qr_identities" on qr_identities for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_qr_identities" on qr_identities for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_verification_rules" on verification_rules;
drop policy if exists "org_write_verification_rules" on verification_rules;
create policy "org_select_verification_rules" on verification_rules for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_verification_rules" on verification_rules for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_verification_events" on verification_events;
drop policy if exists "org_insert_verification_events" on verification_events;
create policy "org_select_verification_events" on verification_events for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_verification_events" on verification_events for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_scan_events" on scan_events;
drop policy if exists "org_insert_scan_events" on scan_events;
create policy "org_select_scan_events" on scan_events for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_scan_events" on scan_events for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_ownership_chain" on ownership_chain;
drop policy if exists "org_insert_ownership_chain" on ownership_chain;
create policy "org_select_ownership_chain" on ownership_chain for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_ownership_chain" on ownership_chain for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_supplier_trust_scores" on supplier_trust_scores;
drop policy if exists "org_write_supplier_trust_scores" on supplier_trust_scores;
create policy "org_select_supplier_trust_scores" on supplier_trust_scores for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_supplier_trust_scores" on supplier_trust_scores for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_alert_notifications" on alert_notifications;
drop policy if exists "org_write_alert_notifications" on alert_notifications;
create policy "org_select_alert_notifications" on alert_notifications for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_write_alert_notifications" on alert_notifications for all
  using (organization_id = public.originpass_auth_user_organization_id())
  with check (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "org_select_anomaly_features" on anomaly_features;
drop policy if exists "org_insert_anomaly_features" on anomaly_features;
create policy "org_select_anomaly_features" on anomaly_features for select
  using (organization_id = public.originpass_auth_user_organization_id());
create policy "org_insert_anomaly_features" on anomaly_features for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
comment on table verification_events is 'Append-only event log of rule triggers and risk movements.';
comment on table scan_events is 'Canonical scan telemetry stream for fraud analytics and impossible travel detection.';
comment on table anomaly_features is 'AI-ready engineered fraud features by product/time window.';
comment on column products.risk_score is '0-100 dynamic risk score; higher means higher counterfeit risk.';
comment on column products.verification_status is 'Current authenticity verification decision.';

-- helper rpc used by scan pipeline
create or replace function public.increment_qr_scan_counter(
  p_qr_identity_id uuid,
  p_scanned_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update qr_identities
  set
    total_scans = coalesce(total_scans, 0) + 1,
    first_scan_at = coalesce(first_scan_at, p_scanned_at),
    last_scan_at = p_scanned_at,
    activation_status = 'active',
    updated_at = timezone('utc'::text, now())
  where id = p_qr_identity_id;
end;
$$;

revoke all on function public.increment_qr_scan_counter(uuid, timestamptz) from public;
grant execute on function public.increment_qr_scan_counter(uuid, timestamptz) to service_role;

-- Immutable audit log controls
alter table audit_logs enable row level security;
drop policy if exists "audit_logs_select_org" on audit_logs;
drop policy if exists "audit_logs_insert_org" on audit_logs;
create policy "audit_logs_select_org" on audit_logs for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from users u
      where u.id = auth.uid()
        and u.organization_id = public.originpass_auth_user_organization_id()
    )
  );
create policy "audit_logs_insert_org" on audit_logs for insert
  with check (true);
