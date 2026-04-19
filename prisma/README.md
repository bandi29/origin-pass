# Prisma and the DPP domain model

The [`schema.prisma`](./schema.prisma) file defines the **digital product passport** hierarchy:

```
Product (owner: userId) ──1:1── Passport ──1:1── QRCode
```

| Model     | Role |
|-----------|------|
| `Product` | Sellable SKU / line; `userId` ties to the tenant user (see `public.users` / `auth.users` in Supabase). |
| `Passport`| Instance-level story, `materials` and `timeline` as JSON. |
| `QRCode`  | Resolved `url` and generated `imageUrl` for labels and scans. |

Runtime APIs in this repo mostly use **Supabase** (`@supabase/supabase-js`). Table and column names in PostgreSQL follow `snake_case` and may differ slightly; migrations live under `supabase/migrations/`.

To regenerate the Prisma client:

```bash
# .env.local must include DATABASE_URL (pooler or direct Postgres URL)
npx prisma generate
```

Optional introspection (overwrite local schema with DB — use with care):

```bash
npx prisma db pull
```
