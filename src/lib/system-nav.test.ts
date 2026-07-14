import { describe, expect, it } from "vitest"
import {
  SYSTEM_MODULE_HUB_PATH,
  isSystemModuleHubPath,
  isSystemModulePath,
} from "@/lib/system-nav"

describe("system-nav", () => {
  it("recognizes the module hub path", () => {
    expect(isSystemModuleHubPath(SYSTEM_MODULE_HUB_PATH)).toBe(true)
    expect(isSystemModuleHubPath("/dashboard/team")).toBe(false)
  })

  it("recognizes nested system routes", () => {
    expect(isSystemModulePath("/dashboard/team")).toBe(true)
    expect(isSystemModulePath("/dashboard/integrations/api-keys")).toBe(true)
    expect(isSystemModulePath("/dashboard/settings")).toBe(true)
    expect(isSystemModulePath("/dashboard/analytics")).toBe(false)
  })
})
