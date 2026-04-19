# OriginPass Production Schema

See migration `20260316_originpass_production_schema.sql` for the full schema.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **BIGSERIAL for passport_scans** | Append-only, partition-friendly. Sequential IDs enable efficient range partitioning by time. |
| **organization_id denormalized** | Passports and passport_scans carry organization_id to avoid joins for tenant-scoped queries. |
| **ip_hash instead of raw IP** | SHA256(ip) enables fraud detection without storing PII (GDPR). |
| **JSONB metadata** | Flexible schema evolution without migrations. |
| **UUID primary keys** | Distributed-friendly, no sequential leakage across tenants. |

## Partitioning passport_scans (Future)

When scan volume exceeds **~10M rows**, partition by `scan_timestamp`:

```sql
-- 1. Create partitioned table (new)
CREATE TABLE passport_scans_partitioned (
  LIKE passport_scans INCLUDING ALL
) PARTITION BY RANGE (scan_timestamp);

-- 2. Create partitions (e.g. monthly)
CREATE TABLE passport_scans_2024_01 PARTITION OF passport_scans_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE passport_scans_2024_02 PARTITION OF passport_scans_partitioned
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- ... etc

-- 3. Migrate data
INSERT INTO passport_scans_partitioned SELECT * FROM passport_scans;

-- 4. Swap tables (requires brief downtime or blue-green)
ALTER TABLE passport_scans RENAME TO passport_scans_legacy;
ALTER TABLE passport_scans_partitioned RENAME TO passport_scans;
```

**Alternative: Native PostgreSQL 11+ declarative partitioning** – create table with `PARTITION BY RANGE` from the start if starting fresh.

## Sample Inserts

```sql
-- Organization
INSERT INTO organizations (id, name, plan)
VALUES (uuid_generate_v4(), 'Acme Brands', 'growth');

-- User (requires auth.users row first via Supabase Auth)
INSERT INTO users (id, organization_id, email, role)
VALUES (
  'auth-user-uuid-here',
  (SELECT id FROM organizations WHERE name = 'Acme Brands' LIMIT 1),
  'admin@acme.com',
  'owner'
);

-- Product
INSERT INTO products (organization_id, name, category, sku, brand)
VALUES (
  (SELECT id FROM organizations WHERE name = 'Acme Brands' LIMIT 1),
  'Leather Satchel',
  'accessories',
  'SAT-001',
  'Acme'
);

-- Passport
INSERT INTO passports (organization_id, product_id, passport_uid, serial_number, status, manufactured_at, origin_country)
VALUES (
  (SELECT id FROM organizations LIMIT 1),
  (SELECT id FROM products LIMIT 1),
  'OP-2024-00001',
  'OP-2024-00001',
  'active',
  '2024-01-15',
  'IT'
);

-- QR Code
INSERT INTO qr_codes (passport_id, qr_value, qr_url)
VALUES (
  (SELECT id FROM passports WHERE passport_uid = 'OP-2024-00001' LIMIT 1),
  'OP-2024-00001',
  'https://originpass.com/verify/OP-2024-00001'
);

-- Ownership record
INSERT INTO ownership_records (passport_id, owner_identifier, status)
VALUES (
  (SELECT id FROM passports WHERE passport_uid = 'OP-2024-00001' LIMIT 1),
  'customer@example.com',
  'active'
);

-- Scan (append-only)
INSERT INTO passport_scans (passport_id, organization_id, country, city, device_type, ip_hash, verification_result)
VALUES (
  (SELECT id FROM passports WHERE passport_uid = 'OP-2024-00001' LIMIT 1),
  (SELECT organization_id FROM passports WHERE passport_uid = 'OP-2024-00001' LIMIT 1),
  'US',
  'New York',
  'mobile',
  encode(sha256('192.168.1.1'::bytea), 'hex'),
  'valid'
);
```

## Index Usage

| Query pattern | Index used |
|---------------|------------|
| Lookup by passport_uid | `idx_passports_passport_uid` |
| Org's passports | `idx_passports_organization_id` |
| Org scans in date range | `idx_passport_scans_org_timestamp` |
| Fraud review | `idx_passport_scans_suspicious` (partial) |
| Ownership by passport | `idx_ownership_records_passport_id` |
