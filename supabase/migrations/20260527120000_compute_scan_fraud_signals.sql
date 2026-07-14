-- Consolidate the 5 sequential fraud-detection counters into one round-trip.
--
-- Replaces:
--   countRecentScans            (15 min window)
--   countRecentScansByIp        (15 min window, same IP)
--   countDistinctCountriesLastHour
--   getTotalScanCount
--   countScansLastMinute
--
-- All five queries hit passport_scans with different windows/filters. They are
-- index-friendly on (passport_id, scan_timestamp) but at scale each round-trip is
-- ~10 ms p50 / ~80 ms p95 to Supabase. Collapsing into one call saves 4× the
-- network cost and lets the planner use a single index scan over the relevant
-- time range.

create or replace function public.compute_scan_fraud_signals(
  p_passport_id uuid,
  p_ip_address text default null
)
returns table (
  recent_scans            bigint,
  same_ip_recent_scans    bigint,
  distinct_countries_hour bigint,
  total_scan_count        bigint,
  scans_last_minute       bigint
)
language sql
stable
parallel safe
security definer
set search_path = public
as $$
  with
    -- Single one-hour window scan: counters with shorter windows are derived from this.
    last_hour as (
      select scan_timestamp, ip_address, location_country
        from public.passport_scans
       where passport_id = p_passport_id
         and scan_timestamp >= now() - interval '1 hour'
    ),
    -- Total scan count (all time). Uses the dedicated idx_passport_scans_passport_id.
    totals as (
      select count(*)::bigint as total_scan_count
        from public.passport_scans
       where passport_id = p_passport_id
    )
  select
    (select count(*)::bigint
       from last_hour
      where scan_timestamp >= now() - interval '15 minutes')              as recent_scans,
    (select count(*)::bigint
       from last_hour
      where scan_timestamp >= now() - interval '15 minutes'
        and p_ip_address is not null
        and ip_address = p_ip_address)                                    as same_ip_recent_scans,
    (select count(distinct upper(coalesce(location_country, '')))::bigint
       from last_hour
      where location_country is not null
        and location_country <> '')                                       as distinct_countries_hour,
    (select total_scan_count from totals)                                 as total_scan_count,
    (select count(*)::bigint
       from last_hour
      where scan_timestamp >= now() - interval '1 minute')                as scans_last_minute;
$$;

revoke all on function public.compute_scan_fraud_signals(uuid, text) from public;
grant execute on function public.compute_scan_fraud_signals(uuid, text)
  to authenticated, service_role, anon;
