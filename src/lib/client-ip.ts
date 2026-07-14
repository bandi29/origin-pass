/**
 * Resolve the client IP from a request, preferring platform-canonical headers
 * (set by the trusted edge proxy) over the user-controllable `x-forwarded-for`.
 *
 * Order of preference:
 *   1. `x-vercel-forwarded-for` — set by Vercel's edge, not user-spoofable.
 *   2. `x-real-ip` — set by most trusted reverse proxies (Vercel, nginx, Cloudflare).
 *   3. `x-forwarded-for` — used only as a last resort. The first value in the list
 *      is the originating client when the entire proxy chain is trusted; if any
 *      untrusted proxy sits in front of the app, an attacker can spoof this.
 */
function pickIp(value: string | null | undefined): string | null {
  if (!value) return null
  const first = value.split(",")[0]?.trim()
  return first && first.length > 0 ? first : null
}

export function getClientIp(headers: Headers): string | null {
  return (
    pickIp(headers.get("x-vercel-forwarded-for")) ||
    pickIp(headers.get("x-real-ip")) ||
    pickIp(headers.get("x-forwarded-for"))
  )
}
