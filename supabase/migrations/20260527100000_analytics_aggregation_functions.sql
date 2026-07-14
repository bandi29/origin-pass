-- SQL aggregation helpers for analytics paths.
--
-- These replace Node-side bucketing of up to 50k–100k raw rows per dashboard view
-- with single-row-per-day aggregates computed inside Postgres. Each function is
-- STABLE + parallel-safe so the planner can use parallel index scans on partitioned
-- tables.

-- 1) Per-day scan count for an organization, optionally bounded by a window.
create or replace function public.scans_per_day_for_org(
  p_organization_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (day date, scans bigint)
language sql
stable
parallel safe
security definer
set search_path = public
as $$
  select date_trunc('day', scan_timestamp)::date as day,
         count(*)::bigint                         as scans
    from public.passport_scans
   where organization_id = p_organization_id
     and scan_timestamp >= p_start
     and scan_timestamp <= p_end
   group by 1
   order by 1;
$$;

revoke all on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz) from public;
grant execute on function public.scans_per_day_for_org(uuid, timestamptz, timestamptz)
  to authenticated, service_role;

-- 2) Per-passport scan summary used by the public verify response and the per-passport
--    detail dashboard. Returns total scans, unique IPs, and per-day buckets — all in
--    one round-trip. Replaces selecting 50k raw rows just to bucket by day in Node.
create or replace function public.scan_analytics_for_passport(p_passport_id uuid)
returns table (
  total_scans bigint,
  unique_ips bigint,
  daily_scans jsonb
)
language sql
stable
parallel safe
security definer
set search_path = public
as $$
  with totals as (
    select count(*)::bigint                              as total_scans,
           count(distinct ip_hash)::bigint               as unique_ips
      from public.scan_events
     where passport_id = p_passport_id
  ),
  daily as (
    select date_trunc('day', scanned_at)::date as day,
           count(*)::bigint                    as cnt
      from public.scan_events
     where passport_id = p_passport_id
     group by 1
     order by 1
  )
  select totals.total_scans,
         totals.unique_ips,
         coalesce(
           (select jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'count', cnt))
              from daily),
           '[]'::jsonb
         ) as daily_scans
    from totals;
$$;

revoke all on function public.scan_analytics_for_passport(uuid) from public;
grant execute on function public.scan_analytics_for_passport(uuid)
  to authenticated, service_role, anon;
