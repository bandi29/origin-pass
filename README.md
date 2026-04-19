This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

The dev server is fixed to **port 3000** on **127.0.0.1** (see `package.json` `dev` script). If something else is using 3000, `npm run dev` exits with an error instead of switching ports.

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) (or [http://localhost:3000](http://localhost:3000)) in your browser.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Design system & dashboard UI kit

- **Tokens** (`src/design-system/tokens.ts`, `src/app/globals.css` `@theme`): SaaS palette (`ds-*` Tailwind colors), typography, spacing, card surfaces.
- **Primitives**: `Button`, `Card`, `Skeleton`, `Modal`, `Tabs`, `DataTable`, `EmptyState`, `Toast` + `useToast` (`src/components/ui/`).
- **Layouts**: `DashboardPageLayout` (max-width column), `PageHeader` (supports `actionItems` or legacy `actions` node).
- **Growth / gating**: `UpgradeNudge`, `LockedFeature`, `AnalyticsTeaser`, `SuccessCelebration`, `TrustStrip` (`src/components/saas/`).
- **Plan helper** (`src/lib/plan.ts`): set `NEXT_PUBLIC_DEV_PLAN=free|pro|enterprise` in `.env.local` to preview feature gating (defaults to `free`).

## Environment Separation (Dev vs Prod)

To avoid test/prod interference, use separate Supabase projects and env files:

- **Development**: `.env.local`
- **Production**: environment variables in your hosting provider (or `.env.production` locally)

Example files:

- `.env.local` (dev)
- `.env.production.example` (prod template)

At minimum, set:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BASE_URL=
```

Each environment should point to a **different Supabase project**.

## Database Migrations (Automated)

This repo uses the Supabase CLI for migrations:

```
npm run db:push
npm run db:reset
npm run db:diff
```

### CI Workflow
On push to `main`, GitHub Actions runs `supabase db push` using secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

You can update the Supabase project in `supabase/config.toml` or set secrets per environment.

## Backend Architecture (Scalable Service Modules)

The app now includes a service-oriented backend layer under `src/backend`:

- `api`: API gateway response helpers
- `middleware`: request context (trace ID, IP, user agent, geo hints)
- `modules/auth`: auth access
- `modules/users`: user data access
- `modules/organizations`: organization data access
- `modules/passports`: passport data access
- `modules/scans`: scan pipeline
- `modules/verifications`: verification write model
- `modules/analytics`: scan analytics reads
- `modules/integrations`: integration entry points
- `services/ai_detection`: fraud/risk scoring
- `services/notifications`: suspicious scan notifications
- `services/blockchain`: future passport anchoring

### Scan Processing Flow

`POST /api/scans/process` and the public verification page both use the same scan pipeline:

1. Validate passport serial
2. Resolve passport record
3. Check recent scan history
4. Run fraud detection
5. Record scan (`passport_scans`)
6. Record verification (`verifications`)
7. Return verification verdict (`verified` / `suspicious` / `not_found`)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
