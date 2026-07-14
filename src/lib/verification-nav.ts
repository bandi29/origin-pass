/** Canonical dashboard routes for the Verification module (formerly "Authenticity"). */

export const VERIFICATION_BASE = "/dashboard/verification" as const

/** Temporarily hide Verification from sidebar/top nav and cross-link CTAs. */
export const VERIFICATION_SUITE_NAV_VISIBLE = false

/** In-app fallback while {@link VERIFICATION_SUITE_NAV_VISIBLE} is false. */
export const VERIFICATION_NAV_FALLBACK_HREF = "/dashboard/qr-identity/verification" as const

/** Nested verification module under Product Identity (sub-tabs). */
export const PRODUCT_IDENTITY_VERIFICATION_BASE =
  "/dashboard/product-identity/verification" as const

/** Standalone Analytics module route (sidebar Fraud Analytics). */
export const FRAUD_ANALYTICS_PATH = "/dashboard/analytics/fraud" as const

/** Operations compliance hub (Supplier Intelligence). */
export const OPERATIONS_COMPLIANCE_HUB_PATH = "/dashboard/operations/compliance" as const

/** @deprecated Legacy alias — use OPERATIONS_COMPLIANCE_HUB_PATH */
export const SUPPLIER_INTELLIGENCE_PATH = OPERATIONS_COMPLIANCE_HUB_PATH

export const EU_DPP_COMPLIANCE_PATH = `${OPERATIONS_COMPLIANCE_HUB_PATH}/eu` as const

/** Legacy route retained during redirect rollout. */
export const LEGACY_COMPLIANCE_HUB_PATH = "/dashboard/compliance" as const

/** Global operations security logs (distinct from verification product audit sub-tab). */
export const OPERATIONS_SECURITY_LOGS_PATH = "/dashboard/operations/security-logs" as const

/** @deprecated Use OPERATIONS_SECURITY_LOGS_PATH — kept for legacy redirects. */
export const OPERATIONS_AUDIT_LOGS_PATH = "/dashboard/operations/audit-logs" as const

export const VERIFICATION_ROUTES = {
  overview: VERIFICATION_BASE,
  rules: `${VERIFICATION_BASE}/rules`,
  alerts: `${VERIFICATION_BASE}/alerts`,
  /**
   * Fraud analytics is owned by the Analytics module sidebar entry
   * (single source of truth). Legacy verification analytics URLs redirect here
   * so we don't maintain a duplicate view under the verification subtree.
   */
  analytics: FRAUD_ANALYTICS_PATH,
  map: `${VERIFICATION_BASE}/map`,
  audit: `${PRODUCT_IDENTITY_VERIFICATION_BASE}/audit-logs`,
} as const

export const VERIFICATION_BREADCRUMB_LABELS: Record<string, string> = {
  verification: "Verification",
  rules: "Rules",
  alerts: "Alerts",
  analytics: "Analytics",
  map: "Map",
  audit: "Audit Logs",
  "audit-logs": "Audit logs",
  "security-logs": "Security Logs",
}

export const SUPPLIER_INTELLIGENCE_BREADCRUMB_LABELS: Record<string, string> = {
  eu: "EU Digital Product Passport",
}

export function isSupplierIntelligencePath(current: string): boolean {
  return (
    current === OPERATIONS_COMPLIANCE_HUB_PATH ||
    current.startsWith(`${OPERATIONS_COMPLIANCE_HUB_PATH}/`) ||
    current === LEGACY_COMPLIANCE_HUB_PATH ||
    current.startsWith(`${LEGACY_COMPLIANCE_HUB_PATH}/`)
  )
}

export function normalizeDashboardPath(value: string | null | undefined): string {
  return (value || "").replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
}

export function isExactNavPath(current: string, href: string): boolean {
  return current === href
}

export function isOperationsSecurityLogsPath(current: string): boolean {
  return current === OPERATIONS_SECURITY_LOGS_PATH
}

/** @deprecated Use isOperationsSecurityLogsPath */
export function isOperationsAuditLogsPath(current: string): boolean {
  return isOperationsSecurityLogsPath(current)
}

export function isVerificationAuditLogsPath(current: string): boolean {
  return (
    current === VERIFICATION_ROUTES.audit ||
    current.startsWith(`${VERIFICATION_ROUTES.audit}/`) ||
    current === `${VERIFICATION_BASE}/audit` ||
    current.startsWith(`${VERIFICATION_BASE}/audit/`) ||
    current === "/dashboard/authenticity/audit" ||
    current.startsWith("/dashboard/authenticity/audit/")
  )
}

/** Legacy `/dashboard/authenticity/*` paths still resolve during redirect rollout. */
export function isVerificationScopePath(current: string): boolean {
  if (isOperationsSecurityLogsPath(current)) return false
  if (current === OPERATIONS_AUDIT_LOGS_PATH) return false

  return (
    current === VERIFICATION_BASE ||
    current.startsWith(`${VERIFICATION_BASE}/`) ||
    current === PRODUCT_IDENTITY_VERIFICATION_BASE ||
    current.startsWith(`${PRODUCT_IDENTITY_VERIFICATION_BASE}/`) ||
    current === "/dashboard/authenticity" ||
    current.startsWith("/dashboard/authenticity/")
  )
}

export function isCounterfeitAlertsPath(current: string): boolean {
  return (
    current === VERIFICATION_ROUTES.alerts ||
    current.startsWith(`${VERIFICATION_ROUTES.alerts}/`) ||
    current === "/dashboard/authenticity/alerts" ||
    current.startsWith("/dashboard/authenticity/alerts/")
  )
}

/** Verification module (all inner tabs including Alerts) — used for sidebar highlight. */
export function isVerificationHubPath(current: string): boolean {
  return isVerificationScopePath(current)
}

export function verificationPathFromLegacy(path: string): string | null {
  if (!path.startsWith("/dashboard/authenticity")) return null
  if (path === "/dashboard/authenticity/audit" || path.startsWith("/dashboard/authenticity/audit/")) {
    return VERIFICATION_ROUTES.audit
  }
  return path.replace("/dashboard/authenticity", VERIFICATION_BASE)
}
