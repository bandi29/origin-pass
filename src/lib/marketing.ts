/**
 * Public marketing / demo entry points.
 * Override with NEXT_PUBLIC_DEMO_VERIFY_SERIAL in .env.local
 */
export const DEMO_VERIFY_SERIAL =
  process.env.NEXT_PUBLIC_DEMO_VERIFY_SERIAL ?? "OP-DEMO123"

export function demoVerifyHref(): string {
  return `/verify/${DEMO_VERIFY_SERIAL}`
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  )
}
