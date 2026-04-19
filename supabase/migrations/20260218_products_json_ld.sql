-- Store standardized JSON-LD for products (EU DPP future-proofing)
-- Enables compliance with shifting regulations without schema changes.

alter table products add column if not exists json_ld jsonb default null;

comment on column products.json_ld is 'Canonical JSON-LD representation for EU Digital Product Passport compliance. Standardized format for traceability.';
