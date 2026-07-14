-- Fix 42P17: infinite recursion on public.users RLS.
-- Policies that subquery `users` while evaluating `users` re-enter the same policy.
-- This helper reads the caller's org id with SECURITY DEFINER (bypasses RLS on users).

create or replace function public.originpass_auth_user_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select u.organization_id
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

revoke all on function public.originpass_auth_user_organization_id() from public;
grant execute on function public.originpass_auth_user_organization_id() to authenticated;
grant execute on function public.originpass_auth_user_organization_id() to service_role;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
drop policy if exists "Org members view organizations" on organizations;
drop policy if exists "org_select_own" on organizations;
create policy "org_select_own" on organizations for select
  using (id = public.originpass_auth_user_organization_id());

-- ---------------------------------------------------------------------------
-- users (consolidate overlapping select policies)
-- ---------------------------------------------------------------------------
drop policy if exists "Users view own row" on users;
drop policy if exists "Users view org users" on users;
drop policy if exists "users_select_org" on users;
drop policy if exists "users_select_membership" on users;
create policy "users_select_membership" on users for select
  using (
    id = auth.uid()
    or (
      organization_id is not null
      and organization_id = public.originpass_auth_user_organization_id()
    )
  );

-- ---------------------------------------------------------------------------
-- products (org tenant + legacy brand owner)
-- ---------------------------------------------------------------------------
drop policy if exists "products_select_org" on products;
drop policy if exists "products_insert_org" on products;
drop policy if exists "products_update_org" on products;
create policy "products_select_org" on products for select
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );
create policy "products_insert_org" on products for insert
  with check (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );
create policy "products_update_org" on products for update
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or brand_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- passports
-- ---------------------------------------------------------------------------
drop policy if exists "passports_select_org" on passports;
drop policy if exists "passports_insert_org" on passports;
drop policy if exists "passports_update_org" on passports;
create policy "passports_select_org" on passports for select
  using (
    coalesce(
      organization_id,
      (select pr.organization_id from products pr where pr.id = passports.product_id)
    ) = public.originpass_auth_user_organization_id()
    or product_id in (select id from products where brand_id = auth.uid())
  );
create policy "passports_insert_org" on passports for insert
  with check (
    coalesce(
      organization_id,
      (select pr.organization_id from products pr where pr.id = passports.product_id)
    ) = public.originpass_auth_user_organization_id()
    or product_id in (select id from products where brand_id = auth.uid())
  );
create policy "passports_update_org" on passports for update
  using (
    coalesce(
      organization_id,
      (select pr.organization_id from products pr where pr.id = passports.product_id)
    ) = public.originpass_auth_user_organization_id()
    or product_id in (select id from products where brand_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- qr_codes (drop legacy + current policy names)
-- ---------------------------------------------------------------------------
drop policy if exists "Users view qr_codes via passport product" on qr_codes;
drop policy if exists "Users insert qr_codes via passport product" on qr_codes;
drop policy if exists "qr_codes_select" on qr_codes;
drop policy if exists "qr_codes_insert" on qr_codes;
create policy "qr_codes_select" on qr_codes for select
  using (
    passport_id in (
      select p.id
      from passports p
      left join products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
        or pr.brand_id = auth.uid()
    )
  );
create policy "qr_codes_insert" on qr_codes for insert
  with check (
    passport_id in (
      select p.id
      from passports p
      left join products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
        or pr.brand_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- ownership_records
-- ---------------------------------------------------------------------------
drop policy if exists "Users view ownership_records via passport product" on ownership_records;
drop policy if exists "Users update ownership_records via passport product" on ownership_records;
drop policy if exists "ownership_select_org" on ownership_records;
drop policy if exists "ownership_insert_auth" on ownership_records;
drop policy if exists "ownership_update_org" on ownership_records;
create policy "ownership_select_org" on ownership_records for select
  using (
    passport_id in (
      select p.id
      from passports p
      left join products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
        or pr.brand_id = auth.uid()
    )
  );
create policy "ownership_insert_auth" on ownership_records for insert
  with check (auth.uid() is not null);
create policy "ownership_update_org" on ownership_records for update
  using (
    passport_id in (
      select p.id
      from passports p
      left join products pr on pr.id = p.product_id
      where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
        or pr.brand_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- passport_scans
-- ---------------------------------------------------------------------------
drop policy if exists "scans_select_org" on passport_scans;
drop policy if exists "scans_insert_org" on passport_scans;
create policy "scans_select_org" on passport_scans for select
  using (
    organization_id = public.originpass_auth_user_organization_id()
    or (
      organization_id is null
      and passport_id in (
        select p.id
        from passports p
        left join products pr on pr.id = p.product_id
        where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
          or pr.brand_id = auth.uid()
      )
    )
  );
create policy "scans_insert_org" on passport_scans for insert
  with check (
    organization_id = public.originpass_auth_user_organization_id()
    or (
      organization_id is null
      and passport_id in (
        select p.id
        from passports p
        left join products pr on pr.id = p.product_id
        where coalesce(p.organization_id, pr.organization_id) = public.originpass_auth_user_organization_id()
          or pr.brand_id = auth.uid()
      )
    )
  );
