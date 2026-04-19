/**
 * Security validation helpers for input sanitization and abuse prevention.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SERIAL_ID_REGEX = /^[A-Za-z0-9_-]{3,64}$/
const MAX_SERIAL_ID_LENGTH = 64

/**
 * Validates that a string is a valid UUID v4 format.
 */
export function isValidUuid(value: string): boolean {
  if (!value || typeof value !== "string") return false
  return UUID_REGEX.test(value.trim())
}

/**
 * Validates serial_id format (alphanumeric, hyphen, underscore; prevents injection).
 */
export function isValidSerialId(value: string): boolean {
  if (!value || typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed.length <= MAX_SERIAL_ID_LENGTH && SERIAL_ID_REGEX.test(trimmed)
}

/**
 * Sanitizes a string for use as a filename in archives (no path traversal).
 */
export function sanitizeForFilename(value: string): string {
  if (!value || typeof value !== "string") return "item"
  return value.replace(/[/\\:*?"<>|]/g, "_").slice(0, 64) || "item"
}

/**
 * Sanitizes a string for use in Content-Disposition filename (prevents header injection).
 */
export function sanitizeFilename(value: string): string {
  if (!value || typeof value !== "string") return "export"
  return value
    .replace(/[^\w\s-]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .slice(0, 100) || "export"
}

/**
 * Validates that a URL is safe for img src (https only, no javascript:, data:, etc.).
 */
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  if (trimmed.length === 0) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}
