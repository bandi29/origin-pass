import { FRAUD_ANALYTICS_PATH } from "@/lib/verification-nav"

/** Analytics module hub (sidebar + top nav landing). */
export const ANALYTICS_MODULE_HUB_PATH = "/dashboard/analytics" as const

export const SCAN_ANALYTICS_PATH = "/dashboard/scans/scan-analytics" as const

export function isAnalyticsModuleHubPath(path: string): boolean {
  return path === ANALYTICS_MODULE_HUB_PATH
}

export function isAnalyticsModulePath(path: string): boolean {
  return (
    path === ANALYTICS_MODULE_HUB_PATH ||
    path.startsWith(`${ANALYTICS_MODULE_HUB_PATH}/`) ||
    path === SCAN_ANALYTICS_PATH ||
    path.startsWith(`${SCAN_ANALYTICS_PATH}/`) ||
    path === FRAUD_ANALYTICS_PATH ||
    path.startsWith(`${FRAUD_ANALYTICS_PATH}/`)
  )
}
