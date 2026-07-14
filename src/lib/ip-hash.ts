import { createHmac } from "crypto"

function resolveIpHashSecret(): string {
  const configured = process.env.IP_HASH_SALT
  if (configured && configured.length > 0) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT environment variable is required in production")
  }
  return "dev-only-ip-salt"
}

/**
 * One-way pseudonymous identifier for an IP (GDPR-friendly: no raw IP persisted).
 * Uses HMAC with a dedicated server secret so rainbow tables against the hash are impractical.
 */
export function hashIpForStorage(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== "string") return null
  const trimmed = ip.trim()
  if (!trimmed) return null
  return createHmac("sha256", resolveIpHashSecret()).update(trimmed).digest("hex")
}

export function truncateUserAgent(ua: string | null | undefined, max = 200): string | null {
  if (!ua || typeof ua !== "string") return null
  const t = ua.trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max) : t
}
