-- Fraud Detection & Investigation Center: persisted alerts, evidence, audit trail.
-- Status/priority names are scoped with counterfeit_* to avoid collision with alert_status (verification subsystem).

-- ---------------------------------------------------------------------------
-- Extend app roles (PG15+)
-- ---------------------------------------------------------------------------
alter type originpass_role add value if not exists 'fraud_analyst';

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'counterfeit_alert_status') then
    create type counterfeit_alert_status as enum (
      'new',
      'investigating',
      'pending_evidence',
      'escalated',
      'confirmed_fraud',
      'false_positive',
      'resolved',
      'archived'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'counterfeit_alert_priority') then
    create type counterfeit_alert_priority as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'counterfeit_alert_severity') then
    create type counterfeit_alert_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'counterfeit_issue_type') then
    create type counterfeit_issue_type as enum (
      'location_mismatch',
      'impossible_travel',
      'duplicate_scans',
      'qr_cloning',
      'velocity_anomaly',
      'ownership_mismatch',
      'geo_restriction_violation',
      'suspicious_device_reuse',
      'expired_passport_usage',
      'invalid_supplier_activity',
      'compliance_document_mismatch',
      'invalid_qr'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'counterfeit_resolution_type') then
    create type counterfeit_resolution_type as enum (
      'legitimate_activity',
      'customer_travel',
      'logistics_explanation',
      'counterfeit_confirmed',
      'duplicate_packaging_issue',
      'testing_activity',
      'supplier_verification_completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'counterfeit_trigger_source') then
    create type counterfeit_trigger_source as enum (
      'passport_scan',
      'ownership_event',
      'qr_validation',
      'supplier_verification',
      'compliance_validation',
      'manual',
      'verification_engine'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- MAIN ALERTS
-- ---------------------------------------------------------------------------
create table if not exists counterfeit_alerts (
  id uuid primary key default gen_random_uuid(),
  investigation_ref text not null default ('INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  brand_id uuid not null references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  product_id uuid not null references products(id) on delete cascade,
  passport_id uuid references passports(id) on delete set null,
  passport_scan_id uuid references passport_scans(id) on delete set null,
  qr_identity_id uuid references qr_identities(id) on delete set null,
  issue_type counterfeit_issue_type not null,
  severity counterfeit_alert_severity not null default 'medium',
  priority counterfeit_alert_priority not null default 'medium',
  status counterfeit_alert_status not null default 'new',
  confidence_score integer not null default 0
    check (confidence_score >= 0 and confidence_score <= 100),
  verification_confidence integer
    check (verification_confidence is null or (verification_confidence >= 0 and verification_confidence <= 100)),
  risk_score_snapshot integer not null default 0
    check (risk_score_snapshot >= 0 and risk_score_snapshot <= 100),
  trigger_source counterfeit_trigger_source not null default 'passport_scan',
  source_rule_id uuid references verification_rules(id) on delete set null,
  region text,
  scan_count integer not null default 0,
  last_scan_at timestamptz,
  assigned_to uuid references users(id) on delete set null,
  assigned_team text,
  sla_due_at timestamptz,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  event_metadata jsonb not null default '{}'::jsonb,
  investigation_notes text,
  resolution_type counterfeit_resolution_type,
  resolution_notes text,
  resolution_actions jsonb,
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists uq_counterfeit_alerts_passport_scan
  on counterfeit_alerts(passport_scan_id)
  where passport_scan_id is not null;

create index if not exists idx_counterfeit_alerts_brand_status
  on counterfeit_alerts(brand_id, status, created_at desc);
create index if not exists idx_counterfeit_alerts_org_status
  on counterfeit_alerts(organization_id, status, created_at desc)
  where organization_id is not null;
create index if not exists idx_counterfeit_alerts_product
  on counterfeit_alerts(product_id, created_at desc);
create index if not exists idx_counterfeit_alerts_assigned
  on counterfeit_alerts(assigned_to)
  where assigned_to is not null;
create index if not exists idx_counterfeit_alerts_sla
  on counterfeit_alerts(sla_due_at)
  where sla_due_at is not null and status not in ('resolved', 'archived', 'false_positive');

-- ---------------------------------------------------------------------------
-- FRAUD INVESTIGATIONS (1:1 case file; extensible)
-- ---------------------------------------------------------------------------
create table if not exists fraud_investigations (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  case_label text,
  opened_at timestamptz not null default timezone('utc'::text, now()),
  closed_at timestamptz,
  escalation_target text,
  metadata jsonb not null default '{}'::jsonb,
  unique (alert_id)
);

create index if not exists idx_fraud_investigations_opened on fraud_investigations(opened_at desc);

-- ---------------------------------------------------------------------------
-- EVIDENCE, COMMENTS, RESOLUTION LOG, ASSIGNMENTS, STATUS HISTORY
-- ---------------------------------------------------------------------------
create table if not exists alert_evidence (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  evidence_type text not null,
  payload jsonb not null default '{}'::jsonb,
  source text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_evidence_alert on alert_evidence(alert_id, created_at desc);

create table if not exists alert_comments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  attachments jsonb,
  is_internal boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_comments_alert on alert_comments(alert_id, created_at desc);

create table if not exists alert_resolution_logs (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  resolution_type counterfeit_resolution_type not null,
  notes text,
  actor_id uuid references users(id) on delete set null,
  attachments jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_resolution_logs_alert on alert_resolution_logs(alert_id, created_at desc);

create table if not exists alert_assignments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  assignee_id uuid references users(id) on delete set null,
  team text,
  sla_due_at timestamptz,
  assigned_by uuid references users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_assignments_alert on alert_assignments(alert_id, created_at desc);

create table if not exists alert_status_history (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references counterfeit_alerts(id) on delete cascade,
  from_status counterfeit_alert_status,
  to_status counterfeit_alert_status not null,
  actor_id uuid references users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_alert_status_history_alert on alert_status_history(alert_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at touch
-- ---------------------------------------------------------------------------
create or replace function public.touch_counterfeit_alert_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists trg_counterfeit_alerts_updated on counterfeit_alerts;
create trigger trg_counterfeit_alerts_updated
  before update on counterfeit_alerts
  for each row execute function public.touch_counterfeit_alert_updated_at();

-- ---------------------------------------------------------------------------
-- RLS (tenant + legacy brand owner)
-- ---------------------------------------------------------------------------
alter table counterfeit_alerts enable row level security;
alter table fraud_investigations enable row level security;
alter table alert_evidence enable row level security;
alter table alert_comments enable row level security;
alter table alert_resolution_logs enable row level security;
alter table alert_assignments enable row level security;
alter table alert_status_history enable row level security;

drop policy if exists "counterfeit_alerts_select" on counterfeit_alerts;
drop policy if exists "counterfeit_alerts_insert" on counterfeit_alerts;
drop policy if exists "counterfeit_alerts_update" on counterfeit_alerts;

create policy "counterfeit_alerts_select" on counterfeit_alerts for select
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

create policy "counterfeit_alerts_insert" on counterfeit_alerts for insert
  with check (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

create policy "counterfeit_alerts_update" on counterfeit_alerts for update
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

-- Child tables: scope via parent alert
drop policy if exists "fraud_investigations_select" on fraud_investigations;
drop policy if exists "fraud_investigations_all" on fraud_investigations;
create policy "fraud_investigations_select" on fraud_investigations for select
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = fraud_investigations.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );
create policy "fraud_investigations_all" on fraud_investigations for all
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = fraud_investigations.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = fraud_investigations.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

drop policy if exists "alert_evidence_all" on alert_evidence;
create policy "alert_evidence_all" on alert_evidence for all
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_evidence.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_evidence.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

drop policy if exists "alert_comments_all" on alert_comments;
create policy "alert_comments_all" on alert_comments for all
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_comments.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_comments.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

drop policy if exists "alert_resolution_logs_select" on alert_resolution_logs;
create policy "alert_resolution_logs_select" on alert_resolution_logs for select
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_resolution_logs.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

drop policy if exists "alert_assignments_select" on alert_assignments;
create policy "alert_assignments_select" on alert_assignments for select
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_assignments.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

drop policy if exists "alert_status_history_select" on alert_status_history;
create policy "alert_status_history_select" on alert_status_history for select
  using (
    exists (
      select 1 from counterfeit_alerts ca
      where ca.id = alert_status_history.alert_id
        and (
          ca.organization_id = public.originpass_auth_user_organization_id()
          or ca.brand_id = auth.uid()
        )
    )
  );

comment on table counterfeit_alerts is 'Enterprise fraud/counterfeit alerts with full investigation lifecycle; never auto-resolved by the engine.';
comment on table fraud_investigations is 'Optional 1:1 case record linked to a counterfeit alert.';
comment on table alert_status_history is 'Audit trail of alert status transitions.';
