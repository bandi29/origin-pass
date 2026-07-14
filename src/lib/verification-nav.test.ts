import { describe, expect, it } from "vitest"
import {
  VERIFICATION_ROUTES,
  OPERATIONS_SECURITY_LOGS_PATH,
  OPERATIONS_AUDIT_LOGS_PATH,
  isCounterfeitAlertsPath,
  isExactNavPath,
  isOperationsSecurityLogsPath,
  isSupplierIntelligencePath,
  isVerificationAuditLogsPath,
  isVerificationHubPath,
  isVerificationScopePath,
  OPERATIONS_COMPLIANCE_HUB_PATH,
  EU_DPP_COMPLIANCE_PATH,
  SUPPLIER_INTELLIGENCE_PATH,
  verificationPathFromLegacy,
} from "@/lib/verification-nav"

describe("verification-nav", () => {
  it("treats verification overview and inner tabs as hub scope", () => {
    expect(isVerificationScopePath("/dashboard/verification")).toBe(true)
    expect(isVerificationScopePath("/dashboard/verification/rules")).toBe(true)
    expect(isVerificationScopePath("/dashboard/product-identity/verification/analytics")).toBe(true)
    expect(isVerificationHubPath("/dashboard/verification")).toBe(true)
    expect(isVerificationHubPath("/dashboard/verification/map")).toBe(true)
    expect(isVerificationHubPath("/dashboard/verification/alerts")).toBe(true)
  })

  it("keeps standalone fraud analytics outside verification scope", () => {
    expect(isVerificationScopePath("/dashboard/analytics/fraud")).toBe(false)
  })

  it("identifies alerts sub-route for notifications and legacy paths", () => {
    expect(isCounterfeitAlertsPath("/dashboard/verification/alerts")).toBe(true)
    expect(isVerificationScopePath("/dashboard/verification/alerts")).toBe(true)
  })

  it("isolates verification audit sub-tab from operations security logs", () => {
    expect(isVerificationAuditLogsPath(VERIFICATION_ROUTES.audit)).toBe(true)
    expect(isOperationsSecurityLogsPath(OPERATIONS_SECURITY_LOGS_PATH)).toBe(true)
    expect(isExactNavPath(OPERATIONS_SECURITY_LOGS_PATH, OPERATIONS_SECURITY_LOGS_PATH)).toBe(true)
    expect(isVerificationScopePath(VERIFICATION_ROUTES.audit)).toBe(true)
    expect(isOperationsSecurityLogsPath(VERIFICATION_ROUTES.audit)).toBe(false)
    expect(isVerificationScopePath(OPERATIONS_SECURITY_LOGS_PATH)).toBe(false)
    expect(isVerificationAuditLogsPath(OPERATIONS_SECURITY_LOGS_PATH)).toBe(false)
    expect(isVerificationScopePath(OPERATIONS_AUDIT_LOGS_PATH)).toBe(false)
  })

  it("maps legacy authenticity paths during redirect rollout", () => {
    expect(verificationPathFromLegacy("/dashboard/authenticity/alerts")).toBe(
      VERIFICATION_ROUTES.alerts,
    )
    expect(verificationPathFromLegacy("/dashboard/authenticity/audit")).toBe(
      VERIFICATION_ROUTES.audit,
    )
    expect(isCounterfeitAlertsPath("/dashboard/authenticity/alerts")).toBe(true)
    expect(isVerificationAuditLogsPath("/dashboard/authenticity/audit")).toBe(true)
  })

  it("identifies supplier intelligence routes without matching verification scope", () => {
    expect(isSupplierIntelligencePath(OPERATIONS_COMPLIANCE_HUB_PATH)).toBe(true)
    expect(isSupplierIntelligencePath(EU_DPP_COMPLIANCE_PATH)).toBe(true)
    expect(isSupplierIntelligencePath("/dashboard/compliance/eu")).toBe(true)
    expect(isVerificationScopePath(OPERATIONS_COMPLIANCE_HUB_PATH)).toBe(false)
    expect(SUPPLIER_INTELLIGENCE_PATH).toBe(OPERATIONS_COMPLIANCE_HUB_PATH)
  })
})
