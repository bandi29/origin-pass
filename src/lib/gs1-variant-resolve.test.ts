/**
 * DPP-03: Variant-level GTIN mapping - Variant A vs Variant B resolution.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { publicPassportTargetPath } from "./gs1-http"
import type { Gs1ResolvedProduct } from "./gs1-passport-resolve"

const GTIN_A = "00123456789012" // valid Mod-10
const GTIN_B = "01234567890128" // valid Mod-10

type QueryResult = { data?: unknown; error?: unknown }

let passportByGtin: Record<string, unknown> = {}
let productById: Record<string, unknown> = {}

function makeBuilder(table: string): Record<string, unknown> {
  const state: { filters: Array<[string, unknown]>; inValues: unknown[] | null } = {
    filters: [],
    inValues: null,
  }
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const method of ["select", "eq", "order", "limit", "not"]) {
    builder[method] = (...args: unknown[]) => {
      if (method === "eq") state.filters.push([String(args[0]), args[1]])
      return chain()
    }
  }
  builder.in = (col: string, values: unknown[]) => {
    state.inValues = values
    state.filters.push([col, values])
    return builder
  }
  builder.maybeSingle = async (): Promise<QueryResult> => {
    if (table === "passports" && state.inValues) {
      for (const g of state.inValues as string[]) {
        if (passportByGtin[g]) return { data: passportByGtin[g] }
      }
      return { data: null }
    }
    if (table === "products") {
      const idFilter = state.filters.find(([k]) => k === "id")
      if (idFilter) return { data: productById[String(idFilter[1])] ?? null }
      return { data: null }
    }
    if (table === "organizations") {
      return {
        data: { shop_domain: "demo.myshopify.com", global_production_location: "PT" },
      }
    }
    if (table === "certificates") return { data: [] }
    return { data: null }
  }
  builder.then = (onOk: (v: QueryResult) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve({ data: [] }).then(onOk, onErr)
  return builder
}

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}))

describe("DPP-03 variant GTIN resolution", () => {
  beforeEach(() => {
    passportByGtin = {
      [GTIN_A]: {
        id: "pass-a",
        gtin: GTIN_A,
        external_variant_id: "variant-A",
        serial_number: "SER-A",
        verify_token: null,
        passport_uid: "uid-a",
        product_id: "11111111-2222-4333-8444-555555555555",
      },
      [GTIN_B]: {
        id: "pass-b",
        gtin: GTIN_B,
        external_variant_id: "variant-B",
        serial_number: "SER-B",
        verify_token: null,
        passport_uid: "uid-b",
        product_id: "11111111-2222-4333-8444-555555555555",
      },
    }
    productById = {
      "11111111-2222-4333-8444-555555555555": {
        id: "11111111-2222-4333-8444-555555555555",
        name: "Tee",
        gtin: null,
        gln: null,
        default_lot_number: null,
        materials: "Cotton",
        origin_country: "PT",
        external_product_id: "9001",
        compliance_data: null,
        organization_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      },
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("publicPassportTargetPath attaches distinct variant query params for A vs B", () => {
    const base: Omit<Gs1ResolvedProduct, "externalVariantId" | "gtin" | "matchedBy"> = {
      productId: "11111111-2222-4333-8444-555555555555",
      externalProductId: "9001",
      shopDomain: "demo.myshopify.com",
      shopSlug: "demo",
      name: "Tee",
      gln: null,
      defaultLotNumber: null,
      materials: "Cotton",
      originCountry: "PT",
      productionLocation: "PT",
      certificates: [],
      passportToken: "SER-A",
    }

    const pathA = publicPassportTargetPath({
      ...base,
      gtin: GTIN_A,
      externalVariantId: "variant-A",
      matchedBy: "variant_gtin",
    })
    const pathB = publicPassportTargetPath({
      ...base,
      gtin: GTIN_B,
      externalVariantId: "variant-B",
      matchedBy: "variant_gtin",
      passportToken: "SER-B",
    })

    expect(pathA).toBe("/sp/demo/9001?variant=variant-A")
    expect(pathB).toBe("/sp/demo/9001?variant=variant-B")
    expect(pathA).not.toBe(pathB)
  })

  it("resolveGs1DigitalLinkPath maps GTIN A -> variant-A and GTIN B -> variant-B", async () => {
    const { resolveGs1DigitalLinkPath } = await import("./gs1-passport-resolve")

    const resolvedA = await resolveGs1DigitalLinkPath(["01", GTIN_A])
    const resolvedB = await resolveGs1DigitalLinkPath(["01", GTIN_B])

    expect(resolvedA?.matchedBy).toBe("variant_gtin")
    expect(resolvedA?.externalVariantId).toBe("variant-A")
    expect(resolvedA?.gtin).toBe(GTIN_A)
    expect(publicPassportTargetPath(resolvedA!)).toContain("variant=variant-A")

    expect(resolvedB?.matchedBy).toBe("variant_gtin")
    expect(resolvedB?.externalVariantId).toBe("variant-B")
    expect(resolvedB?.gtin).toBe(GTIN_B)
    expect(publicPassportTargetPath(resolvedB!)).toContain("variant=variant-B")

    expect(resolvedA?.externalVariantId).not.toBe(resolvedB?.externalVariantId)
  })
})
