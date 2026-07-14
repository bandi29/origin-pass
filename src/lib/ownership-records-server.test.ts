import { describe, expect, it } from "vitest"
import {
  formatOwnershipRegistrationId,
  mapOwnershipRecordRow,
  maskVerifiedOwnerLabel,
  resolveOwnershipWarrantyStatus,
} from "@/lib/ownership-records-server"

describe("ownership-records-server", () => {
  it("formats registration ids from ownership uuid", () => {
    expect(formatOwnershipRegistrationId("88219f3a-2b4c-5d6e-8f90-a1b2c3d4e5f6")).toBe(
      "OWN-88219F3A2",
    )
  })

  it("masks email owners for dashboard display", () => {
    expect(
      maskVerifiedOwnerLabel({
        ownerIdentifier: "owner@verified.mail",
        ownerName: null,
        ownerEmail: null,
      }),
    ).toBe("owne••••@verified.mail")
  })

  it("resolves warranty lifecycle states", () => {
    expect(
      resolveOwnershipWarrantyStatus(null, null).status,
    ).toBe("pending")
    expect(
      resolveOwnershipWarrantyStatus("2026-01-01", "2025-01-01", new Date("2026-05-01")).status,
    ).toBe("expired")
    expect(
      resolveOwnershipWarrantyStatus("2026-01-01", "2028-01-01", new Date("2026-05-01")).status,
    ).toBe("active")
  })

  it("maps database rows into ledger rows", () => {
    const row = mapOwnershipRecordRow({
      id: "88219f3a-2b4c-5d6e-8f90-a1b2c3d4e5f6",
      owner_identifier: "buyer@example.com",
      owner_name: null,
      owner_email: "buyer@example.com",
      status: "claimed",
      claimed_at: "2026-05-18T09:14:00.000Z",
      warranty_start_date: "2026-05-18",
      warranty_end_date: "2027-04-12",
      metadata: {},
      passports: {
        serial_number: "SN-001",
        products: { name: "Linen Tote Bag", sku: "LTB-2026-001" },
      },
    })

    expect(row.registrationId).toBe("OWN-88219F3A2")
    expect(row.productSku).toBe("LTB-2026-001")
    expect(row.productName).toBe("Linen Tote Bag")
    expect(row.warrantyStatus).toBe("active")
    expect(row.ownerLabel).toContain("@example.com")
  })
})
