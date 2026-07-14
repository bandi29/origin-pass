# Scan-table consolidation runbook (`passport_scans` ↔ `scan_events`)

## Why

Today the scan-pipeline writes the **same logical event to two physical tables**:
- `passport_scans` (BIGSERIAL, scan_timestamp, location_country, ip_address, scan_result, risk_score)
- `scan_events` (UUID, scanned_at, geo_country, qr_identity_id, scan_source, metadata_json)

Two indexed tables on the hottest write path. At 1 M scans/day that is **2 M
indexed rows/day** of write amplification.

The survivor will be `passport_scans` because it is BIGSERIAL (8 bytes, cache-
friendly, partition-friendly) and the new SQL helpers (`scans_per_day_for_org`,
`compute_scan_fraud_signals`) are already written against it.

## What has shipped (no action required)

1. **Schema migration** `20260527160000_passport_scans_consolidation_schema.sql`
   adds the columns previously only in `scan_events`:
   `product_id`, `qr_identity_id`, `device_fingerprint`, `user_agent`,
   `scan_source`, `latitude`, `longitude`, `metadata_json`.

2. **Worker change** in `src/lib/scan-pipeline/process.ts`: every scan written
   to `passport_scans` now includes the new columns. Dual writes to
   `scan_events` are still emitted by the same worker so reads remain consistent
   during the migration window.

3. **Backfill** of `passport_scans.product_id` from the parent passport row,
   bundled into the schema migration above.

## What remains (operator-scheduled)

### Step A — verify dual-write integrity (run for ≥7 days)

After the schema migration is live, sample-compare rows for the same logical
scan:

```sql
-- Sanity check: same passport, same minute, both tables.
select se.id as scan_event_id,
       ps.id as passport_scan_id,
       se.scanned_at,
       ps.scan_timestamp,
       se.scan_source,
       ps.scan_source,
       se.geo_country,
       ps.location_country
  from public.scan_events se
  join public.passport_scans ps on ps.passport_id = se.passport_id
                                 and ps.scan_timestamp between se.scanned_at - interval '1 sec'
                                                            and se.scanned_at + interval '1 sec'
 order by se.scanned_at desc
 limit 100;
```

All meaningful fields should match. Discrepancies in `scan_source` /
`geo_country` columns are normal until you cut over (see Step B).

### Step B — migrate analytics readers

Audit every Supabase query that touches `scan_events` and update it to read
from `passport_scans`. The architecture-review work already migrated:

- `src/backend/modules/analytics/dashboard.ts` (uses passport_scans)
- `src/backend/modules/analytics/repository.ts` → `computeScanFraudSignals`
  (uses passport_scans)
- `src/backend/modules/scan-events/repository.ts` → `getScanAnalytics`
  (still reads from `scan_events`; flip to `passport_scans` here)

Quick scan:

```bash
rg -l '\.from\("scan_events"' src
```

For each match, replace with `.from("passport_scans")` and adjust column names:

| `scan_events` column | `passport_scans` column |
|---|---|
| `scanned_at`        | `scan_timestamp`         |
| `geo_country`       | `location_country`       |
| `geo_city`          | `location_city`          |
| `ip_hash`           | `ip_address` (raw) — see below |
| `device`            | `device_type` or `user_agent` |

**IP storage**: `scan_events.ip_hash` is HMAC-pseudonymised; `passport_scans
.ip_address` is raw. After consolidation, write `hashIpForStorage(ip)` into
`passport_scans.ip_address` and treat the column as the hash. Update the column
comment + add a follow-up migration to rename to `ip_hash` if you want clarity.
(Recommended.)

### Step C — stop writing to scan_events

In `src/lib/scan-pipeline/process.ts`, remove the `admin.from("scan_events")
.insert(...)` block. Verify in staging that all dashboards still render.

### Step D — drop scan_events

After 30 days of soak time on Step C:

```sql
-- Optional one-time export to cold storage:
copy (select * from public.scan_events) to '/tmp/scan_events_archive.csv' csv header;

drop table public.scan_events cascade;
```

The `cascade` drops the four RLS policies + indexes attached to scan_events.

### Step E — partition the now-consolidated table (Phase 5 cutover)

See `docs/PARTITIONING_RUNBOOK.md`. `passport_scans` is now the only
high-volume scan table and is ready for monthly range partitioning.

## Rollback plan

At any point before Step D:

- Reverse Step C by re-enabling the `scan_events` insert in the worker.
- Reverse Step B by switching the touched repositories back. Git history is the
  source of truth — keep the migration PRs small and reverting is `git revert`.

After Step D the rollback requires restoring from a database snapshot taken
just before the DROP — schedule the snapshot explicitly as part of the cutover
maintenance window.
