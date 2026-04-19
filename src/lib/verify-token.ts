/**
 * Secure token generation for QR verification URLs.
 * Tokens are non-guessable and cannot be reverse-engineered to passport ID.
 *
 * Format: base64url(32 random bytes) → ~43 chars, URL-safe
 * Entropy: 256 bits
 */

import { randomBytes } from "crypto"

const TOKEN_BYTES = 32

/**
 * Generate a cryptographically secure verification token.
 * Use for QR codes and /verify/{token} URLs.
 */
export function generateVerifyToken(): string {
  const bytes = randomBytes(TOKEN_BYTES)
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * Validate token format (base64url: alphanumeric, hyphen, underscore; 32-64 chars).
 */
export function isValidVerifyToken(value: string): boolean {
  if (!value || typeof value !== "string") return false
  const trimmed = value.trim()
  return /^[A-Za-z0-9_-]{32,64}$/.test(trimmed) && trimmed.length >= 32
}
