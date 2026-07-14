-- Supplier certificates: public-readable bucket, JPEG support, brand proof URL columns.
--
-- Upload paths (server route): {shop_domain}/{field_key}/{uuid}-{filename}.{ext}
-- Product scope: {shop_domain}/product/{product_id}/{field_key}/{uuid}-{filename}.{ext}
-- Writes remain service-role-only via /api/shopify/certificates.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-certificates',
  'supplier-certificates',
  true,
  5242880,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "supplier_certificates_public_read" on storage.objects;
create policy "supplier_certificates_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'supplier-certificates');

drop policy if exists "supplier_certificates_service_role_all" on storage.objects;
create policy "supplier_certificates_service_role_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'supplier-certificates')
  with check (bucket_id = 'supplier-certificates');

alter table public.organizations
  add column if not exists production_location_proof_url text,
  add column if not exists care_instructions_proof_url text;

comment on column public.organizations.production_location_proof_url is
  'Public URL for brand-level production location verification document (mirrors certificates row).';
comment on column public.organizations.care_instructions_proof_url is
  'Public URL for brand-level care instructions verification document (mirrors certificates row).';
