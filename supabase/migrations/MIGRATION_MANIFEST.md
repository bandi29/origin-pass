# OriginPass Migration Manifest

Supabase migrations use the format `YYYYMMDD_description.sql`.

## Migration Versions (Chronological)

| Version | Description |
|---------|-------------|
| `20260203` | Add `is_active` to batches |
| `20260206` | Init OriginPass (profiles, products, batches, items, usage_logs, RLS) |
| `20260215` | Add EU DPP fields to batches |
| `20260216` | Secure public_item_scan view |
| `20260217` | Product images storage bucket |
| `20260218` | Products JSON-LD for EU DPP |
| `20260309` | Scalable core tables (organizations, users, passports, passport_scans, verifications) |
| `20260310` | Backfill passports, scans, verifications from legacy |
| `20260315` | Add qr_codes, ownership_records, verification_logs view |
| `20260316` | Production schema (enums, indexes, RLS, updated_at triggers) |
| `20260317` | Add verify_token to passports (secure QR URLs) |

## Running Migrations

```bash
# Local development
supabase db reset

# Push to remote
supabase db push
```

## Existing Databases

Migration filenames must match the remote `supabase_migrations` history. Use `YYYYMMDD` format to stay in sync.
