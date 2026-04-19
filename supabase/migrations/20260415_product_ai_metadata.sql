-- Audit trail for AI-assisted product creation (regulator / immutable event stream)
alter table products add column if not exists ai_metadata jsonb not null default '{}'::jsonb;

comment on column products.ai_metadata is
  'AI ingestion audit: confidence, provider, timestamps, and URLs to original source documents (e.g. Supabase Storage) for compliance evidence.';

create index if not exists idx_products_ai_metadata on products using gin (ai_metadata);

-- If PDF uploads to `product-images` fail with a MIME error, add `application/pdf` to the bucket’s
-- allowed MIME types in Supabase Dashboard → Storage → product-images → Configuration.
