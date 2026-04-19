-- Backfill legacy data into scalable core tables.
-- Safe to re-run (idempotent).

-- 1) Backfill passports from legacy items + batches.
insert into passports (passport_uid, product_id, serial_number, status, created_at)
select
  i.serial_id as passport_uid,
  b.product_id,
  i.serial_id as serial_number,
  'active'::passport_status as status,
  coalesce(i.created_at, timezone('utc'::text, now())) as created_at
from items i
join batches b on b.id = i.batch_id
where b.product_id is not null
on conflict (serial_number) do nothing;

-- 2) Backfill scan history when legacy scan_events table exists.
-- Some deployments only have usage_logs and cannot map scans to specific passports.
do $$
begin
  if to_regclass('public.scan_events') is not null then
    insert into passport_scans (
      passport_id,
      scan_timestamp,
      device_type,
      ip_address,
      scan_result,
      created_at
    )
    select
      coalesce(
        (to_jsonb(se)->>'passport_id')::uuid,
        (to_jsonb(se)->>'passportId')::uuid
      ),
      coalesce(
        (to_jsonb(se)->>'scanned_at')::timestamptz,
        (to_jsonb(se)->>'scannedAt')::timestamptz,
        timezone('utc'::text, now())
      ),
      coalesce(to_jsonb(se)->>'user_agent', to_jsonb(se)->>'userAgent'),
      coalesce(to_jsonb(se)->>'ip_address', to_jsonb(se)->>'ipAddress'),
      'valid'::passport_scan_result,
      coalesce(
        (to_jsonb(se)->>'scanned_at')::timestamptz,
        (to_jsonb(se)->>'scannedAt')::timestamptz,
        timezone('utc'::text, now())
      )
    from scan_events se
    where exists (
      select 1
      from passports p
      where p.id = coalesce(
        (to_jsonb(se)->>'passport_id')::uuid,
        (to_jsonb(se)->>'passportId')::uuid
      )
    )
      and not exists (
        select 1
        from passport_scans ps
        where ps.passport_id = coalesce(
          (to_jsonb(se)->>'passport_id')::uuid,
          (to_jsonb(se)->>'passportId')::uuid
        )
          and ps.scan_timestamp = coalesce(
            (to_jsonb(se)->>'scanned_at')::timestamptz,
            (to_jsonb(se)->>'scannedAt')::timestamptz,
            timezone('utc'::text, now())
          )
          and coalesce(ps.ip_address, '') = coalesce(to_jsonb(se)->>'ip_address', to_jsonb(se)->>'ipAddress', '')
          and coalesce(ps.device_type, '') = coalesce(to_jsonb(se)->>'user_agent', to_jsonb(se)->>'userAgent', '')
      );
  end if;
end $$;

-- 3) Backfill one verification marker per passport that has scan history.
insert into verifications (
  passport_id,
  verification_type,
  status,
  review_notes,
  created_at
)
select
  ps.passport_id,
  'historical_scan_backfill',
  'approved'::verification_status,
  'Backfilled from historical scan data.',
  min(ps.created_at)
from passport_scans ps
where not exists (
  select 1
  from verifications v
  where v.passport_id = ps.passport_id
    and v.verification_type = 'historical_scan_backfill'
)
group by ps.passport_id
