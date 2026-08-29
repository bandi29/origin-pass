import { createHash } from "node:crypto"
import type { PassportTranslationFields } from "@/lib/passport-eu-fields"

export * from "@/lib/passport-eu-fields"
export * from "@/lib/passport-eu-lang"

/** Server-only source hash for cache invalidation. */
export function hashTranslationSource(source: PassportTranslationFields): string {
  const canonical = JSON.stringify({
    materials: source.materials,
    origin: source.origin,
    care: source.care,
    sustainability: source.sustainability,
  })
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32)
}
