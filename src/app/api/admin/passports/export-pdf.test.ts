import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/admin/passports/[id]/export-pdf/route"
import {
  hangtagPdfFilename,
  isHangtagLayoutType,
  renderHangtagPdf,
  resolveHangtagScanUrl,
  type HangtagPassportSource,
} from "@/lib/hangtag-pdf"
import { LAYOUT_PAGE_SIZE, type PrintLabelData } from "@/components/pdf/PrintLayouts"
import { buildGs1QrTargetUrl } from "@/lib/pdf-qr"
import { createClient } from "@/lib/supabase/server"

const PASSPORT_ID = "11111111-1111-4111-8111-111111111111"
const PRODUCT_GTIN = "00810012345675"
const VARIANT_GTIN = "00123456789012"

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

const SAMPLE_LABEL: PrintLabelData = {
  productTitle: "Merino Overshirt",
  variantName: "Medium",
  serialNumber: "OP-1",
  scanUrl: `https://id.originpass.app/01/${PRODUCT_GTIN}`,
  linkType: "gs1",
  gtinDisplay: PRODUCT_GTIN,
  gtinAi01: `(01) ${PRODUCT_GTIN}`,
  qrDataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  footerText: "EU Digital Product Passport",
}

function defaultSource(overrides: Partial<HangtagPassportSource> = {}): HangtagPassportSource {
  return {
    passportId: PASSPORT_ID,
    productTitle: "Merino Overshirt",
    variantName: "Variant Medium",
    serialNumber: "OP-TEST-001",
    verifyToken: "tok-1",
    passportUid: "uid-1",
    gtin: PRODUCT_GTIN,
    lotNumber: null,
    fallbackUrl: "https://origin-pass.vercel.app/verify/tok-1",
    ...overrides,
  }
}

describe("export-pdf helpers", () => {
  it("accepts supported layout types", () => {
    expect(isHangtagLayoutType("hangtag-2x3")).toBe(true)
    expect(isHangtagLayoutType("avery-5160")).toBe(true)
    expect(isHangtagLayoutType("thermal-4x6")).toBe(true)
    expect(isHangtagLayoutType("poster")).toBe(false)
  })

  it("names attachments passport-{gtin}-{layoutType}.pdf", () => {
    expect(hangtagPdfFilename(PRODUCT_GTIN, "OP-1", "hangtag-2x3")).toBe(
      `passport-${PRODUCT_GTIN}-hangtag-2x3.pdf`,
    )
    expect(hangtagPdfFilename(null, "OP-99", "avery-5160")).toBe("passport-OP-99-avery-5160.pdf")
  })

  it("defines exact physical page sizes in PDF points", () => {
    expect(LAYOUT_PAGE_SIZE["hangtag-2x3"]).toEqual({ width: 144, height: 216, label: '2x3" Hangtag' })
    expect(LAYOUT_PAGE_SIZE["thermal-4x6"]).toEqual({ width: 288, height: 432, label: '4x6" Thermal' })
    expect(LAYOUT_PAGE_SIZE["avery-5160"]).toEqual({
      width: 612,
      height: 792,
      label: "Avery 5160 Sheet",
    })
  })
})

describe("PDF regression scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadHangtagPassportSource.mockImplementation(
      async (_userId: string, _passportId: string, options?: { variantGtin?: string | null }) => {
        const override = options?.variantGtin?.trim()
        if (override === VARIANT_GTIN) {
          return defaultSource({
            gtin: VARIANT_GTIN,
            variantName: "Variant Large",
          })
        }
        return defaultSource()
      },
    )
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "user-1" } } }),
      },
    } as Awaited<ReturnType<typeof createClient>>)
  })

  it("PDF-01: hangtag-2x3 returns 200 application/pdf with Content-Disposition and non-empty buffer", async () => {
    const request = new Request(
      `http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=hangtag-2x3`,
    )
    const response = await GET(request, { params: Promise.resolve({ id: PASSPORT_ID }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("application/pdf")
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="passport-${PRODUCT_GTIN}-hangtag-2x3.pdf"`,
    )
    const body = Buffer.from(await response.arrayBuffer())
    expect(body.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(body.length).toBeGreaterThan(500)
    expect(body.toString("latin1")).toContain("/MediaBox [0 0 144 216]")
  }, 30_000)

  it("PDF-02: thermal-4x6 and avery-5160 render exact canvas MediaBox sizes without throwing", async () => {
    const thermal = await renderHangtagPdf("thermal-4x6", SAMPLE_LABEL)
    expect(thermal.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(thermal.toString("latin1")).toContain("/MediaBox [0 0 288 432]")

    const avery = await renderHangtagPdf("avery-5160", SAMPLE_LABEL)
    expect(avery.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(avery.toString("latin1")).toContain("/MediaBox [0 0 612 792]")

    for (const layoutType of ["thermal-4x6", "avery-5160"] as const) {
      const response = await GET(
        new Request(
          `http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=${layoutType}`,
        ),
        { params: Promise.resolve({ id: PASSPORT_ID }) },
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toBe("application/pdf")
      expect(response.headers.get("Content-Disposition")).toContain(
        `passport-${PRODUCT_GTIN}-${layoutType}.pdf`,
      )
      const body = Buffer.from(await response.arrayBuffer())
      expect(body.length).toBeGreaterThan(500)
    }
  }, 60_000)

  it("PDF-03: variantGtin drives GS1 Digital Link QR target and variant title on the label", async () => {
    const prev = process.env.GS1_DIGITAL_LINK_DOMAIN
    process.env.GS1_DIGITAL_LINK_DOMAIN = "id.originpass.app"

    const expectedUrl = buildGs1QrTargetUrl({ gtin: VARIANT_GTIN, serial: "OP-TEST-001" })
    expect(expectedUrl).toBe(`https://id.originpass.app/01/${VARIANT_GTIN}/21/OP-TEST-001`)

    const source = defaultSource({ gtin: VARIANT_GTIN, variantName: "Variant Large" })
    expect(source.variantName).toBe("Variant Large")
    const resolved = resolveHangtagScanUrl(source)
    expect(resolved.linkType).toBe("gs1")
    expect(resolved.url).toBe(expectedUrl)
    expect(resolved.gtinDisplay).toBe(VARIANT_GTIN)

    // Label payload carries variant title + AI(01) GTIN into the renderer.
    const label: PrintLabelData = {
      ...SAMPLE_LABEL,
      variantName: source.variantName,
      gtinDisplay: resolved.gtinDisplay,
      gtinAi01: `(01) ${VARIANT_GTIN}`,
      scanUrl: resolved.url,
    }
    expect(label.variantName).toBe("Variant Large")
    expect(label.gtinAi01).toBe(`(01) ${VARIANT_GTIN}`)
    expect(label.scanUrl).toContain(`/01/${VARIANT_GTIN}`)

    const buf = await renderHangtagPdf("hangtag-2x3", label)
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF")
    expect(buf.length).toBeGreaterThan(500)

    const response = await GET(
      new Request(
        `http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=hangtag-2x3&variantGtin=${VARIANT_GTIN}`,
      ),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(200)
    expect(loadHangtagPassportSource).toHaveBeenCalledWith(
      "user-1",
      PASSPORT_ID,
      expect.objectContaining({ variantGtin: VARIANT_GTIN }),
    )
    expect(response.headers.get("Content-Disposition")).toContain(
      `passport-${VARIANT_GTIN}-hangtag-2x3.pdf`,
    )
    expect(response.headers.get("X-OriginPass-Link-Type")).toBe("gs1")

    process.env.GS1_DIGITAL_LINK_DOMAIN = prev
  }, 30_000)

  it("SEC-02: export-pdf without session returns 401 Unauthorized", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    } as Awaited<ReturnType<typeof createClient>>)

    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=hangtag-2x3`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(401)
    expect(loadHangtagPassportSource).not.toHaveBeenCalled()
  })

  it("SEC-03: authenticated user cannot export a passport outside their scope (IDOR)", async () => {
    // Session is valid, but the passport is not in the user's org/brand scope, so
    // loadHangtagPassportSource (which runs isPassportInScope) returns null. The
    // route must 404 and must NOT emit a PDF — no cross-tenant data leak.
    loadHangtagPassportSource.mockResolvedValueOnce(null)

    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=hangtag-2x3`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type")).not.toContain("application/pdf")
    // The scope check must be invoked with the authenticated user's id, never a param.
    expect(loadHangtagPassportSource).toHaveBeenCalledWith("user-1", PASSPORT_ID, expect.anything())
  })

  it("rejects an unknown layoutType with 400", async () => {
    const response = await GET(
      new Request(`http://localhost/api/admin/passports/${PASSPORT_ID}/export-pdf?layoutType=poster`),
      { params: Promise.resolve({ id: PASSPORT_ID }) },
    )
    expect(response.status).toBe(400)
  })
})
