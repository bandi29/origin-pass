import { describe, expect, it } from "vitest"
import {
  ANALYTICS_MODULE_HUB_PATH,
  isAnalyticsModuleHubPath,
  isAnalyticsModulePath,
} from "@/lib/analytics-nav"

describe("analytics-nav", () => {
  it("recognizes the module hub path", () => {
    expect(isAnalyticsModuleHubPath(ANALYTICS_MODULE_HUB_PATH)).toBe(true)
    expect(isAnalyticsModuleHubPath("/dashboard/analytics/fraud")).toBe(false)
  })

  it("recognizes nested analytics routes", () => {
    expect(isAnalyticsModulePath("/dashboard/analytics/locations")).toBe(true)
    expect(isAnalyticsModulePath("/dashboard/scans/scan-analytics")).toBe(true)
    expect(isAnalyticsModulePath("/dashboard/settings")).toBe(false)
  })
})
