# Partitioning Cutover Runbook

## Why

`passport_scans`, `share_clicks`, `audit_logs`, `team_activity_logs`, and
`qr_anomaly_events` are append-only event tables that grow linearly with traffic.
At ~1 M scans/day, the working set on `passport_scans` exceeds buffer cache in
~12 months; autovacuum stalls, dashboard queries do seq scans, backups balloon.
Monthly range partitioning solves this:

- Each month is its own table → `DROP PARTITION` is instant retention.
- Hot partitions stay small enough to live entirely in cache.
- Query plans show partition pruning when the WHERE clause includes the
  partition key.

## What's already shipped

`supabase/migrations/20260527150000_partitioning_toolkit.sql` adds three helper
functions:

- `ensure_month_partition(parent, key, year, month)` — idempotently create one.
- `roll_forward_partitions(parent, key)` — ensure current + next month exist.
  Call daily from a cron.
- `detach_partitions_older_than(parent, retain_months)` — detach old months
  for archival.

These DO NOT touch existing data. Cutover for each table is a deliberate,
scheduled operation described below.

## Cutover procedure (per table)

The "drop existing table and recreate as partitioned" approach **does not work**
on a live table — RLS policies, FK relationships, indexes, triggers, sequences,
and downstream views all break. The safe procedure is:

### Pre-flight (low traffic window)

1. Note the current row count: `select count(*) from passport_scans;`
2. Verify partition key column has a sensible range (no NULLs, monotonically
   increasing). For `passport_scans` this is `scan_timestamp`.
3. Verify FK references to this table:
   ```sql
   select conname, conrelid::regclass
     from pg_constraint
    where confrelid = 'public.passport_scans'::regclass;
   ```

### Step 1 — Create the partitioned shadow

```sql
-- New empty partitioned table. Same schema, same indexes, same RLS policies.
create table public.passport_scans_p (
  like public.passport_scans including all
) partition by range (scan_timestamp);

-- Create partitions for: every month present in the current data,
-- plus current month, plus next month.
do $$
declare
  v_min date := (select min(scan_timestamp)::date from public.passport_scans);
  v_max date := (now() + interval '1 month')::date;
  v_cur date := date_trunc('month', v_min)::date;
begin
  while v_cur <= date_trunc('month', v_max)::date loop
    perform public.ensure_month_partition(
      'passport_scans_p', 'scan_timestamp',
      extract(year from v_cur)::int, extract(month from v_cur)::int
    );
    v_cur := (v_cur + interval '1 month')::date;
  end loop;
end $$;
```

### Step 2 — Backfill (chunked)

For tables under ~10 M rows, a single `insert into passport_scans_p select * from
passport_scans` works. For larger tables, chunk by month to avoid a multi-hour
exclusive transaction:

```sql
do $$
declare
  v_mo date := (select min(scan_timestamp)::date from public.passport_scans);
  v_end date := now()::date;
begin
  while v_mo <= v_end loop
    raise notice 'copying %', v_mo;
    insert into public.passport_scans_p
    select * from public.passport_scans
     where scan_timestamp >= v_mo
       and scan_timestamp <  v_mo + interval '1 month';
    v_mo := (v_mo + interval '1 month')::date;
    commit;  -- requires a DO block in a non-transactional psql session
  end loop;
end $$;
```

### Step 3 — Atomic swap (brief lock)

```sql
begin;
  -- Pause writers (application-level: stop the scan-pipeline worker for ~30s).
  alter table public.passport_scans rename to passport_scans_legacy;
  alter table public.passport_scans_p rename to passport_scans;
  -- Re-attach FK constraints and recreate any views that referenced the table.
commit;
```

Resume the worker. Test a fresh scan ends up in the current-month partition.

### Step 4 — Schedule retention + roll-forward

Add a Supabase scheduled function (or BullMQ repeatable job) that runs daily:

```sql
select public.roll_forward_partitions('passport_scans', 'scan_timestamp');
select public.roll_forward_partitions('share_clicks', 'clicked_at');
select public.roll_forward_partitions('audit_logs', 'created_at');
```

And monthly (configurable retention, default 13 months):

```sql
select public.detach_partitions_older_than('passport_scans', 13);
-- Then export to cold storage and drop the detached tables.
```

### Step 5 — Drop the legacy table

After 30 days of soak time on the new partitioned table:

```sql
drop table public.passport_scans_legacy;
```

## Retention policy per table

| Table | Hot retention | Total retention | Notes |
|---|---|---|---|
| `passport_scans` | 90 days | 13 months | Roll up daily to `passport_scan_daily_agg` after 90d. |
| `share_clicks` | 30 days | 13 months | Source of truth for click counters. |
| `audit_logs` | 13 months | 13 months | Detach + archive to S3 for compliance retention beyond. |
| `team_activity_logs` | 13 months | 13 months | Same as audit_logs. |
| `qr_anomaly_events` | 6 months | 13 months | Old anomalies have no operational value after fraud cases close. |

## Operational checks post-cutover

- `\d+ passport_scans` should show `Partitioned table` and list children.
- `explain analyze select count(*) from passport_scans where scan_timestamp > now() - interval '7 days'`
  should show "Partitions pruned: N" with N > 1.
- Worker writes should land in the current month's partition (`\d+
  passport_scans_y2026m05`).
- Dashboard p95 should drop materially for time-bounded queries.

## When to start

Now is fine for `audit_logs` and `team_activity_logs` — they are smaller and
their tail is cold. Defer `passport_scans` until you have:

1. A maintenance window (30–60 min for chunked backfill on ~100 M rows).
2. The scan-pipeline worker (Phase 1 / Month 1 already shipped) deployed so the
   ~30s write pause during swap is contained to one process.
3. Verified that the new monthly partition table is showing healthy writes from
   a smaller table first (e.g., `share_clicks` if production volume is lower).
