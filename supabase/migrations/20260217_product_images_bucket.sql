-- Product images storage bucket and policies
-- Bucket is created via API on first upload (ensureBucketExists in upload action).
-- This migration adds RLS policies for the product-images bucket.

drop policy if exists "Users can upload product images" on storage.objects;
drop policy if exists "Product images are publicly readable" on storage.objects;

-- Allow authenticated users to upload to their own folder in product-images
create policy "Users can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read (bucket is public)
create policy "Product images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'product-images');
