import { describe, expect, it } from "vitest"
import {
  PRODUCT_IDENTITY_MODULE_HUB_PATH,
  isProductIdentityModuleHubPath,
  isProductIdentityModulePath,
} from "@/lib/product-identity-nav"

describe("product-identity-nav", () => {
  it("recognizes the module hub path", () => {
    expect(isProductIdentityModuleHubPath(PRODUCT_IDENTITY_MODULE_HUB_PATH)).toBe(true)
    expect(isProductIdentityModuleHubPath("/dashboard/product-identity/passports")).toBe(false)
  })

  it("recognizes nested module paths", () => {
    expect(isProductIdentityModulePath("/dashboard/product-identity")).toBe(true)
    expect(isProductIdentityModulePath("/dashboard/product-identity/passports")).toBe(true)
    expect(isProductIdentityModulePath("/dashboard/products")).toBe(false)
  })
})
