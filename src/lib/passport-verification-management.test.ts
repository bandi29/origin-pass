import { describe, expect, it } from "vitest"
import {
  formatPassportVerificationTimestamp,
  isPassportVerificationComplianceStatus,
  PASSPORT_VERIFICATION_EVENT_LABELS,
} from "@/lib/passport-verification-management"

describe("passport-verification-management", () => {
  it("validates compliance statuses", () => {
    expect(isPassportVerificationComplianceStatus("verified")).toBe(true)
    expect(isPassportVerificationComplianceStatus("suspended")).toBe(true)
    expect(isPassportVerificationComplianceStatus("failed_audit")).toBe(true)
    expect(isPassportVerificationComplianceStatus("active")).toBe(false)
  })

  it("maps event labels for audit history", () => {
    expect(PASSPORT_VERIFICATION_EVENT_LABELS.manual_override).toBe(
      "Manual Administrator Override",
    )
    expect(PASSPORT_VERIFICATION_EVENT_LABELS.system_compliance_check).toBe(
      "System Automatic Compliance Check",
    )
  })

  it("formats timestamps for regional display", () => {
    const formatted = formatPassportVerificationTimestamp("2026-05-31T23:00:00.000Z")
    expect(formatted).toMatch(/2026/)
    expect(formatted.length).toBeGreaterThan(8)
  })
})
