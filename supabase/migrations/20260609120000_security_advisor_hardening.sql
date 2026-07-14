-- Security Advisor hardening:
-- 1) Enable RLS on team_role_templates (was fully exposed to anon/authenticated).
-- 2) Retire public PostgREST views that relied on SECURITY DEFINER.
-- 3) Add missing RLS policies on tables that had RLS enabled but no policies.
-- 4) Restrict SECURITY DEFINER RPC execution to service_role where app uses admin client.
-- 5) Tighten audit_logs inserts to service role only.

-- ---------------------------------------------------------------------------
-- team_role_templates: global read-only catalog (mirrors team_permissions)
-- ---------------------------------------------------------------------------
alter table public.team_role_templates enable row level security;

drop policy if exists "team_role_templates_select_authenticated" on public.team_role_templates;
create policy "team_role_templates_select_authenticated"
  on public.team_role_templates
  for select
  to authenticated
  using (true);

revoke all on table public.team_role_templates from anon;
revoke insert, update, delete, truncate, references, trigger on public.team_role_templates from authenticated;
grant select on public.team_role_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Remove SECURITY DEFINER views from the public API surface
-- (public verify now uses server-side service role queries)
-- ---------------------------------------------------------------------------
drop view if exists public.public_item_scan;
drop view if exists public.verification_logs;

-- ---------------------------------------------------------------------------
-- RLS policies for tables that previously had RLS enabled but zero policies
-- ---------------------------------------------------------------------------
drop policy if exists "verifications_select_org" on public.verifications;
create policy "verifications_select_org"
  on public.verifications
  for select
  to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "api_keys_select_org" on public.api_keys;
create policy "api_keys_select_org"
  on public.api_keys
  for select
  to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

drop policy if exists "passport_translations_select_org" on public.passport_translations;
create policy "passport_translations_select_org"
  on public.passport_translations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.passports p
      where p.id = passport_translations.passport_id
        and p.organization_id = public.originpass_auth_user_organization_id()
    )
  );

drop policy if exists "share_events_select_org" on public.share_events;
create policy "share_events_select_org"
  on public.share_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.passports p
      where p.id = share_events.passport_id
        and p.organization_id = public.originpass_auth_user_organization_id()
    )
  );

drop policy if exists "share_clicks_select_org" on public.share_clicks;
create policy "share_clicks_select_org"
  on public.share_clicks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.passports p
      where p.id = share_clicks.passport_id
        and p.organization_id = public.originpass_auth_user_organization_id()
    )
  );

revoke all on table public.verifications from anon;
revoke all on table public.api_keys from anon;
revoke insert, update, delete, truncate, references, trigger on public.verifications from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.api_keys from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.passport_translations from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.share_events from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.share_clicks from authenticated;

grant select on public.verifications to authenticated;
grant select on public.api_keys to authenticated;
grant select on public.passport_translations to authenticated;
grant select on public.share_events to authenticated;
grant select on public.share_clicks to authenticated;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only via trusted server (service role), not open client insert
-- ---------------------------------------------------------------------------
drop policy if exists "audit_logs_insert_org" on public.audit_logs;

-- ---------------------------------------------------------------------------
-- Restrict SECURITY DEFINER RPCs to service_role (app uses createAdminClient)
-- ---------------------------------------------------------------------------
revoke all on function public.compute_scan_fraud_signals(uuid, text) from public;
grant execute on function public.compute_scan_fraud_signals(uuid, text) to service_role;

revoke all on function public.detach_partitions_older_than(text, integer) from public;
grant execute on function public.detach_partitions_older_than(text, integer) to service_role;

revoke all on function public.ensure_month_partition(text, text, integer, integer) from public;
grant execute on function public.ensure_month_partition(text, text, integer, integer) to service_role;

revoke all on function public.get_share_click_counts(uuid) from public;
grant execute on function public.get_share_click_counts(uuid) to service_role;

revoke all on function public.increment_qr_scan_counter(uuid, timestamptz) from public;
grant execute on function public.increment_qr_scan_counter(uuid, timestamptz) to service_role;

revoke all on function public.increment_share_event_clicks(uuid) from public;
grant execute on function public.increment_share_event_clicks(uuid) to service_role;

revoke all on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.originpass_auth_user_organization_id() from public;
grant execute on function public.originpass_auth_user_organization_id() to authenticated, service_role;

revoke all on function public.roll_forward_partitions(text, text) from public;
grant execute on function public.roll_forward_partitions(text, text) to service_role;

revoke all on function public.scan_analytics_for_passport(uuid) from public;
grant execute on function public.scan_analytics_for_passport(uuid) to service_role;

revoke all on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz) from public;
grant execute on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz) to service_role;
