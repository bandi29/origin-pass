import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/admin/passports/[id]/export-qr/route"
import { createClient } from "@/lib/supabase/server"
import type { HangtagPassportSource } from "@/lib/hangtag-pdf"

const PASSPORT_ID = "11111111-1111-4111-8111-111111111111"
const PRODUCT_GTIN = "00810012345675"

const loadHangtagPassportSource = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
  })),
}))

vi.mock("@/lib/hangtag-pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hangtag-pdf")>()
  return {
    ...actual,
    loadHangtagPassportSource: (...args: unknown[]) => loadHangtagPassportSource(...args),
  }
})

function defaultSource(overrides: Partial<HangtagPassportSource> = {}): HangtagPassportSource {
  return {
    passportId: PASSPORT_ID,
    productTitle: "Merino Overshirt",
    variantName: "Medium",
    serialNumber: "OP-TEST-001",
    verifyToken: "tok-1",
    passportUid: "uid-1",
    gtin: PRODUCT_GTIN,
    lotNumber: null,
    fallbackUrl: "https://origin-pass.vercel.app/verify/tok-1",
    ...overrides,
  }
}

describe("export-qr functional", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadHangtagPassportSource.mockResolvedValue(defaultSource())
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
    } as Awaited<ReturnType<typeof createClient>>)
  })

  it("QR-01: PNG export returns 300dpi-class image/png attachment", async () => {
    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=png`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="passport-OP-TEST-001-qr-300dpi.png"',
    )
    const body = Buffer.from(await response.arrayBuffer())
    // PNG signature
    expect(body.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(body.length).toBeGreaterThan(200)
  }, 20_000)

  it("QR-02: SVG export returns vector image/svg+xml", async () => {
    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=svg`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml")
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="passport-OP-TEST-001-qr.svg"',
    )
    const text = await response.text()
    expect(text).toContain("<svg")
    expect(text.length).toBeGreaterThan(100)
  }, 20_000)

  it("QR-03: rejects unknown format with 400", async () => {
    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=webp`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(400)
    expect(loadHangtagPassportSource).not.toHaveBeenCalled()
  })

  it("SEC-QR-01: unauthenticated request returns 401", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    } as Awaited<ReturnType<typeof createClient>>)

    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=png`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(401)
    expect(loadHangtagPassportSource).not.toHaveBeenCalled()
  })

  it("SEC-QR-02: out-of-scope passport returns 404 (no asset leak)", async () => {
    loadHangtagPassportSource.mockResolvedValueOnce(null)
    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=png`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type")).not.toContain("image/")
  })

  it("passes optional variantGtin through to hangtag source loader", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/admin/passports/${PASSPORT_ID}/export-qr?format=png&variantGtin=00123456789012`,
      ),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(200)
    expect(loadHangtagPassportSource).toHaveBeenCalledWith(
      "user-1",
      PASSPORT_ID,
      expect.objectContaining({ variantGtin: "00123456789012" }),
    )
  }, 20_000)
})
