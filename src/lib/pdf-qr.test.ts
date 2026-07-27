import { describe, expect, it } from "vitest"
import {
  buildGs1QrTargetUrl,
  formatGtinAi01,
  generatePdfQrDataUri,
  gs1DigitalLinkDomain,
} from "@/lib/pdf-qr"

describe("pdf-qr", () => {
  it("builds a GS1 Digital Link URL for a valid GTIN", () => {
    const prev = process.env.GS1_DIGITAL_LINK_DOMAIN
    process.env.GS1_DIGITAL_LINK_DOMAIN = "id.originpass.app"
    expect(buildGs1QrTargetUrl({ gtin: "00810012345675" })).toBe(
      "https://id.originpass.app/01/00810012345675",
    )
    expect(gs1DigitalLinkDomain()).toBe("id.originpass.app")
    process.env.GS1_DIGITAL_LINK_DOMAIN = prev
  })

  it("formats the AI (01) GTIN identifier string", () => {
    expect(formatGtinAi01("00810012345675")).toBe("(01) 00810012345675")
    expect(formatGtinAi01("")).toBeNull()
  })

  it("generates a high-resolution PNG data URI for a scan URL", async () => {
    const dataUri = await generatePdfQrDataUri("https://id.originpass.app/01/00810012345675", {
      width: 256,
    })
    expect(dataUri.startsWith("data:image/png;base64,")).toBe(true)
    expect(dataUri.length).toBeGreaterThan(100)
  })
})
