-- Immutable passport verification compliance history + current status snapshot.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'passport_verification_compliance_status') then
    create type passport_verification_compliance_status as enum (
      'verified',
      'suspended',
      'failed_audit'
    );
  end if;
end $$;

alter table public.passports
  add column if not exists verification_compliance_status passport_verification_compliance_status
  not null default 'verified';

comment on column public.passports.verification_compliance_status is
  'Latest compliance decision for passport verification tab (verified | suspended | failed_audit).';

create table if not exists public.passport_verification_history (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid not null references public.passports(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  event_type text not null check (event_type in ('system_compliance_check', 'manual_override')),
  determined_status passport_verification_compliance_status not null,
  performed_by_user_id uuid references public.users(id) on delete set null,
  performed_by_label text not null default 'System Engine AI Agent',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_passport_verification_history_passport_created
  on public.passport_verification_history (passport_id, created_at desc);

create index if not exists idx_passport_verification_history_org_created
  on public.passport_verification_history (organization_id, created_at desc)
  where organization_id is not null;

alter table public.passport_verification_history enable row level security;

drop policy if exists "passport_verification_history_select_org" on public.passport_verification_history;
drop policy if exists "passport_verification_history_insert_org" on public.passport_verification_history;

create policy "passport_verification_history_select_org" on public.passport_verification_history
  for select using (
    passport_id in (
      select p.id
      from public.passports p
      left join public.products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) in (
        select organization_id from public.users where id = auth.uid()
      )
      or pr.brand_id = auth.uid()
    )
  );

create policy "passport_verification_history_insert_org" on public.passport_verification_history
  for insert with check (
    passport_id in (
      select p.id
      from public.passports p
      left join public.products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) in (
        select organization_id from public.users where id = auth.uid()
      )
      or pr.brand_id = auth.uid()
    )
  );

comment on table public.passport_verification_history is
  'Append-only verification compliance audit trail scoped to a passport asset.';
