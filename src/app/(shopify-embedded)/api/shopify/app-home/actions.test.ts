/**
 * Regression suite for the embedded Shopify admin server actions.
 *
 * These actions are the entire mutation/read surface behind every button in the
 * embedded app, and Server Actions are publicly reachable POST endpoints — the
 * caller-supplied `shop` is attacker-controlled. The auth cases below are the
 * ones that must never regress: a token minted for shop B must never be able to
 * read or write shop A's data, and in production a missing token must fail
 * closed rather than trusting the param.
 *
 * Session tokens are signed for real (HMAC-SHA256, same as App Bridge) rather
 * than mocked, so `verifyShopifySessionToken` is genuinely exercised.
 */
import crypto from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const API_SECRET = "test-shopify-api-secret"
const SHOP_A = "store-a.myshopify.com"
const SHOP_B = "store-b.myshopify.com"
const PRODUCT_UUID = "11111111-2222-4333-8444-555555555555"

/** Mint a session token App Bridge-style: base64url(header).base64url(payload).hmac */
function signSessionToken(shop: string, overrides: Record<string, unknown> = {}): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      dest: `https://${shop}`,
      exp: Math.floor(Date.now() / 1000) + 60,
      ...overrides,
    }),
  ).toString("base64url")
  const signature = crypto
    .createHmac("sha256", API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url")
  return `${header}.${payload}.${signature}`
}

// ── Supabase fake ───────────────────────────────────────────────────────────
type QueryResult = { data?: unknown; count?: number | null; error?: unknown }

/** Per-table canned results; every action reads organizations first. */
let tableResults: Record<string, QueryResult> = {}
/** Records which tables were queried, so we can assert "never touched the DB". */
let touchedTables: string[] = []
/** Records filter args, so we can assert the shop actually filtered on. */
let recordedFilters: Array<[string, unknown]> = []

function makeQueryBuilder(table: string): Record<string, unknown> {
  const result = tableResults[table] ?? { data: null, count: 0 }
  const builder: Record<string, unknown> = {}
  const passthrough =
    (name: string) =>
    (...args: unknown[]) => {
      if (name === "eq" || name === "in" || name === "or") {
        recordedFilters.push([String(args[0]), args[1]])
      }
      return builder
    }
  for (const method of ["select", "eq", "in", "not", "or", "order", "update", "insert", "delete", "limit"]) {
    builder[method] = passthrough(method)
  }
  builder.range = async () => result
  builder.maybeSingle = async () => result
  builder.single = async () => result
  // PostgREST builders are thenable — support bare `await query`.
  builder.then = (onOk: (v: QueryResult) => unknown, onErr?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onOk, onErr)
  return builder
}

vi.mock("@/lib/supabase", () => ({
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      touchedTables.push(table)
      return makeQueryBuilder(table)
    },
  }),
}))

// Keep the sync action off real Redis/BullMQ/Shopify.
vi.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ ok: true }) }))
vi.mock("@/lib/shopify-admin-token", () => ({ getShopifyAdminToken: async () => null }))
vi.mock("@/lib/shopify-catalog-sync-progress", () => ({
  beginSharedSyncProgress: async () => true,
  finishSharedSyncProgress: async () => undefined,
  readSharedSyncProgress: async () => ({
    status: "idle",
    processed: 0,
    total: null,
    percent: 0,
    message: null,
    ok: null,
    updatedAt: 0,
  }),
}))

import {
  getProductPassportEditor,
  getStoreConfig,
  listStoreProducts,
  syncStoreProducts,
  updateProductPassportFields,
  updateStoreConfig,
} from "./actions"

beforeEach(() => {
  vi.stubEnv("SHOPIFY_API_SECRET", API_SECRET)
  tableResults = {}
  touchedTables = []
  recordedFilters = []
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** The org row every action loads first. */
function withStore(extra: Record<string, unknown> = {}) {
  tableResults.organizations = {
    data: {
      id: "org-1",
      global_production_location: "Florence, Italy",
      global_care_instructions: "Hand wash cold.",
      ...extra,
    },
  }
}

describe("cross-tenant auth (must never regress)", () => {
  it("getProductPassportEditor ignores the shop param and uses the verified token's shop", async () => {
    vi.stubEnv("NODE_ENV", "production")
    withStore()
    tableResults.products = { data: { id: PRODUCT_UUID, name: "Leather bag", compliance_data: {} } }
    tableResults.certificates = { data: [] }

    // Caller claims SHOP_A but presents a token minted for SHOP_B.
    await getProductPassportEditor(SHOP_A, PRODUCT_UUID, signSessionToken(SHOP_B))

    // The org lookup must filter on the *token's* shop, never the param.
    const shopFilters = recordedFilters.filter(([col]) => col === "shop_domain").map(([, value]) => value)
    expect(shopFilters).toContain(SHOP_B)
    expect(shopFilters).not.toContain(SHOP_A)
  })

  it("getProductPassportEditor fails closed in production without a token", async () => {
    vi.stubEnv("NODE_ENV", "production")
    withStore()

    await expect(getProductPassportEditor(SHOP_A, PRODUCT_UUID)).resolves.toBeNull()
    expect(touchedTables).toHaveLength(0)
  })

  it("getProductPassportEditor rejects a token signed with the wrong secret", async () => {
    vi.stubEnv("NODE_ENV", "production")
    withStore()
    const forged = `${signSessionToken(SHOP_A).split(".").slice(0, 2).join(".")}.forged-signature`

    await expect(getProductPassportEditor(SHOP_A, PRODUCT_UUID, forged)).resolves.toBeNull()
    expect(touchedTables).toHaveLength(0)
  })

  it("getProductPassportEditor rejects an expired token", async () => {
    vi.stubEnv("NODE_ENV", "production")
    withStore()
    const expired = signSessionToken(SHOP_A, { exp: Math.floor(Date.now() / 1000) - 10 })

    await expect(getProductPassportEditor(SHOP_A, PRODUCT_UUID, expired)).resolves.toBeNull()
    expect(touchedTables).toHaveLength(0)
  })

  it("listStoreProducts returns an empty page for a forged token", async () => {
    vi.stubEnv("NODE_ENV", "production")
    withStore()

    const page = await listStoreProducts(SHOP_A, { sessionToken: "not.a.token" })

    expect(page).toEqual({ products: [], totalCount: 0 })
    expect(touchedTables).toHaveLength(0)
  })

  it("updateStoreConfig refuses to write with an invalid token", async () => {
    withStore()

    const result = await updateStoreConfig({
      shop: SHOP_A,
      sessionToken: "not.a.token",
      productionLocation: "Injected",
      careInstructions: "Injected",
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/session expired/i)
    expect(touchedTables).toHaveLength(0)
  })

  it("updateProductPassportFields refuses to write with an invalid token", async () => {
    withStore()

    const result = await updateProductPassportFields({
      shop: SHOP_A,
      productId: PRODUCT_UUID,
      sessionToken: "not.a.token",
      productionLocation: "Injected",
      careInstructions: "Injected",
    })

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/session expired/i)
    expect(touchedTables).toHaveLength(0)
  })

  it("updateStoreConfig writes against the token's shop, not the param", async () => {
    vi.stubEnv("NODE_ENV", "production")
    tableResults.organizations = {
      data: { global_production_location: "X", global_care_instructions: "Y" },
    }

    await updateStoreConfig({
      shop: SHOP_A,
      sessionToken: signSessionToken(SHOP_B),
      productionLocation: "X",
      careInstructions: "Y",
    })

    const shopFilters = recordedFilters.filter(([col]) => col === "shop_domain").map(([, v]) => v)
    expect(shopFilters).toContain(SHOP_B)
    expect(shopFilters).not.toContain(SHOP_A)
  })

  it("syncStoreProducts refuses to run for an unverified caller", async () => {
    vi.stubEnv("NODE_ENV", "production")

    const result = await syncStoreProducts(SHOP_A, "not.a.token")

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/session expired/i)
  })
})

describe("input validation", () => {
  it("caps brand defaults server-side regardless of client maxLength", async () => {
    tableResults.organizations = {
      data: { global_production_location: "ok", global_care_instructions: "ok" },
    }

    const result = await updateStoreConfig({
      shop: SHOP_A,
      productionLocation: "a".repeat(500),
      careInstructions: "b".repeat(2000),
    })

    // Returned echo is the truncated value the server actually persisted.
    expect(result.productionLocation.length).toBeLessThanOrEqual(120)
    expect(result.careInstructions.length).toBeLessThanOrEqual(500)
  })

  it("rejects a non-uuid productId before touching the database", async () => {
    withStore()

    await expect(getProductPassportEditor(SHOP_A, "../../etc/passwd")).resolves.toBeNull()
    await expect(getProductPassportEditor(SHOP_A, "1 OR 1=1")).resolves.toBeNull()
    expect(touchedTables).toHaveLength(0)
  })

  it("rejects a malformed shop domain", async () => {
    withStore()

    await expect(getProductPassportEditor("evil.com", PRODUCT_UUID)).resolves.toBeNull()
    await expect(listStoreProducts("evil.com")).resolves.toEqual({ products: [], totalCount: 0 })
    expect(touchedTables).toHaveLength(0)
  })

  it("strips PostgREST metacharacters from catalog search", async () => {
    withStore()
    tableResults.products = { data: [], count: 0 }
    tableResults.certificates = { data: [] }

    await listStoreProducts(SHOP_A, { search: 'a,b(c)%d\\e' })

    const orFilter = recordedFilters.find(([col]) => col.includes("ilike"))
    // `.or()` receives the whole expression as its first arg here.
    const expression = String(orFilter?.[0] ?? "")
    for (const meta of [",", "(", ")", "%", "\\"]) {
      // The only comma/paren allowed is the one the app itself builds.
      expect(expression.includes(`a${meta}`)).toBe(false)
    }
  })
})

describe("graceful degradation", () => {
  it("getStoreConfig returns safe defaults when the store row is missing", async () => {
    tableResults.organizations = { data: null }

    const config = await getStoreConfig(SHOP_A)

    expect(config).toEqual({
      productionLocation: "",
      careInstructions: "",
      lastSyncedAt: null,
      subscriptionTier: "free",
    })
  })

  it("syncStoreProducts gives an actionable message when the store is not connected", async () => {
    const result = await syncStoreProducts(SHOP_A)

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/not connected/i)
  })

  it("listStoreProducts degrades to an empty page instead of throwing", async () => {
    tableResults.organizations = { data: null }

    await expect(listStoreProducts(SHOP_A)).resolves.toEqual({ products: [], totalCount: 0 })
  })
})
