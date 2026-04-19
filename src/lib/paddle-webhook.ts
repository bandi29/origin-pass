import { createHmac, timingSafeEqual } from "crypto"

const REPLAY_TOLERANCE_SECONDS = 300 // 5 minutes

/**
 * Parses Paddle-Signature header: "ts=1671552777;h1=eb4d0dc8..."
 */
function parseSignature(header: string): { ts: number; h1: string } | null {
  const parts = header.split(";")
  let ts: number | null = null
  let h1: string | null = null
  for (const part of parts) {
    const [key, value] = part.trim().split("=")
    if (key === "ts") ts = parseInt(value ?? "", 10)
    if (key === "h1") h1 = value ?? null
  }
  if (ts == null || !h1) return null
  return { ts, h1 }
}

/**
 * Verifies Paddle webhook signature and prevents replay attacks.
 * Returns true if valid.
 */
export function verifyPaddleWebhook(
  rawBody: string,
  signatureHeader: string,
  secretKey: string
): boolean {
  if (!secretKey || !signatureHeader || !rawBody) return false

  const parsed = parseSignature(signatureHeader)
  if (!parsed) return false

  const { ts, h1 } = parsed

  // Replay protection: reject if timestamp is too old
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > REPLAY_TOLERANCE_SECONDS) {
    return false
  }

  // Build signed payload: "ts:body"
  const signedPayload = `${ts}:${rawBody}`

  // Compute expected signature
  const expected = createHmac("sha256", secretKey)
    .update(signedPayload)
    .digest("hex")

  // Timing-safe comparison
  if (expected.length !== h1.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(h1, "hex"))
  } catch {
    return false
  }
}
