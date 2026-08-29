import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const PASSPORT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const SOURCE_HASH = "abc123hashsource0000000000000001"

const translateTextsToLang = vi.fn()
const isPassportInScope = vi.fn()
const invalidatePassportCache = vi.fn()
const createClient = vi.fn()
const createAdminClient = vi.fn()

vi.mock("@/lib/google-translate", () => ({
  translateTextsToLang: (...args: unknown[]) => translateTextsToLang(...args),
}))

vi.mock("@/backend/modules/organizations/scope", () => ({
  isPassportInScope: (...args: unknown[]) => isPassportInScope(...args),
}))

vi.mock("@/lib/passport-public-cache", () => ({
  invalidatePassportCache: (...args: unknown[]) => invalidatePassportCache(...args),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: (...args: unknown[]) => createAdminClient(...args),
}))

vi.mock("@/lib/passport-eu-translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/passport-eu-translations")>()
  return {
    ...actual,
    // Stable hash so cache-fresh assertions are deterministic in these tests.
    hashTranslationSource: () => SOURCE_HASH,
  }
})

import { POST } from "@/app/api/translate/route"

type PassportRow = {
  id: string
  product_id: string
  translations: unknown
  product: {
    story: string
    materials: string
    origin: string
    lifecycle: string
  }
}

function mockAuthUser(userId: string | null = "user-1") {
  createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
      }),
    },
  })
}

/** Explicit call signature so the `updateImpl ?? fallback` union stays callable. */
type UpdateMock = (payload: unknown) => Promise<{ error: unknown }>

function mockPassportLoad(row: PassportRow | null, updateImpl?: UpdateMock) {
  const update: UpdateMock = updateImpl ?? vi.fn(async () => ({ error: null }))
  createAdminClient.mockReturnValue({
    from: (table: string) => {
      if (table !== "passports") throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: row, error: null }),
          }),
        }),
        update: (payload: unknown) => ({
          eq: async () => {
            await update(payload)
            return { error: null }
          },
        }),
      }
    },
  })
  return update
}

function postTranslate(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

describe("POST /api/translate (caching + Google mock)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthUser("user-1")
    isPassportInScope.mockResolvedValue(true)
    invalidatePassportCache.mockResolvedValue(undefined)
    translateTextsToLang.mockResolvedValue({
      translations: ["coton", "Portugal", "lavage froid", "histoire"],
      characters: 40,
    })
  })

  it("skips Google API when FR cache is fresh and returns cached payload", async () => {
    const cachedFr = {
      materials: "coton bio (cache)",
      origin: "Portugal (cache)",
      care: "lavage froid (cache)",
      sustainability: "histoire (cache)",
    }
    const update = mockPassportLoad({
      id: PASSPORT_ID,
      product_id: "prod-1",
      translations: {
        fr: cachedFr,
        _meta: { sourceHash: SOURCE_HASH, updatedAt: "2026-01-01T00:00:00.000Z" },
      },
      product: {
        story: "histoire",
        materials: "cotton",
        origin: "Portugal",
        lifecycle: "cold wash",
      },
    })

    const res = await postTranslate({
      passportId: PASSPORT_ID,
      targetLangs: ["fr"],
      force: false,
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      cached: string[]
      translated: string[]
      charactersUsed: number
      translations: { fr?: typeof cachedFr }
    }

    expect(json.ok).toBe(true)
    expect(json.cached).toEqual(["fr"])
    expect(json.translated).toEqual([])
    expect(json.charactersUsed).toBe(0)
    expect(json.translations.fr).toEqual(cachedFr)
    expect(translateTextsToLang).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
    expect(invalidatePassportCache).toHaveBeenCalledWith(PASSPORT_ID)
  })

  it("invokes Google for untranslated fields and writes translations back to Supabase", async () => {
    const update = mockPassportLoad({
      id: PASSPORT_ID,
      product_id: "prod-1",
      translations: {
        _meta: { sourceHash: "stale-hash", updatedAt: "2026-01-01T00:00:00.000Z" },
      },
      product: {
        story: "Craft story",
        materials: "organic cotton",
        origin: "Portugal",
        lifecycle: "cold wash",
      },
    })

    translateTextsToLang.mockResolvedValueOnce({
      translations: [
        "coton biologique",
        "Portugal",
        "lavage à froid",
        "Histoire artisanale",
      ],
      characters: 64,
    })

    const res = await postTranslate({
      passportId: PASSPORT_ID,
      targetLangs: ["fr"],
      force: false,
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      cached: string[]
      translated: string[]
      charactersUsed: number
      translations: {
        fr?: {
          materials: string
          origin: string
          care: string
          sustainability: string
        }
        _meta?: { sourceHash?: string }
      }
    }

    expect(json.ok).toBe(true)
    expect(json.translated).toEqual(["fr"])
    expect(json.cached).toEqual([])
    expect(json.charactersUsed).toBe(64)
    expect(translateTextsToLang).toHaveBeenCalledTimes(1)
    expect(translateTextsToLang).toHaveBeenCalledWith(
      ["organic cotton", "Portugal", "cold wash", "Craft story"],
      "fr",
    )
    expect(json.translations.fr).toEqual({
      materials: "coton biologique",
      origin: "Portugal",
      care: "lavage à froid",
      sustainability: "Histoire artisanale",
    })
    expect(json.translations._meta?.sourceHash).toBe(SOURCE_HASH)

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        translations: expect.objectContaining({
          fr: expect.objectContaining({ materials: "coton biologique" }),
          _meta: expect.objectContaining({ sourceHash: SOURCE_HASH }),
        }),
      }),
    )
    expect(invalidatePassportCache).toHaveBeenCalledWith(PASSPORT_ID)
  })

  it("force=true bypasses cache and always calls Google", async () => {
    mockPassportLoad({
      id: PASSPORT_ID,
      product_id: "prod-1",
      translations: {
        fr: {
          materials: "old",
          origin: "old",
          care: "old",
          sustainability: "old",
        },
        _meta: { sourceHash: SOURCE_HASH },
      },
      product: {
        story: "story",
        materials: "cotton",
        origin: "PT",
        lifecycle: "care",
      },
    })

    const res = await postTranslate({
      passportId: PASSPORT_ID,
      targetLangs: ["fr"],
      force: true,
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as { translated: string[]; cached: string[] }
    expect(json.translated).toEqual(["fr"])
    expect(json.cached).toEqual([])
    expect(translateTextsToLang).toHaveBeenCalledTimes(1)
  })

  it("returns 401 when the session is missing", async () => {
    mockAuthUser(null)
    const res = await postTranslate({ passportId: PASSPORT_ID, targetLangs: ["fr"] })
    expect(res.status).toBe(401)
    expect(translateTextsToLang).not.toHaveBeenCalled()
  })

  it("returns 404 when passport is out of scope", async () => {
    isPassportInScope.mockResolvedValueOnce(false)
    const res = await postTranslate({ passportId: PASSPORT_ID, targetLangs: ["fr"] })
    expect(res.status).toBe(404)
    expect(translateTextsToLang).not.toHaveBeenCalled()
  })
})
