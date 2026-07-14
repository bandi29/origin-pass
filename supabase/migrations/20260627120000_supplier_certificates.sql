-- Verification & Data Trust — supplier certificates as evidence for passport fields.
--
-- AUTH ASSUMPTION (explicit): the Shopify embedded app does NOT use Supabase Auth.
-- Merchants are authenticated by Shopify; our server route verifies the App Bridge
-- session token (verifyShopifySessionToken) and derives store_id (organizations.id)
-- from it, then accesses this table with the SERVICE ROLE (which bypasses RLS).
-- RLS is enabled below as defense-in-depth so the table is unreachable from the
-- anon/public client; tenant isolation (a store only ever reads/writes its own rows)
-- is enforced in the server route by scoping every query to the session-derived
-- store_id. If a future surface uses authenticated Supabase users, add a matching
-- USING policy keyed to that identity.

-- 1. Private bucket — files are NOT publicly readable; access is via short-lived
--    signed URLs minted on demand. We persist the object path, never a public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-certificates',
  'supplier-certificates',
  false,
  5242880,
  array['application/pdf', 'image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket is private — no public read policy. Reads/writes/deletes go through the
-- service role (bypasses storage RLS) from the trusted server route.
drop policy if exists "supplier_certificates_public_read" on storage.objects;

-- 2. Verification status enum.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'certificate_verification_status') then
    create type certificate_verification_status as enum (
      'unverified', 'self_attested', 'third_party_verified'
    );
  end if;
end$$;

-- 3. Certificates table (scalable — evidence rows, not hardcoded columns on the store).
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.organizations(id) on delete cascade,
  -- null = store-wide global fallback (today); set to a product for per-product evidence later.
  product_id uuid references public.products(id) on delete cascade,
  field_key text not null,            -- e.g. production_location, care_instructions, materials, carbon…
  file_path text not null,            -- object path in the private bucket; NEVER a public URL
  original_filename text not null,    -- display metadata only (stored object name is a UUID)
  mime_type text not null,
  file_size integer not null,
  verification_status certificate_verification_status not null default 'self_attested',
  uploaded_at timestamptz not null default now()
);

comment on table public.certificates is
  'Supplier certificates backing passport data fields. file_path is a private-bucket object path; signed URLs are minted on demand. Tenant-scoped via service-role server route (see migration header).';

create index if not exists certificates_store_id_idx on public.certificates (store_id);
create index if not exists certificates_product_id_idx on public.certificates (product_id);

-- One certificate per (store, field) at global scope; per (store, product, field) when product-scoped.
create unique index if not exists certificates_store_field_global_uniq
  on public.certificates (store_id, field_key) where product_id is null;
create unique index if not exists certificates_store_product_field_uniq
  on public.certificates (store_id, product_id, field_key) where product_id is not null;

-- 4. RLS — defense-in-depth (see AUTH ASSUMPTION above). Enabling RLS with only a
--    service-role policy denies the anon/public client entirely.
alter table public.certificates enable row level security;

drop policy if exists "certificates_service_role_all" on public.certificates;
create policy "certificates_service_role_all"
  on public.certificates for all
  to service_role
  using (true) with check (true);
