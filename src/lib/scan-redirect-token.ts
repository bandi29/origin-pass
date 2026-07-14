import { createHmac, timingSafeEqual } from "crypto"

const WINDOW_SEC = 120

function secret(): string {
  const configured = process.env.SCAN_REDIRECT_SECRET
  if (configured && configured.length > 0) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("SCAN_REDIRECT_SECRET environment variable is required in production")
  }
  return "dev-scan-redirect-secret-change-me"
}

export function createScanRedirectToken(passportId: string): { sk: string; skt: string } {
  const skt = String(Math.floor(Date.now() / 1000))
  const sk = createHmac("sha256", secret())
    .update(`${passportId}:${skt}`)
    .digest("base64url")
  return { sk, skt }
}

export function verifyScanRedirectToken(
  passportId: string,
  sk: string | undefined,
  skt: string | undefined
): boolean {
  if (!sk || !skt) return false
  const ts = Number(skt)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > WINDOW_SEC) return false
  const expected = createHmac("sha256", secret())
    .update(`${passportId}:${skt}`)
    .digest("base64url")
  try {
    const a = Buffer.from(sk, "utf8")
    const b = Buffer.from(expected, "utf8")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
