import { createHmac } from "crypto"

/**
 * One-way pseudonymous identifier for an IP (GDPR-friendly: no raw IP persisted).
 * Uses HMAC with server secret so rainbow tables against the hash are impractical.
 */
export function hashIpForStorage(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") return null
  const trimmed = ip.trim()
  if (!trimmed) return null
  const secret = process.env.IP_HASH_SALT || process.env.SCAN_REDIRECT_SECRET || "dev-only-ip-salt"
  return createHmac("sha256", secret).update(trimmed).digest("hex")
}

export function truncateUserAgent(ua: string | null | undefined, max = 200): string | null {
  if (!ua || typeof ua !== "string") return null
  const t = ua.trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}
