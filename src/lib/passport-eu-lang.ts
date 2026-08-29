/** Client-safe EU passport language helpers (no Node builtins). */

export const EU_TRANSLATE_LANGS = ["fr", "de", "es", "it"] as const
export type EuTranslateLang = (typeof EU_TRANSLATE_LANGS)[number]

export type PublicPassportLang = "en" | EuTranslateLang

export const PUBLIC_PASSPORT_LANG_OPTIONS: ReadonlyArray<{
  code: PublicPassportLang
  /**
   * Endonym (the language's own name), not a two-letter code — a shopper scanning
   * a QR abroad recognises "Français" far faster than "FR". Rendered as
   * `{flag} {label}` in the public passport language switcher.
   */
  label: string
  /** Flag emoji for the public language switcher. */
  flag: string
  hreflang: string
}> = [
  { code: "en", label: "English", flag: "🇬🇧", hreflang: "en" },
  { code: "fr", label: "Français", flag: "🇫🇷", hreflang: "fr" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", hreflang: "de" },
  { code: "es", label: "Español", flag: "🇪🇸", hreflang: "es" },
  { code: "it", label: "Italiano", flag: "🇮🇹", hreflang: "it" },
]

const EU_SET = new Set<string>(EU_TRANSLATE_LANGS)

export function isEuTranslateLang(code: string): code is EuTranslateLang {
  return EU_SET.has(code)
}

export function isPublicPassportLang(code: string): code is PublicPassportLang {
  return code === "en" || isEuTranslateLang(code)
}

/**
 * Pick the best passport language from the visitor's browser locales.
 * Falls back to `en` when no EU language matches.
 */
export function detectPreferredPassportLang(
  languages: readonly string[] | undefined = typeof navigator !== "undefined"
    ? navigator.languages
    : undefined,
): PublicPassportLang {
  const list = languages?.length ? languages : ["en"]
  for (const raw of list) {
    const base = raw.trim().toLowerCase().split("-")[0] ?? ""
    if (isPublicPassportLang(base)) return base
  }
  return "en"
}

/**
 * Parse an HTTP `Accept-Language` header into ordered language tags
 * (e.g. `fr-FR,fr;q=0.9,en;q=0.8` → `["fr-FR","fr","en"]`).
 */
export function parseAcceptLanguageHeader(header: string | null | undefined): string[] {
  if (!header?.trim()) return []
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";")
      let q = 1
      for (const p of params) {
        const m = /q\s*=\s*([0-9.]+)/i.exec(p)
        if (m) q = Number(m[1]) || 0
      }
      return { tag: (tag ?? "").trim(), q }
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag)
}

/** Server-side preferred lang from Accept-Language (falls back to `en`). */
export function detectPreferredPassportLangFromAcceptLanguage(
  header: string | null | undefined,
): PublicPassportLang {
  return detectPreferredPassportLang(parseAcceptLanguageHeader(header))
}
