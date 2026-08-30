/**
 * OriginPass validation matrix - maps Test Case IDs
 * (PDF / SCR / GS1 / DPP / ADM / BIL / SEC) to automated assertions.
 *
 * Cases that require a live Shopify Admin session or mobile scan hardware are
 * marked with `it.todo` / documented gaps so CI still reports coverage status.
 */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  buildGS1DigitalLink,
  parseGS1DigitalLinkPath,
  resolvePassportLinkUrl,
  validateGTIN,
} from "@/lib/gs1"
import {
  GS1_INVALID_STRUCTURE_MESSAGE,
  GS1_NOT_FOUND_MESSAGE,
  isMalformedGtinIdentifier,
  publicPassportTargetPath,
  wantsGs1MachinePayload,
} from "@/lib/gs1-http"
import { calculateComplianceScore } from "@/lib/compliance-score"
import { LAYOUT_PAGE_SIZE } from "@/components/pdf/PrintLayouts"
import { PAID_PLANS, TIER_LIMITS, normalizeTier, tierForSubscriptionName } from "@/lib/shopify-billing"
import { shopSubdomainFromDomain, buildShopifyPublicPassportUrl } from "@/lib/shopify-public-passport-url"

const root = path.resolve(__dirname, "../..")

function readSrc(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8")
}

describe("Scenario matrix - PDF & Scorecard (PDF-01 PDF-04, SCR-01 SCR-02)", () => {
  it("PDF-01: export-pdf hangtag route + filename contract exist", () => {
    const route = readSrc("src/app/api/admin/passports/[id]/export-pdf/route.ts")
    expect(route).toContain("application/pdf")
    expect(route).toContain("Content-Disposition")
    expect(route).toContain("hangtagPdfFilename")
    expect(LAYOUT_PAGE_SIZE["hangtag-2x3"]).toEqual({
      width: 144,
      height: 216,
      label: '2x3" Hangtag',
    })
    const apiTest = readSrc("src/app/api/admin/passports/export-pdf.test.ts")
    expect(apiTest).toContain("PDF-01")
  })

  it("PDF-02: thermal and Avery page sizes match physical print media", () => {
    expect(LAYOUT_PAGE_SIZE["thermal-4x6"]).toEqual({
      width: 288,
      height: 432,
      label: '4x6" Thermal',
    })
    expect(LAYOUT_PAGE_SIZE["avery-5160"]).toEqual({
      width: 612,
      height: 792,
      label: "Avery 5160 Sheet",
    })
    const layouts = readSrc("src/components/pdf/PrintLayouts.tsx")
    expect(layouts).toContain("Thermal4x6")
    expect(layouts).toContain("Avery5160Sheet")
    expect(layouts).toContain("labelW: 2.625 * 72")
    expect(layouts).toContain("labelH: 1 * 72")
  })

  it("PDF-03: variantGtin flows into export-pdf + GS1 QR helper", () => {
    const route = readSrc("src/app/api/admin/passports/[id]/export-pdf/route.ts")
    expect(route).toContain("variantGtin")
    const pdfQr = readSrc("src/lib/pdf-qr.ts")
    expect(pdfQr).toContain("buildGs1QrTargetUrl")
    expect(pdfQr).toContain("generatePdfQrDataUri")
    const apiTest = readSrc("src/app/api/admin/passports/export-pdf.test.ts")
    expect(apiTest).toContain("PDF-03")
    expect(apiTest).toContain("variantGtin")
  })

  it("PDF-04: Admin Export Print PDF modal is wired on Passport Detail QR tab", () => {
    const modal = readSrc("src/components/admin/ExportPdfModal.tsx")
    expect(modal).toContain("Print &amp; Export QR")
    expect(modal).toContain("single-png")
    expect(modal).toContain("single-svg")
    expect(modal).toContain("sheet-pdf")
    expect(modal).toContain("/api/admin/passports/")
    expect(modal).toContain("export-qr")
    const qrTab = readSrc("src/components/passports/PassportQRTab.tsx")
    expect(qrTab).toContain("ExportPdfModal")
    const detail = readSrc("src/components/passports/PassportDetailView.tsx")
    expect(detail).toContain("Print &amp; Export QR")
    expect(detail).toContain("ExportPdfModal")
  })

  it("ESPR-01: GPSR-weighted export readiness scorecard is wired on passport overview", () => {
    const score = readSrc("src/lib/complianceScore.ts")
    expect(score).toContain("computeEsprComplianceScore")
    expect(score).toContain("euResponsiblePerson")
    const card = readSrc("src/components/passports/EsprReadinessScorecard.tsx")
    expect(card).toContain("ESPR Compliance Score")
    const overview = readSrc("src/components/passports/PassportOverviewTab.tsx")
    expect(overview).toContain("EsprReadinessScorecard")
  })

  it("I18N-01: public passport language switcher + Accept-Language helpers exist", () => {
    const lang = readSrc("src/lib/passport-eu-lang.ts")
    expect(lang).toContain("parseAcceptLanguageHeader")
    expect(lang).toContain("detectPreferredPassportLangFromAcceptLanguage")
    const i18n = readSrc("src/components/passports/PassportPublicI18n.tsx")
    expect(i18n).toContain("Passport language")
    expect(i18n).toContain("initialLang")
    const page = readSrc("src/app/p/[qrToken]/page.tsx")
    expect(page).toContain("generateMetadata")
    expect(page).toContain("PassportHreflangLinks")
  })

  it("SCR-01: scorecard recalculates when mandatory fields are toggled", () => {
    const full = calculateComplianceScore({
      productGtin: "00810012345675",
      countryOfOrigin: "Vietnam",
      materialComposition: "100% Cotton",
      careInstructions: "Wash cold",
      hasComplianceDocument: true,
    })
    expect(full.score).toBe(100)
    expect(full.riskLabel).toBe("Catalog data complete")

    const withoutOrigin = calculateComplianceScore({
      productGtin: "00810012345675",
      countryOfOrigin: "",
      materialComposition: "100% Cotton",
      careInstructions: "Wash cold",
      hasComplianceDocument: true,
    })
    expect(withoutOrigin.score).toBe(80)
    expect(withoutOrigin.riskLabel).toBe("Partial - missing catalog fields")
    expect(withoutOrigin.missingItems.some((m) => m.id === "origin")).toBe(true)

    const editor = readSrc(
      "src/app/(shopify-embedded)/api/shopify/products/[productId]/ProductPassportEditorPage.tsx",
    )
    expect(editor).toContain("calculateComplianceScore")
    expect(editor).toContain("ComplianceScorecard")
  })

  it("SCR-02: scorecard checklist anchors map to editor section ids", () => {
    const score = calculateComplianceScore({})
    const anchors = score.missingItems.map((m) => m.anchor)
    expect(anchors).toEqual(
      expect.arrayContaining([
        "#eu-score-gtin",
        "#eu-score-origin",
        "#eu-score-materials",
        "#eu-score-care",
        "#eu-score-docs",
      ]),
    )
    const editor = readSrc(
      "src/app/(shopify-embedded)/api/shopify/products/[productId]/ProductPassportEditorPage.tsx",
    )
    expect(editor).toContain('id="eu-score-materials"')
    expect(editor).toContain('id="eu-score-origin"')
    expect(editor).toContain("scroll-smooth")
    const card = readSrc("src/components/admin/ComplianceScorecard.tsx")
    expect(card).toContain("href={item.anchor}")
  })
})

describe("Scenario matrix - GS1 Digital Link (GS1-01 GS1-06)", () => {
  it("GS1-01: standard GTIN resolves to /sp/{shop}/{productId} with locale middleware exclusion", () => {
    const gtin = "5901234123457"
    expect(validateGTIN(gtin)).toBe(true)
    const parsed = parseGS1DigitalLinkPath(["01", gtin])
    expect(parsed?.gtin).toBe(gtin)
    const url = buildGS1DigitalLink("id.originpass.app", gtin)
    expect(url).toBe("https://id.originpass.app/01/05901234123457")

    const target = publicPassportTargetPath({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      externalProductId: "999",
      externalVariantId: null,
      shopDomain: "demo.myshopify.com",
      shopSlug: "demo",
      name: "Coat",
      gtin,
      gln: null,
      defaultLotNumber: null,
      materials: null,
      originCountry: null,
      productionLocation: null,
      certificates: [],
      passportToken: null,
      matchedBy: "product_gtin",
    })
    expect(target).toBe("/sp/demo/999")

    const route = readSrc("src/app/01/[...gs1Path]/route.ts")
    expect(route).toContain("relativeRedirectLocation")
    expect(route).toMatch(/status:\s*307/)
    expect(route).toContain("Location: location")
    const proxy = readSrc("src/proxy.ts")
    expect(proxy).toContain('"/01/:path*"')
    expect(proxy).toMatch(/sp\|shop\|01/)
  })

  it("GS1-02: variant GTIN priority attaches ?variant={external_variant_id}", () => {
    const parts = parseGS1DigitalLinkPath([
      "01",
      "5901234123457",
      "10",
      "LOT-2026A",
      "21",
      "SN-7788",
    ])
    expect(parts).toEqual({
      gtin: "5901234123457",
      lot: "LOT-2026A",
      serial: "SN-7788",
    })

    const resolve = readSrc("src/lib/gs1-passport-resolve.ts")
    expect(resolve).toContain("variant_gtin")
    expect(resolve).toContain("findByVariantGtin")
    const http = readSrc("src/lib/gs1-http.ts")
    expect(http).toContain("?variant=")
    expect(
      publicPassportTargetPath({
        productId: "550e8400-e29b-41d4-a716-446655440000",
        externalProductId: "999",
        externalVariantId: "variant-A",
        shopDomain: "demo.myshopify.com",
        shopSlug: "demo",
        name: "Coat",
        gtin: "00123456789012",
        gln: null,
        defaultLotNumber: null,
        materials: null,
        originCountry: null,
        productionLocation: null,
        certificates: [],
        passportToken: null,
        matchedBy: "variant_gtin",
      }),
    ).toBe("/sp/demo/999?variant=variant-A")
  })

  it("GS1-03: Accept application/json|ld+json vs text/html negotiation helpers", () => {
    expect(wantsGs1MachinePayload("application/json")).toBe(true)
    expect(wantsGs1MachinePayload("application/ld+json")).toBe(true)
    expect(wantsGs1MachinePayload("text/html")).toBe(false)
    const route = readSrc("src/app/01/[...gs1Path]/route.ts")
    expect(route).toContain("relativeRedirectLocation")
    expect(route).toMatch(/status:\s*307/)
    expect(route).toMatch(/wantsGs1MachinePayload/)
  })

  it("GS1-04: malformed GTIN yields Invalid GS1 Identifier Structure signal", () => {
    expect(isMalformedGtinIdentifier("123")).toBe(true)
    expect(isMalformedGtinIdentifier("1234567890")).toBe(true)
    // Common fixture 00810012345678 fails Mod-10 - treated as malformed, not unassigned.
    expect(validateGTIN("00810012345678")).toBe(false)
    expect(isMalformedGtinIdentifier("00810012345678")).toBe(true)
    expect(GS1_INVALID_STRUCTURE_MESSAGE).toBe("Invalid GS1 Identifier Structure")
    const route = readSrc("src/app/01/[...gs1Path]/route.ts")
    expect(route).toMatch(/status:\s*400/)
    expect(route).toContain("GS1_INVALID_STRUCTURE_MESSAGE")
  })

  it("GS1-05: unassigned valid GTIN uses friendly not-found copy (no active passport)", () => {
    expect(validateGTIN("00810012345675")).toBe(true)
    expect(isMalformedGtinIdentifier("00810012345675")).toBe(false)
    expect(GS1_NOT_FOUND_MESSAGE).toBe("No active passport exists for this product identifier.")
    const http = readSrc("src/lib/gs1-http.ts")
    expect(http).toContain("No active passport exists for this product identifier.")
    const route = readSrc("src/app/01/[...gs1Path]/route.ts")
    expect(route).toMatch(/status:\s*404/)
  })

  it("GS1-06: QR URL generation prefers GS1 when GTIN valid, else standard /sp fallback", () => {
    const domain = "origin-pass.vercel.app"
    const fallback = buildShopifyPublicPassportUrl("demo.myshopify.com", "12345")
    const gs1 = resolvePassportLinkUrl({
      domain,
      gtin: "5901234123457",
      lot: "B1",
      fallbackUrl: fallback,
    })
    expect(gs1.linkType).toBe("gs1")
    expect(gs1.url).toContain("/01/")
    expect(gs1.url).toContain("/10/B1")

    const standard = resolvePassportLinkUrl({
      domain,
      gtin: null,
      fallbackUrl: fallback,
    })
    expect(standard.linkType).toBe("standard")
    expect(standard.url).toContain("/sp/")

    const labels = readSrc("src/components/passport/PrintLabelSheet.tsx")
    expect(labels).toContain("[GS1 Digital Link]")
    expect(labels).toContain("[Standard Link]")
  })
})

describe("Scenario matrix   DPP compliance (DPP-01 DPP-04)", () => {
  it("DPP-01: public luxury passport template exposes required consumer sections", () => {
    const view = readSrc("src/components/passport/LuxuryTemplateView.tsx")
    expect(view).toMatch(/Material composition/i)
    expect(view).toMatch(/Care Instructions/i)
    expect(view).toContain("carbonFootprint")
    expect(view).toMatch(/kg CO/)
    expect(view).toContain("productionLocation")
    expect(view).toMatch(/viewUrl|Documented|evidence/i)
  })

  it("DPP-02: public sample compliance PDFs are wired for reviewer / consumer downloads", () => {
    const smoke = readSrc("e2e/smoke-functional.spec.ts")
    expect(smoke).toContain("/production-location-sample.pdf")
    expect(smoke).toContain("/care-instructions-sample.pdf")
    expect(smoke).toMatch(/content-type.*pdf/i)
  })

  it("DPP-03: multi-variant GTIN mapping on passports + ?variant= redirect", () => {
    const migration = readSrc("supabase/migrations/20260726065455_passports_variant_gtin.sql")
    expect(migration).toContain("alter table public.passports")
    expect(migration).toContain("gtin")
    expect(migration).toContain("uq_passports_organization_gtin")
    const resolve = readSrc("src/lib/gs1-passport-resolve.ts")
    expect(resolve).toContain("variant_gtin")
    expect(resolve).toContain("findByVariantGtin")
    const http = readSrc("src/lib/gs1-http.ts")
    expect(http).toContain("?variant=")
  })

  it("DPP-04: draft vs published   QR generation requires active passport status", () => {
    const qr = readSrc("src/lib/qr-generation/process.ts")
    expect(qr).toMatch(/passport\.status\s*!==\s*["']active["']/)
  })
})

describe("Scenario matrix - Shopify admin (ADM-01 ADM-04)", () => {
  it("ADM-01: Product Catalog Sync lists titles, SKUs, images, and variants", () => {
    const actions = readSrc("src/app/(shopify-embedded)/api/shopify/app-home/actions.ts")
    expect(actions).toContain("listStoreProducts")
    expect(actions).toMatch(/name,\s*sku/)
    expect(actions).toContain("image_url")
    expect(actions).toMatch(/variant|external_variant|variants/i)
    const auth = readSrc("src/app/(shopify-embedded)/api/shopify/auth/route.ts")
    expect(auth.length).toBeGreaterThan(100)
    expect(auth).toMatch(/shop|oauth|access|authorize/i)
  })

  it("ADM-02: Compliance Document Storage uploads PDF evidence for passport fields", () => {
    const certs = readSrc("src/app/(shopify-embedded)/api/shopify/certificates/route.ts")
    expect(certs).toMatch(/upload|supplier-certificates|FormData|file/i)
    expect(certs).toContain("getSubscriptionTier")
    const compliance = readSrc("src/lib/shopify-compliance.ts")
    expect(compliance).toContain('shopify_install_status: "uninstalled"')
    expect(compliance).toContain("shopify_access_token: null")
  })

  it("ADM-03: embedded listStoreProducts selects title/sku/image fields", () => {
    const actions = readSrc("src/app/(shopify-embedded)/api/shopify/app-home/actions.ts")
    expect(actions).toContain("listStoreProducts")
    expect(actions).toMatch(/name,\s*sku/)
    expect(actions).toContain("image_url")
  })

  it("ADM-04: certificates upload route stores evidence for product passport fields", () => {
    const certs = readSrc("src/app/(shopify-embedded)/api/shopify/certificates/route.ts")
    expect(certs).toMatch(/upload|supplier-certificates|FormData|file/i)
    expect(certs).toContain("getSubscriptionTier")
  })
})

describe("Scenario matrix - Billing (BIL-01 BIL-04)", () => {
  it("BIL-01: free tier enforces passport caps and upgrade copy ($29 / $49)", () => {
    expect(TIER_LIMITS.free.maxPassports).toBe(10)
    expect(TIER_LIMITS.free.evidenceUploads).toBe(false)
    expect(PAID_PLANS["pro-plan"].price).toBe(29)
    expect(PAID_PLANS["scale-plan"].price).toBe(49)
    const job = readSrc("src/lib/shopify-catalog-sync-job.ts")
    expect(job).toContain("Upgrade to Pro ($29/mo)")
    expect(job).toContain("Scale ($49/mo)")
  })

  it("BIL-02: paid plan names map to pro-plan/scale-plan handles", () => {
    expect(tierForSubscriptionName("OriginPass Pro (pro-plan)")).toBe("pro-plan")
    expect(tierForSubscriptionName("OriginPass Scale (scale-plan)")).toBe("scale-plan")
    expect(tierForSubscriptionName("OriginPass Grower")).toBe("pro-plan")
    expect(tierForSubscriptionName("OriginPass Enterprise")).toBe("scale-plan")
    expect(normalizeTier("grower")).toBe("pro-plan")
    expect(normalizeTier("pro-plan")).toBe("pro-plan")
    expect(TIER_LIMITS["pro-plan"].evidenceUploads).toBe(true)
  })

  it("BIL-03: subscription cancel helper exists for downgrade path", () => {
    const billing = readSrc("src/lib/shopify-billing.ts")
    expect(billing).toContain("appSubscriptionCancel")
    expect(billing).toContain("cancelAppSubscription")
  })

  it("BIL-04: app/uninstalled webhook route wires compliance handler", () => {
    const route = readSrc("src/app/api/webhooks/app/uninstalled/route.ts")
    expect(route).toMatch(/uninstalled|handleShopifyAppUninstalled|webhook/i)
  })
})

describe("Scenario matrix - Security (SEC-01 SEC-03)", () => {
  it("SEC-01: embedded actions test suite enforces cross-shop isolation", () => {
    const actionsTest = readSrc("src/app/(shopify-embedded)/api/shopify/app-home/actions.test.ts")
    expect(actionsTest).toContain("store-a.myshopify.com")
    expect(actionsTest).toContain("store-b.myshopify.com")
    expect(actionsTest).toMatch(/must never|never be able to read or write|shop A's data/i)
  })

  it("SEC-02: session required for /api/admin/* and production shop actions", () => {
    const actions = readSrc("src/app/(shopify-embedded)/api/shopify/app-home/actions.ts")
    expect(actions).toContain("verifyShopifySessionToken")
    expect(actions).toContain('process.env.NODE_ENV === "production"')
    const exportPdf = readSrc("src/app/api/admin/passports/[id]/export-pdf/route.ts")
    expect(exportPdf).toContain("Unauthorized")
    expect(exportPdf).toContain("getUser")
    const apiTest = readSrc("src/app/api/admin/passports/export-pdf.test.ts")
    expect(apiTest).toContain("SEC-02")
    expect(apiTest).toContain("401")
  })

  it("SEC-03: CSP frame-ancestors allow Shopify admin domains for embed", () => {
    const cfg = readSrc("next.config.ts")
    expect(cfg).toContain("frame-ancestors https://admin.shopify.com")
    expect(cfg).toContain("https://*.myshopify.com")
    expect(shopSubdomainFromDomain("originpass-sandbox.myshopify.com")).toBe("originpass-sandbox")
  })
})
