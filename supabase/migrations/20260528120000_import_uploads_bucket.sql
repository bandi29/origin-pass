-- Private bucket for product CSV/XLSX import uploads (server-side via service role).
-- Paths: {userId}/{jobId}.csv|.xlsx

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'import-uploads',
  'import-uploads',
  false,
  52428800,
  array[
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service role performs uploads; no public read. Authenticated users may read own folder if needed later.
drop policy if exists "import_uploads_select_own" on storage.objects;
drop policy if exists "import_uploads_insert_own" on storage.objects;
drop policy if exists "import_uploads_update_own" on storage.objects;
drop policy if exists "import_uploads_delete_own" on storage.objects;

create policy "import_uploads_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'import-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "import_uploads_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'import-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "import_uploads_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'import-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'import-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "import_uploads_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'import-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
