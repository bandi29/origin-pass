-- Add missing core tables per database architecture spec:
-- qr_codes, ownership_records, verification_logs (view)
-- Relationships: organization → products → passports → (scans, ownership)

-- =====================================================
-- QR_CODES: QR identity metadata per passport
-- =====================================================
create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  format text not null default 'url', -- 'url', 'png', 'svg', 'label'
  verify_url text not null,
  label_spec jsonb default '{}'::jsonb, -- print dimensions, layout
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_qr_codes_passport_id on qr_codes(passport_id);

-- RLS
alter table qr_codes enable row level security;

create policy "Users view qr_codes via passport product"
  on qr_codes for select
  using (
    exists (
      select 1
      from passports p
      join products pr on pr.id = p.product_id
      where p.id = qr_codes.passport_id
        and (pr.brand_id = auth.uid()
          or (pr.organization_id is not null and pr.organization_id in (
            select organization_id from users where id = auth.uid()
          )))
    )
  );

create policy "Users insert qr_codes via passport product"
  on qr_codes for insert
  with check (
    exists (
      select 1
      from passports p
      join products pr on pr.id = p.product_id
      where p.id = qr_codes.passport_id
        and (pr.brand_id = auth.uid()
          or (pr.organization_id is not null and pr.organization_id in (
            select organization_id from users where id = auth.uid()
          )))
    )
  );

-- =====================================================
-- OWNERSHIP_RECORDS: Consumer ownership claims per passport
-- =====================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ownership_status') then
    create type ownership_status as enum ('claimed', 'transferred', 'revoked');
  end if;
end $$;

create table if not exists ownership_records (
  id uuid primary key default gen_random_uuid(),
  passport_id uuid references passports(id) on delete cascade not null,
  owner_email text,
  owner_name text,
  status ownership_status not null default 'claimed',
  claimed_at timestamptz not null default timezone('utc'::text, now()),
  transferred_to uuid references ownership_records(id) on delete set null,
  proof_of_purchase text, -- receipt ref, invoice id
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_ownership_records_passport_id on ownership_records(passport_id);
create index if not exists idx_ownership_records_owner_email on ownership_records(owner_email);
create index if not exists idx_ownership_records_claimed_at on ownership_records(claimed_at desc);

-- RLS
alter table ownership_records enable row level security;

create policy "Users view ownership_records via passport product"
  on ownership_records for select
  using (
    exists (
      select 1
      from passports p
      join products pr on pr.id = p.product_id
      where p.id = ownership_records.passport_id
        and (pr.brand_id = auth.uid()
          or (pr.organization_id is not null and pr.organization_id in (
            select organization_id from users where id = auth.uid()
          )))
    )
  );

-- Consumers claim ownership via verify page (server action validates passport)
create policy "Authenticated can claim ownership"
  on ownership_records for insert
  with check (auth.uid() is not null);

create policy "Users update ownership_records via passport product"
  on ownership_records for update
  using (
    exists (
      select 1
      from passports p
      join products pr on pr.id = p.product_id
      where p.id = ownership_records.passport_id
        and (pr.brand_id = auth.uid()
          or (pr.organization_id is not null and pr.organization_id in (
            select organization_id from users where id = auth.uid()
          )))
    )
  );

-- =====================================================
-- VERIFICATION_LOGS: View alias for verifications table
-- Matches spec naming; verifications remains the backing table
-- =====================================================
create or replace view verification_logs as
select
  id,
  passport_id,
  verification_type,
  status,
  reviewed_by,
  review_notes,
  created_at
from verifications;

-- Grant read to authenticated users who can see passports
grant select on verification_logs to authenticated;
grant select on verification_logs to service_role;
