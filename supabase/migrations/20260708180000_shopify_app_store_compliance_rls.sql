-- Shopify App Store compliance — multi-tenant RLS hardening (2026-07-08)
--
-- Terminology (no separate tables):
--   stores            → public.organizations (keyed by shop_domain for Shopify)
--   passport_overrides → products.compliance_data + public.certificates
--
-- Authenticated dashboard users are isolated via originpass_auth_user_organization_id().
-- Shopify embedded routes use the service-role client and MUST filter by shop_domain
-- in application code; certificates remain service-role-only at the DB layer.

-- ---------------------------------------------------------------------------
-- 1) Enable RLS on tenant tables (idempotent)
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.products enable row level security;
alter table public.certificates enable row level security;
alter table public.passports enable row level security;
alter table public.scan_events enable row level security;

-- ---------------------------------------------------------------------------
-- 2) organizations (stores) — authenticated read/update only for own org
-- ---------------------------------------------------------------------------
drop policy if exists "org_select_own" on public.organizations;
create policy "org_select_own"
  on public.organizations
  for select
  to authenticated
  using (id = public.originpass_auth_user_organization_id());

drop policy if exists "org_update_own" on public.organizations;
create policy "org_update_own"
  on public.organizations
  for update
  to authenticated
  using (id = public.originpass_auth_user_organization_id())
  with check (id = public.originpass_auth_user_organization_id());

-- Inserts/deletes for stores are service-role only (OAuth + GDPR purge).
revoke all on table public.organizations from anon;
revoke insert, delete, truncate, references, trigger on table public.organizations from authenticated;
grant select, update on table public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- 3) products — full org CRUD for authenticated; blocks cross-tenant UUID access
-- ---------------------------------------------------------------------------
drop policy if exists "products_select_org" on public.products;
drop policy if exists "products_insert_org" on public.products;
drop policy if exists "products_update_org" on public.products;
drop policy if exists "products_delete_org" on public.products;

create policy "products_select_org"
  on public.products
  for select
  to authenticated
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

create policy "products_insert_org"
  on public.products
  for insert
  to authenticated
  with check (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

create policy "products_update_org"
  on public.products
  for update
  to authenticated
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  )
  with check (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

create policy "products_delete_org"
  on public.products
  for delete
  to authenticated
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

revoke all on table public.products from anon;

-- ---------------------------------------------------------------------------
-- 4) certificates (passport field evidence) — service role only; deny anon
-- ---------------------------------------------------------------------------
drop policy if exists "certificates_service_role_all" on public.certificates;
create policy "certificates_service_role_all"
  on public.certificates
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.certificates from anon;
revoke all on table public.certificates from authenticated;

-- ---------------------------------------------------------------------------
-- 5) scan_events — org-scoped read/insert (public scan funnel + dashboard)
-- ---------------------------------------------------------------------------
drop policy if exists "org_select_scan_events" on public.scan_events;
drop policy if exists "org_insert_scan_events" on public.scan_events;

create policy "org_select_scan_events"
  on public.scan_events
  for select
  to authenticated
  using (organization_id = public.originpass_auth_user_organization_id());

create policy "org_insert_scan_events"
  on public.scan_events
  for insert
  to authenticated
  with check (organization_id = public.originpass_auth_user_organization_id());

revoke all on table public.scan_events from anon;

-- ---------------------------------------------------------------------------
-- 6) Defense-in-depth helper: product belongs to caller org (for future policies)
-- ---------------------------------------------------------------------------
create or replace function public.originpass_product_in_user_organization(p_product_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.products pr
    where pr.id = p_product_id
      and (
        pr.organization_id = public.originpass_auth_user_organization_id()
        or pr.brand_id = auth.uid()
      )
  );
$$;

revoke all on function public.originpass_product_in_user_organization(uuid) from public;
grant execute on function public.originpass_product_in_user_organization(uuid) to authenticated, service_role;
