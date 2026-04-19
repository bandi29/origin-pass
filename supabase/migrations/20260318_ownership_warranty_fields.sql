-- Add warranty and ownership enhancements
-- warranty_start_date: set on first claim
-- warranty_end_date: computed from product warranty period

alter table ownership_records add column if not exists warranty_start_date date;
alter table ownership_records add column if not exists warranty_end_date date;
alter table ownership_records add column if not exists owner_phone text;

-- Ensure owner_identifier exists (email or phone)
create index if not exists idx_ownership_records_owner_identifier on ownership_records(owner_identifier) where owner_identifier is not null;

comment on column ownership_records.warranty_start_date is 'Set on first claim; warranty activates';
comment on column ownership_records.warranty_end_date is 'Computed from product warranty period';
