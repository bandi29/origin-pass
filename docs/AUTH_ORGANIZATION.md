# Authentication & multi-tenant organizations

Production-oriented auth and organization setup for OriginPass (Next.js App Router + Supabase).

## Overview

| Piece | Implementation |
|--------|------------------|
| Identity | Supabase Auth (JWT, refresh via `@supabase/ssr`) |
| Tenant | `organizations` + `public.users.organization_id` |
| Provisioning | Server action `completeOrganizationSignup` (service role **after** session verification) |
| Route protection | `requireAuth()` in server layouts |
| Client guard | `ProtectedRoute` (optional; layouts are authoritative) |

## Routes

| Path | Purpose |
|------|---------|
| `/login` | Email/password + magic link |
| `/signup` | Step 1: email + password → Step 2: organization name |
| `/signup/complete` | Finish org setup after email confirmation |
| `/forgot-password` | `resetPasswordForEmail` (redirects via `/auth/callback` to `/reset-password`) |
| `/reset-password` | Set new password after email link (then sign out → `/login?reset=success`) |

## Security practices

1. **Service role** is used only in `completeOrganizationSignup` after `getUser()` confirms the caller’s session. Never pass arbitrary `userId` from the client.
2. **Anon key** only in browser (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. **Input validation** with Zod on organization name.
4. **Friendly errors** via `toFriendlyAuthError` — avoid leaking raw Supabase messages.
5. **Rate limiting**: add Upstash/Redis on auth routes at scale; verification API already has a simple limiter pattern.

## Supabase project setup

1. **Authentication → Providers**: enable Email; optional Magic Link / OTP.
2. **Authentication → URL configuration**: add site URL and redirect URLs, e.g. `https://yourdomain.com/en/auth/callback`, `http://localhost:3000/en/auth/callback`.
3. **Email templates**: customize confirm signup / reset password if needed.
4. **Optional**: disable “Confirm email” for faster dev; enable in production.

## Database

Existing tables (see migrations `20260309`, `20260316`):

- `organizations (id, name, …)`
- `users (id → auth.users, organization_id, email, role, …)`
- `products`, `passports`, `passport_scans`, `ownership_records` scoped by `organization_id` (and legacy `brand_id` on `products`)

`completeOrganizationSignup` also upserts `profiles` for legacy RLS paths that key off `profiles.id = auth.uid()`.

## Row Level Security (RLS)

Canonical policies live in `supabase/migrations/20260316_originpass_production_schema.sql`. Pattern:

```sql
-- Example: products visible only within the user’s organization
create policy "products_select_org" on products for select
  using (organization_id in (
    select organization_id from users where id = auth.uid()
  ));
```

Apply the same idea to:

- `products`, `passports`, `qr_codes`, `passport_scans`, `ownership_records` (via passport → product org)
- `organizations` (select own org)
- `users` (select self + same org)

**Legacy**: policies also allow `products.brand_id = auth.uid()` where applicable for older rows.

After changing RLS, run `supabase db push` or your migration pipeline.

## UI / UX (auth surfaces)

Auth screens share **`auth-ui.ts`** tokens (Stripe-like calm neutrals, Notion-like clear hierarchy, Linear-like crisp controls):

- Background `#fafafa`, hairline rings, `rounded-md` actions, 15px body text.
- Split layout: **`AuthPageShell`** (marketing column + form).
- Centered flows: **`AuthCardShell`** (forgot password, reset password, signup complete).

See `src/components/auth/auth-ui.ts` and `AuthPageShell.tsx`.

## Frontend structure

```
src/components/auth/
  auth-ui.ts
  AuthPageShell.tsx
  LoginForm.tsx
  SignupForm.tsx
  OrganizationSetupForm.tsx
  UpdatePasswordForm.tsx
  SignOutButton.tsx
  ProtectedRoute.tsx
src/actions/complete-organization-signup.ts
src/lib/auth-errors.ts
src/lib/auth-org.ts
src/lib/require-auth.ts
```

## Protected routes

- `src/app/[locale]/dashboard/layout.tsx` — `requireAuth({ requireOrganization: true })`
- `src/app/[locale]/analytics/layout.tsx` — same
- `src/app/[locale]/product/layout.tsx` — same

Unauthenticated users → `/login`. Authenticated without org → `/signup/complete`.

## Scoping API / server code

`getScopedProductIds` resolves products by:

- `brand_id = auth.uid()` (legacy), or  
- `organization_id` from `public.users` for the current user

Ensure new products set `organization_id` when created in org-based flows.

## Optional: Edge middleware

This app uses **layout-level** checks (simple, cookie-aware on server). For Edge protection, combine `next-intl` middleware with Supabase session refresh (see Supabase SSR docs); keep service role **only** on the server.
