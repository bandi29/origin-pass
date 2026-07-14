-- Simplify the RLS policies on passport_scans so they plan as index scans instead
-- of nested loops with subqueries.
--
-- Background: the existing policy (introduced in 20260418_fix_users_rls_recursion)
-- has a defensive OR-fallback for rows where `organization_id` is null. That
-- fallback joins through products, which the planner cannot push into an index
-- scan — every authenticated read becomes O(N·M). At 100k scans/org the policy
-- alone adds 100ms+ to a list query.
--
-- This migration:
--   1. Backfills passport_scans.organization_id from the parent passport row.
--   2. Backfills scan_events.organization_id similarly (defensive).
--   3. Replaces the policy with the simple form used by other modules
--      (organization_id = public.originpass_auth_user_organization_id()).
--
-- The legacy OR-fallback was for old rows pre-denormalization. After the
-- backfill the fallback is unnecessary and the simpler policy is correct.

-- 1) Backfill organization_id from passports / products.
update public.passport_scans s
   set organization_id = coalesce(p.organization_id, pr.organization_id, pr.brand_id)
  from public.passports p
  left join public.products pr on pr.id = p.product_id
 where s.passport_id = p.id
   and s.organization_id is null;

update public.scan_events e
   set organization_id = coalesce(p.organization_id, pr.organization_id, pr.brand_id)
  from public.passports p
  left join public.products pr on pr.id = p.product_id
 where e.passport_id = p.id
   and e.organization_id is null;

-- 2) Drop and recreate policies in the simpler form. We keep them permissive but
--    index-friendly: a single equality check against a STABLE helper function.
drop policy if exists "scans_select_org" on public.passport_scans;
drop policy if exists "scans_insert_org" on public.passport_scans;

create policy "scans_select_org" on public.passport_scans for select
  using (organization_id = public.originpass_auth_user_organization_id());

-- Public scan inserts come through the service-role client (scan-pipeline worker)
-- which bypasses RLS, but we also allow tenant-scoped inserts for tooling.
create policy "scans_insert_org" on public.passport_scans for insert
  with check (organization_id = public.originpass_auth_user_organization_id());

-- 3) Make sure the column is indexed for the policy lookup. Already added in the
--    performance-indexes migration but reaffirm so this migration is self-contained.
create index if not exists idx_passport_scans_org_scan_ts
  on public.passport_scans (organization_id, scan_timestamp desc);
