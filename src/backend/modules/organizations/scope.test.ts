import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Guards the multi-tenant authorization used by the admin export-pdf route (and
 * every other scoped admin query). The critical property: a passport is only in
 * scope when its product belongs to the user's brand_id or organization_id — and
 * the product query must ALWAYS carry that scope filter, never run unfiltered.
 */

type ScopeCall = { table: string; eq: Record<string, unknown>; or?: string }

let calls: ScopeCall[]
let passportProductId: string | null
let userOrgId: string | null
let productScopeRow: { id: string } | null

function builder(table: string) {
  const call: ScopeCall = { table, eq: {} }
  calls.push(call)
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      call.eq[col] = val
      return chain
    },
    or: (expr: string) => {
      call.or = expr
      return chain
    },
    in: () => chain,
    limit: () => chain,
    maybeSingle: async () => {
      if (table === "passports") {
        return { data: passportProductId ? { product_id: passportProductId } : null, error: null }
      }
      if (table === "users") {
        return { data: userOrgId ? { organization_id: userOrgId } : null, error: null }
      }
      if (table === "products") {
        return { data: productScopeRow, error: null }
      }
      return { data: null, error: null }
    },
  }
  return chain
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}))

import { isPassportInScope, isProductInScope } from "@/backend/modules/organizations/scope"

const USER = "user-abc"
const ORG = "org-xyz"
const PASSPORT = "11111111-1111-4111-8111-111111111111"
const PRODUCT = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  calls = []
  passportProductId = PRODUCT
  userOrgId = ORG
  productScopeRow = { id: PRODUCT }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("isPassportInScope (IDOR guard)", () => {
  it("returns true when the passport's product is in the user's scope", async () => {
    productScopeRow = { id: PRODUCT }
    expect(await isPassportInScope(USER, PASSPORT)).toBe(true)
  })

  it("returns false when the product is NOT in the user's scope (cross-tenant denied)", async () => {
    productScopeRow = null
    expect(await isPassportInScope(USER, PASSPORT)).toBe(false)
  })

  it("returns false when the passport has no product row", async () => {
    passportProductId = null
    expect(await isPassportInScope(USER, PASSPORT)).toBe(false)
  })

  it("returns false for an empty passport id without hitting the database", async () => {
    expect(await isPassportInScope(USER, "")).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it("ALWAYS scopes the product query by brand_id and organization_id (never unfiltered)", async () => {
    await isPassportInScope(USER, PASSPORT)
    const productCall = calls.find((c) => c.table === "products")
    expect(productCall).toBeDefined()
    expect(productCall!.eq.id).toBe(PRODUCT)
    expect(productCall!.or).toContain(`brand_id.eq.${USER}`)
    expect(productCall!.or).toContain(`organization_id.eq.${ORG}`)
  })

  it("scopes by brand_id alone when the user has no organization", async () => {
    userOrgId = null
    await isProductInScope(USER, PRODUCT)
    const productCall = calls.find((c) => c.table === "products")
    expect(productCall!.or).toContain(`brand_id.eq.${USER}`)
    expect(productCall!.or).not.toContain("organization_id.eq.")
  })
})
