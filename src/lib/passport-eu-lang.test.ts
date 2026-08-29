import { describe, expect, it } from "vitest"
import {
  detectPreferredPassportLang,
  detectPreferredPassportLangFromAcceptLanguage,
  isPublicPassportLang,
  parseAcceptLanguageHeader,
  PUBLIC_PASSPORT_LANG_OPTIONS,
} from "./passport-eu-lang"

describe("passport-eu-lang (unit)", () => {
  it("exposes EN + four EU languages with flags for the switcher", () => {
    expect(PUBLIC_PASSPORT_LANG_OPTIONS.map((o) => o.code)).toEqual([
      "en",
      "fr",
      "de",
      "es",
      "it",
    ])
    for (const opt of PUBLIC_PASSPORT_LANG_OPTIONS) {
      expect(opt.flag.length).toBeGreaterThan(0)
      expect(opt.hreflang).toBe(opt.code)
    }
  })

  it("validates public passport language codes", () => {
    expect(isPublicPassportLang("en")).toBe(true)
    expect(isPublicPassportLang("fr")).toBe(true)
    expect(isPublicPassportLang("pt")).toBe(false)
    expect(isPublicPassportLang("")).toBe(false)
  })

  it("detects preferred language from browser locale lists", () => {
    expect(detectPreferredPassportLang(["fr-FR", "en-US"])).toBe("fr")
    expect(detectPreferredPassportLang(["ja-JP", "en"])).toBe("en")
    expect(detectPreferredPassportLang([])).toBe("en")
  })

  it("parses Accept-Language with quality values (highest q first)", () => {
    expect(parseAcceptLanguageHeader("fr-FR,fr;q=0.9,en;q=0.8,de;q=0.7")).toEqual([
      "fr-FR",
      "fr",
      "en",
      "de",
    ])
    expect(parseAcceptLanguageHeader("en;q=0.5,de;q=0.9")).toEqual(["de", "en"])
    expect(parseAcceptLanguageHeader(null)).toEqual([])
    expect(parseAcceptLanguageHeader("   ")).toEqual([])
  })

  it("maps Accept-Language header to a public passport language", () => {
    expect(detectPreferredPassportLangFromAcceptLanguage("it-IT,it;q=0.9,en;q=0.8")).toBe("it")
    expect(detectPreferredPassportLangFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("en")
    expect(detectPreferredPassportLangFromAcceptLanguage(undefined)).toBe("en")
  })
})
