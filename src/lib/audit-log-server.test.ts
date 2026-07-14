import { describe, expect, it } from "vitest"
import { VERIFICATION_AUDIT_ACTIONS } from "@/lib/audit-log-server"

describe("audit-log-server", () => {
  it("defines verification audit actions separate from team/import operations", () => {
    expect(VERIFICATION_AUDIT_ACTIONS).toContain("verification_orchestrator_run")
    expect(VERIFICATION_AUDIT_ACTIONS).toContain("counterfeit_alert_confirm_fraud")
    expect(VERIFICATION_AUDIT_ACTIONS).not.toContain("member_invited")
    expect(VERIFICATION_AUDIT_ACTIONS).not.toContain("ImportBatch")
  })
})
