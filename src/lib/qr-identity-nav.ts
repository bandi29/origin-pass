import { PRODUCT_IDENTITY_MODULE_HUB_PATH } from "@/lib/product-identity-nav"

export const QR_IDENTITY_SUITE_BASE = "/dashboard/qr-identity" as const

export const QR_IDENTITY_PATHS = {
  all: `${QR_IDENTITY_SUITE_BASE}/all`,
  print: `${QR_IDENTITY_SUITE_BASE}/print`,
  verification: `${QR_IDENTITY_SUITE_BASE}/verification`,
  batch: `${QR_IDENTITY_SUITE_BASE}/batch`,
} as const

/** Primary log directory — registry landing page. */
export const QR_IDENTITY_LOG_DIRECTORY_PATH = QR_IDENTITY_PATHS.all

/** Deep-link into the QR ledger with activation status pre-filtered. */
export const QR_IDENTITY_LEDGER_STATUS_FILTER: Record<"active" | "compromised" | "pending", string> = {
  active: `${QR_IDENTITY_LOG_DIRECTORY_PATH}?status=active`,
  compromised: `${QR_IDENTITY_LOG_DIRECTORY_PATH}?status=compromised`,
  pending: `${QR_IDENTITY_LOG_DIRECTORY_PATH}?status=pending`,
}

/** Option A: QR issuance runs through the passport creation wizard. */
export const QR_IDENTITY_PASSPORT_CREATE_PATH =
  "/dashboard/product-passports/create?context=qr-identity" as const

export const QR_IDENTITY_BREADCRUMB_LABELS: Record<string, string> = {
  // The /all page is the QR Identity landing (the root redirects here), so its
  // crumb reads "Overview" rather than repeating "QR Identity".
  all: "Overview",
  print: "Print Labels",
  verification: "Security Verification",
  batch: "Batch distribution",
}

export function isQrIdentityModulePath(path: string): boolean {
  return (
    path === QR_IDENTITY_SUITE_BASE ||
    path.startsWith(`${QR_IDENTITY_SUITE_BASE}/`) ||
    path.startsWith(`${PRODUCT_IDENTITY_MODULE_HUB_PATH}/qr-identity`)
  )
}
