-- Defense-in-depth hardening for supplier certificate evidence storage.
-- Tenant isolation at runtime: Shopify App Bridge session token → shop domain →
-- organizations.id (store_id) in /api/shopify/certificates (service role, not Supabase Auth).

-- 1. Ensure bucket stays private (never public-readable).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-certificates',
  'supplier-certificates',
  false,
  5242880,
  array['application/pdf', 'image/png']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove any legacy public-read policy if it was ever created.
drop policy if exists "supplier_certificates_public_read" on storage.objects;

-- 2. Explicit service-role-only storage access (private bucket; no anon/authenticated paths).
drop policy if exists "supplier_certificates_service_role_all" on storage.objects;
create policy "supplier_certificates_service_role_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'supplier-certificates')
  with check (bucket_id = 'supplier-certificates');

-- 3. Table RLS — only service_role (server route); anon/authenticated have no policies → denied.
alter table public.certificates enable row level security;

drop policy if exists "certificates_service_role_all" on public.certificates;
create policy "certificates_service_role_all"
  on public.certificates for all
  to service_role
  using (true) with check (true);

-- 4. file_path must be a relative object key, never a URL.
alter table public.certificates drop constraint if exists certificates_file_path_not_url;
alter table public.certificates add constraint certificates_file_path_not_url
  check (file_path !~* '^https?://');
