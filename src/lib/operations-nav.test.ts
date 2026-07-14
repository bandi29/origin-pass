import { describe, expect, it } from "vitest"
import {
  OPERATIONS_MODULE_HUB_PATH,
  isOperationsModuleHubPath,
  isOperationsModulePath,
} from "@/lib/operations-nav"

describe("operations-nav", () => {
  it("recognizes the module hub path", () => {
    expect(isOperationsModuleHubPath(OPERATIONS_MODULE_HUB_PATH)).toBe(true)
    expect(isOperationsModuleHubPath("/dashboard/ownership")).toBe(false)
  })

  it("recognizes nested operations routes", () => {
    expect(isOperationsModulePath("/dashboard/operations")).toBe(true)
    expect(isOperationsModulePath("/dashboard/operations/security-logs")).toBe(true)
    expect(isOperationsModulePath("/dashboard/ownership/records")).toBe(true)
    expect(isOperationsModulePath("/dashboard/products")).toBe(false)
  })
})
