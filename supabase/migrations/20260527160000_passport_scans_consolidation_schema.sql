-- Phase 6 (Step 1 of 3): extend passport_scans with columns currently held by
-- scan_events, in preparation for consolidating the two tables.
--
-- This migration ONLY adds columns. It does NOT change any application code,
-- backfill any data, or drop scan_events. The full cutover is described in
-- docs/SCAN_TABLE_CONSOLIDATION_RUNBOOK.md.
--
-- Why passport_scans is the survivor:
--   - BIGSERIAL primary key (8 bytes, cache-friendly, partition-friendly).
--   - Already carries `organization_id` denormalized for tenant isolation.
--   - The architecture-review SQL function (`scans_per_day_for_org`,
--     `compute_scan_fraud_signals`) is already written against this table.
--
-- After this migration, the scan-pipeline worker will write the extra fields to
-- passport_scans alongside the existing fields. Reads still go through both
-- tables until the runbook's cutover step.

alter table public.passport_scans
  add column if not exists product_id        uuid references public.products(id) on delete cascade,
  add column if not exists qr_identity_id    uuid references public.qr_identities(id) on delete set null,
  add column if not exists device_fingerprint text,
  add column if not exists user_agent        text,
  add column if not exists scan_source       text,
  add column if not exists latitude          numeric(10, 6),
  add column if not exists longitude         numeric(10, 6),
  add column if not exists metadata_json     jsonb not null default '{}'::jsonb;

-- Backfill the new product_id from passports → required for the consolidated
-- analytics queries to operate on passport_scans alone.
update public.passport_scans s
   set product_id = p.product_id
  from public.passports p
 where s.passport_id = p.id
   and s.product_id is null;

-- Lightweight indexes to support the new query shapes. CONCURRENTLY would be
-- preferred for very large tables but isn't allowed inside Supabase's
-- transaction-wrapped migrations; on tables of practical size at the time of
-- this migration the regular `create index` is fine.
create index if not exists idx_passport_scans_product_id
  on public.passport_scans (product_id);

create index if not exists idx_passport_scans_qr_identity_id
  on public.passport_scans (qr_identity_id);

create index if not exists idx_passport_scans_scan_source
  on public.passport_scans (scan_source)
  where scan_source is not null;

comment on column public.passport_scans.product_id is
  'Denormalized from passports.product_id. Populated by the scan-pipeline worker. Used by analytics joins and scope helpers.';
comment on column public.passport_scans.qr_identity_id is
  'Optional QR identity that originated this scan. Null for legacy/non-identity scans.';
comment on column public.passport_scans.metadata_json is
  'Open-ended bag for scan-source-specific metadata (mirrors scan_events.metadata_json).';
