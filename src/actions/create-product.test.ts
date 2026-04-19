import { beforeEach, describe, expect, it, vi } from "vitest"
import { createProduct } from "./create-product"
import { ensureBrandProfile } from "@/lib/tenancy"

const mockGetUser = vi.fn()
const mockProfilesSingle = vi.fn()
const productInsertResponses: Array<{ data: { id: string } | null; error: { code?: string; message: string } | null }> = []
const insertedPayloads: Record<string, unknown>[] = []

vi.mock("@/lib/tenancy", () => ({
  ensureBrandProfile: vi.fn(),
}))

vi.mock("@/lib/dpp-export", () => ({
  buildProductJsonLd: vi.fn(() => ({ "@context": "https://schema.org", "@type": "Product" })),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockProfilesSingle(),
            }),
          }),
        }
      }
      if (table === "products") {
        return {
          insert: (payload: Record<string, unknown>) => {
            insertedPayloads.push(payload)
            const next = productInsertResponses.shift() ?? { data: { id: "default-id" }, error: null }
            return {
              select: () => ({
                single: async () => next,
              }),
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  })),
}))

function makeFormData(name = "My Product"): FormData {
  const fd = new FormData()
  fd.set("name", name)
  fd.set("story", "Story")
  fd.set("materials", "Cotton")
  fd.set("origin", "France")
  fd.set("lifecycle", "Repairable: Yes")
  fd.set("imageUrl", "https://example.com/p.jpg")
  return fd
}

describe("createProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    productInsertResponses.length = 0
    insertedPayloads.length = 0
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } })
    mockProfilesSingle.mockResolvedValue({ data: { brand_name: "Test Brand" }, error: null })
    vi.mocked(ensureBrandProfile).mockResolvedValue(undefined)
  })

  it("returns unauthorized when user is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const res = await createProduct(makeFormData())
    expect(res.success).toBe(false)
    expect(res.error).toBe("Unauthorized")
  })

  it("returns validation error when name is missing", async () => {
    const res = await createProduct(makeFormData("   "))
    expect(res.success).toBe(false)
    expect(res.error).toBe("Product name is required")
  })

  it("creates product successfully with json_ld when column exists", async () => {
    productInsertResponses.push({ data: { id: "prod-1" }, error: null })
    const res = await createProduct(makeFormData())
    expect(res.success).toBe(true)
    expect(res.productId).toBe("prod-1")
    expect(insertedPayloads).toHaveLength(1)
    expect(insertedPayloads[0]).toHaveProperty("json_ld")
  })

  it("falls back to insert without json_ld when column is missing", async () => {
    productInsertResponses.push(
      { data: null, error: { code: "PGRST204", message: "Could not find the 'json_ld' column of 'products' in the schema cache" } },
      { data: { id: "prod-fallback" }, error: null }
    )
    const res = await createProduct(makeFormData())
    expect(res.success).toBe(true)
    expect(res.productId).toBe("prod-fallback")
    expect(insertedPayloads).toHaveLength(2)
    expect(insertedPayloads[0]).toHaveProperty("json_ld")
    expect(insertedPayloads[1]).not.toHaveProperty("json_ld")
  })

  it("returns friendly message when fallback insert also fails", async () => {
    productInsertResponses.push(
      { data: null, error: { code: "PGRST204", message: "Could not find the 'json_ld' column of 'products' in the schema cache" } },
      { data: null, error: { message: "insert failed" } }
    )
    const res = await createProduct(makeFormData())
    expect(res.success).toBe(false)
    expect(res.error).toBe("We couldn't save the product right now. Please try again.")
  })

  it("returns friendly message on generic insert error", async () => {
    productInsertResponses.push({ data: null, error: { message: "permission denied" } })
    const res = await createProduct(makeFormData())
    expect(res.success).toBe(false)
    expect(res.error).toBe("We couldn't save the product right now. Please try again.")
  })
})

