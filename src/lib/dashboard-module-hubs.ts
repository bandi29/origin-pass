import {
  PRODUCT_IDENTITY_MODULE_HUB_PATH,
  isProductIdentityModuleHubPath,
  isProductIdentityModulePath,
} from "@/lib/product-identity-nav"
import {
  OPERATIONS_MODULE_HUB_PATH,
  isOperationsModuleHubPath,
  isOperationsModulePath,
} from "@/lib/operations-nav"
import {
  ANALYTICS_MODULE_HUB_PATH,
  isAnalyticsModuleHubPath,
  isAnalyticsModulePath,
} from "@/lib/analytics-nav"
import {
  SYSTEM_MODULE_HUB_PATH,
  isSystemModuleHubPath,
  isSystemModulePath,
} from "@/lib/system-nav"

export type DashboardModuleHubKey = "identity" | "operations" | "analytics" | "system"

export type DashboardModuleHubConfig = {
  key: DashboardModuleHubKey
  hubPath: string
  isHubPath: (path: string) => boolean
  isModulePath: (path: string) => boolean
  /** Primary = Product Identity styling; compact = section label styling. */
  headerStyle: "primary" | "compact"
}

export const DASHBOARD_MODULE_HUBS: Record<DashboardModuleHubKey, DashboardModuleHubConfig> = {
  identity: {
    key: "identity",
    hubPath: PRODUCT_IDENTITY_MODULE_HUB_PATH,
    isHubPath: isProductIdentityModuleHubPath,
    isModulePath: isProductIdentityModulePath,
    headerStyle: "primary",
  },
  operations: {
    key: "operations",
    hubPath: OPERATIONS_MODULE_HUB_PATH,
    isHubPath: isOperationsModuleHubPath,
    isModulePath: isOperationsModulePath,
    headerStyle: "compact",
  },
  analytics: {
    key: "analytics",
    hubPath: ANALYTICS_MODULE_HUB_PATH,
    isHubPath: isAnalyticsModuleHubPath,
    isModulePath: isAnalyticsModulePath,
    headerStyle: "compact",
  },
  system: {
    key: "system",
    hubPath: SYSTEM_MODULE_HUB_PATH,
    isHubPath: isSystemModuleHubPath,
    isModulePath: isSystemModulePath,
    headerStyle: "compact",
  },
}

export function isDashboardModuleHubGroup(
  groupKey: string,
): groupKey is DashboardModuleHubKey {
  return groupKey in DASHBOARD_MODULE_HUBS
}

export function getDashboardModuleHub(
  groupKey: string,
): DashboardModuleHubConfig | undefined {
  return isDashboardModuleHubGroup(groupKey)
    ? DASHBOARD_MODULE_HUBS[groupKey]
    : undefined
}
