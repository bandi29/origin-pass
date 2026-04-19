-- Add secure verify_token to passports for non-guessable QR URLs.
-- Token: 32 random bytes, base64url encoded (~43 chars).
-- URL: https://originpass.com/verify/{verify_token}
-- Legacy serial_number URLs remain supported.

alter table passports add column if not exists verify_token text unique;
create unique index if not exists idx_passports_verify_token on passports(verify_token) where verify_token is not null;

comment on column passports.verify_token is 'Secure token for QR URL. Non-guessable, maps to passport internally.';
