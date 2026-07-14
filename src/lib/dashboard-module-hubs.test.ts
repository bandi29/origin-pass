import { describe, expect, it } from "vitest"
import {
  DASHBOARD_MODULE_HUBS,
  isDashboardModuleHubGroup,
} from "@/lib/dashboard-module-hubs"
import { ANALYTICS_MODULE_HUB_PATH } from "@/lib/analytics-nav"
import { SYSTEM_MODULE_HUB_PATH } from "@/lib/system-nav"

describe("dashboard-module-hubs", () => {
  it("registers all collapsible sidebar module hubs", () => {
    expect(Object.keys(DASHBOARD_MODULE_HUBS).sort()).toEqual([
      "analytics",
      "identity",
      "operations",
      "system",
    ])
  })

  it("recognizes dashboard module hub group keys", () => {
    expect(isDashboardModuleHubGroup("analytics")).toBe(true)
    expect(isDashboardModuleHubGroup("overview")).toBe(false)
  })

  it("maps analytics and system hubs to resolvable routes", () => {
    expect(DASHBOARD_MODULE_HUBS.analytics.hubPath).toBe(ANALYTICS_MODULE_HUB_PATH)
    expect(DASHBOARD_MODULE_HUBS.system.hubPath).toBe(SYSTEM_MODULE_HUB_PATH)
    expect(DASHBOARD_MODULE_HUBS.analytics.isModulePath("/dashboard/scans/scan-analytics")).toBe(
      true,
    )
    expect(DASHBOARD_MODULE_HUBS.system.isModulePath("/dashboard/team")).toBe(true)
  })
})
