-- Explicitly revoke anon/authenticated EXECUTE on privileged RPCs.
-- REVOKE FROM PUBLIC alone does not always remove role-specific grants in Supabase.

-- Admin-only RPCs (server uses service_role via createAdminClient)
revoke all on function public.compute_scan_fraud_signals(uuid, text) from anon, authenticated, public;
grant execute on function public.compute_scan_fraud_signals(uuid, text) to service_role;

revoke all on function public.detach_partitions_older_than(text, integer) from anon, authenticated, public;
grant execute on function public.detach_partitions_older_than(text, integer) to service_role;

revoke all on function public.ensure_month_partition(text, text, integer, integer) from anon, authenticated, public;
grant execute on function public.ensure_month_partition(text, text, integer, integer) to service_role;

revoke all on function public.get_share_click_counts(uuid) from anon, authenticated, public;
grant execute on function public.get_share_click_counts(uuid) to service_role;

revoke all on function public.increment_qr_scan_counter(uuid, timestamptz) from anon, authenticated, public;
grant execute on function public.increment_qr_scan_counter(uuid, timestamptz) to service_role;

revoke all on function public.increment_share_event_clicks(uuid) from anon, authenticated, public;
grant execute on function public.increment_share_event_clicks(uuid) to service_role;

revoke all on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) from anon, authenticated, public;
grant execute on function public.merge_products_import_batch(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.roll_forward_partitions(text, text) from anon, authenticated, public;
grant execute on function public.roll_forward_partitions(text, text) to service_role;

revoke all on function public.scan_analytics_for_passport(uuid) from anon, authenticated, public;
grant execute on function public.scan_analytics_for_passport(uuid) to service_role;

revoke all on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz) from anon, authenticated, public;
grant execute on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz) to service_role;

-- RLS helper: authenticated + service_role only (used inside policies, not public RPC)
revoke all on function public.originpass_auth_user_organization_id() from anon, authenticated, public;
grant execute on function public.originpass_auth_user_organization_id() to authenticated, service_role;
