import { describe, expect, it } from "vitest"
import { mapPassportActivityUpdateAuditRow } from "@/lib/passport-activity-audit"
import {
  filterPassportActivityLogs,
  passportActivityUpdateDescription,
  type PassportActivityLogEntry,
} from "@/lib/passport-activity-types"

const baseRow = (patch: Partial<PassportActivityLogEntry>): PassportActivityLogEntry => ({
  id: "1",
  eventType: "QR_SCANNED",
  description: "scan",
  targetLabel: "OP-1",
  targetHref: "/verify/OP-1",
  occurredAt: new Date().toISOString(),
  ...patch,
})

describe("filterPassportActivityLogs", () => {
  it("updates tab includes only metadata update rows", () => {
    const rows = [
      baseRow({ id: "scan", eventType: "QR_SCANNED" }),
      baseRow({ id: "claim", eventType: "OWNERSHIP_CLAIMED" }),
      baseRow({ id: "update", eventType: "METADATA_UPDATED" }),
    ]

    const filtered = filterPassportActivityLogs(rows, "updates")
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.id).toBe("update")
  })
})

describe("mapPassportActivityUpdateAuditRow", () => {
  it("maps passport lifecycle audit rows with serial target and field description", () => {
    const mapped = mapPassportActivityUpdateAuditRow(
      {
        id: "audit-1",
        user_id: "user-1",
        action: "passport_lifecycle_status_change",
        resource: "passport-uuid",
        metadata: {
          product_id: "prod-1",
          serial_number: "OP-ABC123",
          action_label: "Lifecycle status",
          status_before: "active",
          status_after: "revoked",
        },
        created_at: "2026-06-01T12:00:00.000Z",
      },
      new Set(["prod-1"]),
    )

    expect(mapped?.eventTitle).toBe("Passport updated")
    expect(mapped?.description).toBe("Lifecycle status changed from active to revoked.")
    expect(mapped?.targetLabel).toBe("OP-ABC123")
    expect(mapped?.targetHref).toBe("/verify/OP-ABC123")
  })

  it("excludes audit rows outside org product scope", () => {
    const mapped = mapPassportActivityUpdateAuditRow(
      {
        id: "audit-2",
        user_id: "user-1",
        action: "product.updated",
        resource: "prod-other",
        metadata: { product_id: "prod-other", field_label: "Origin" },
        created_at: "2026-06-01T12:00:00.000Z",
      },
      new Set(["prod-1"]),
    )

    expect(mapped).toBeNull()
  })
})

describe("passportActivityUpdateDescription", () => {
  it("supports canonical dot-notation update actions", () => {
    expect(
      passportActivityUpdateDescription("template.modified", {
        template_name: "Luxury Hang Tag",
      }),
    ).toBe("Luxury Hang Tag layout or display settings were modified.")
  })
})
