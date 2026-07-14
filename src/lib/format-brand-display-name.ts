/**
 * Turn raw profile / auth strings (e.g. "bandi.vijaykumar") into a readable brand label.
 */
export function formatBrandDisplayName(raw: string | null | undefined): string {
  const trimmed = raw?.trim()
  if (!trimmed) return "Atelier"

  if (/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
    return formatBrandDisplayName(trimmed.split("@")[0])
  }

  const looksTechnical =
    trimmed.includes(".") ||
    trimmed.includes("_") ||
    (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed))

  if (looksTechnical) {
    const parts = trimmed.split(/[._-]+/).filter(Boolean)
    if (parts.length > 1) {
      return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
    }
  }

  return trimmed
}
