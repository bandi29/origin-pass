import { describe, expect, it } from "vitest"
import {
  hasMerchantConfigurationSetup,
  shouldShowMerchantEmptyState,
} from "./merchant-empty-state"

describe("hasMerchantConfigurationSetup", () => {
  it("returns false when store is not connected", () => {
    expect(
      hasMerchantConfigurationSetup({
        connected: false,
        productionLocation: "Florence, Italy",
        careInstructions: "Hand wash",
      }),
    ).toBe(false)
  })

  it("returns false when connected but both brand fields are blank", () => {
    expect(
      hasMerchantConfigurationSetup({
        connected: true,
        productionLocation: "   ",
        careInstructions: "",
      }),
    ).toBe(false)
  })

  it("returns true when connected and production location is set", () => {
    expect(
      hasMerchantConfigurationSetup({
        connected: true,
        productionLocation: "Florence, Italy",
        careInstructions: "",
      }),
    ).toBe(true)
  })

  it("returns true when connected and care instructions are set", () => {
    expect(
      hasMerchantConfigurationSetup({
        connected: true,
        productionLocation: "",
        careInstructions: "Hand wash cold",
      }),
    ).toBe(true)
  })
})

describe("shouldShowMerchantEmptyState", () => {
  it("returns false when products exist", () => {
    expect(
      shouldShowMerchantEmptyState(3, {
        connected: false,
        productionLocation: "",
        careInstructions: "",
      }),
    ).toBe(false)
  })

  it("returns true for first-time merchants with no config and no products", () => {
    expect(
      shouldShowMerchantEmptyState(0, {
        connected: false,
        productionLocation: "",
        careInstructions: "",
      }),
    ).toBe(true)

    expect(
      shouldShowMerchantEmptyState(0, {
        connected: true,
        productionLocation: "",
        careInstructions: "",
      }),
    ).toBe(true)
  })

  it("returns false when connected, no products, but brand defaults are configured", () => {
    expect(
      shouldShowMerchantEmptyState(0, {
        connected: true,
        productionLocation: "Porto, Portugal",
        careInstructions: "",
      }),
    ).toBe(false)
  })
})
