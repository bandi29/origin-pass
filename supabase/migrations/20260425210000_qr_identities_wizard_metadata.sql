-- Wizard-generated QR identity metadata (display name, security snapshot, configuration JSON).
alter table qr_identities add column if not exists display_name text;
alter table qr_identities add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_qr_identities_metadata_gin on qr_identities using gin (metadata);
