-- Multi-tenant isolation: denormalize organization_id on child tables for fast filtering and consistent RLS.
-- Backfill from passports → products where needed.

-- ---------------------------------------------------------------------------
-- OWNERSHIP_RECORDS
-- ---------------------------------------------------------------------------
alter table ownership_records add column if not exists organization_id uuid references organizations(id) on delete set null;

update ownership_records o
set organization_id = coalesce(p.organization_id, pr.organization_id)
from passports p
join products pr on pr.id = p.product_id
where o.passport_id = p.id
  and o.organization_id is null;

create index if not exists idx_ownership_records_organization_id on ownership_records(organization_id);

comment on column ownership_records.organization_id is 'Denormalized from passport/product for tenant isolation.';

-- ---------------------------------------------------------------------------
-- QR_CODES
-- ---------------------------------------------------------------------------
alter table qr_codes add column if not exists organization_id uuid references organizations(id) on delete set null;

update qr_codes q
set organization_id = coalesce(p.organization_id, pr.organization_id)
from passports p
join products pr on pr.id = p.product_id
where q.passport_id = p.id
  and q.organization_id is null;

create index if not exists idx_qr_codes_organization_id on qr_codes(organization_id);

-- ---------------------------------------------------------------------------
-- VERIFICATIONS
-- ---------------------------------------------------------------------------
alter table verifications add column if not exists organization_id uuid references organizations(id) on delete set null;

update verifications v
set organization_id = coalesce(p.organization_id, pr.organization_id)
from passports p
join products pr on pr.id = p.product_id
where v.passport_id = p.id
  and v.organization_id is null;

create index if not exists idx_verifications_organization_id on verifications(organization_id);

-- ---------------------------------------------------------------------------
-- BATCHES (production runs — scoped by org via product)
-- ---------------------------------------------------------------------------
alter table batches add column if not exists organization_id uuid references organizations(id) on delete set null;

update batches b
set organization_id = pr.organization_id
from products pr
where b.product_id = pr.id
  and b.organization_id is null
  and pr.organization_id is not null;

create index if not exists idx_batches_organization_id on batches(organization_id);

-- ---------------------------------------------------------------------------
-- ITEMS (legacy serial inventory — scoped via batch → product)
-- ---------------------------------------------------------------------------
alter table items add column if not exists organization_id uuid references organizations(id) on delete set null;

update items i
set organization_id = coalesce(b.organization_id, pr.organization_id)
from batches b
join products pr on pr.id = b.product_id
where i.batch_id = b.id
  and i.organization_id is null;

create index if not exists idx_items_organization_id on items(organization_id);
