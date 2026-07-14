-- One-shot apply for remote Supabase (Dashboard → SQL Editor → Run once).
-- Same as migrations 20260414_category_compliance_product_columns + 20260415_product_ai_metadata.

-- Category-aware compliance: flexible JSONB + explicit category key for schema lookup
alter table products add column if not exists compliance_category_key text;
alter table products add column if not exists base_data jsonb not null default '{}'::jsonb;
alter table products add column if not exists compliance_data jsonb not null default '{}'::jsonb;
alter table products add column if not exists traceability_data jsonb not null default '{}'::jsonb;

comment on column products.compliance_category_key is 'Registry key: leather | textile | furniture | jewelry — drives validation & UI schema.';
comment on column products.base_data is 'Schema-driven basic fields (name/sku/story mirrors may duplicate top-level columns for DPP tooling).';
comment on column products.compliance_data is 'ESPR/EUDR/due-diligence fields per category schema.';
comment on column products.traceability_data is 'Structured origin, processing steps, certifications list, batches.';

create index if not exists idx_products_compliance_category_key on products(compliance_category_key)
  where compliance_category_key is not null;

-- Audit trail for AI-assisted product creation
alter table products add column if not exists ai_metadata jsonb not null default '{}'::jsonb;

comment on column products.ai_metadata is
  'AI ingestion audit: confidence, provider, timestamps, and URLs to original source documents (e.g. Supabase Storage) for compliance evidence.';

create index if not exists idx_products_ai_metadata on products using gin (ai_metadata);
