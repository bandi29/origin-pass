# Multi-tenant `organization_id` model

## Principle

Every **tenant-scoped** row should be reachable via `organization_id` (directly or through a denormalized copy) so RLS and application queries can filter with:

`organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())`

## Tables with `organization_id`

| Table | Notes |
|-------|--------|
| `organizations` | Root tenant |
| `users` | `organization_id` links members to org |
| `products` | Core catalog |
| `passports` | Denormalized from product |
| `passport_scans` | Denormalized from passport/product |
| `api_keys` | Org-scoped |
| `ownership_records` | Denormalized (migration `20260321`) |
| `qr_codes` | Denormalized (migration `20260321`) |
| `verifications` | Denormalized (migration `20260321`) |
| `batches` | Denormalized via product (migration `20260321`) |
| `items` | Denormalized via batch/product (migration `20260321`) |

## Legacy / special cases

| Table | Model |
|-------|--------|
| `profiles` | Tied to `auth.users` (`id`); billing fields; brand display via `brand_name` |
| `products.brand_id` | Legacy single-brand scope (`auth.uid()`); prefer `organization_id` for new data |
| `usage_logs` | `brand_id` — consider backfilling `organization_id` when modernizing billing |

## Application code

- **Provisioning**: `completeOrganizationSignup` creates `organizations` + `users.organization_id` + `profiles`.
- **Ownership claims**: `claimOwnership` sets `ownership_records.organization_id` from passport/product.
- **Scoped queries**: `getScopedProductIds` uses `brand_id` **or** `users.organization_id` → `products.organization_id`.

## Migrations

Run `supabase db push` (or your pipeline) to apply `20260321_organization_id_tenant_columns.sql`.
