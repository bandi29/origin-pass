import { describe, expect, it } from "vitest"
import {
  englishSourceFromProduct,
  hashTranslationSource,
  isLangCacheFresh,
  nonemptySourceFields,
  parseTranslationsColumn,
} from "@/lib/passport-eu-translations"
import { detectPreferredPassportLang } from "@/lib/passport-eu-lang"

describe("passport-eu-translations", () => {
  it("maps EN product fields to DPP keys", () => {
    expect(
      englishSourceFromProduct({
        story: "Sustainable leather",
        materials: "Cowhide",
        origin: "Italy",
        lifecycle: "Hand wash",
      }),
    ).toEqual({
      materials: "Cowhide",
      origin: "Italy",
      care: "Hand wash",
      sustainability: "Sustainable leather",
    })
  })

  it("hashes source stably and detects stale cache", () => {
    const source = {
      materials: "Cotton",
      origin: "Portugal",
      care: "Cold wash",
      sustainability: "Organic",
    }
    const hash = hashTranslationSource(source)
    expect(hash).toHaveLength(32)
    expect(nonemptySourceFields(source)).toHaveLength(4)

    const column = parseTranslationsColumn({
      fr: source,
      _meta: { sourceHash: hash },
    })
    expect(isLangCacheFresh(column, "fr", hash)).toBe(true)
    expect(isLangCacheFresh(column, "fr", "other")).toBe(false)
    expect(isLangCacheFresh(column, "de", hash)).toBe(false)
  })

  it("detects preferred EU language from browser locales", () => {
    expect(detectPreferredPassportLang(["fr-FR", "en-US"])).toBe("fr")
    expect(detectPreferredPassportLang(["de"])).toBe("de")
    expect(detectPreferredPassportLang(["ja-JP", "en"])).toBe("en")
  })
})
