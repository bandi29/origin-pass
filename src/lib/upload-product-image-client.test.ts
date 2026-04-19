/**
 * Unit tests for client-side upload.
 * Mocks Supabase to verify validation and upload flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  validateFile,
  uploadProductImageClient,
} from "./upload-product-image-client"

function createMockFile(overrides: Partial<{ size: number; type: string; name: string }> = {}) {
  const defaults = {
    size: 1024,
    type: "image/png",
    name: "test.png",
  }
  const opts = { ...defaults, ...overrides }
  return new File([new Uint8Array(opts.size)], opts.name, { type: opts.type })
}

function createMockSupabase(overrides?: {
  getUser?: () => Promise<{ data: { user: { id: string } | null } }>
  getSession?: () => Promise<{ data: { session: { user: { id: string } } | null } }>
  upload?: () => Promise<{ data?: { path: string }; error?: { message: string } }>
  getPublicUrl?: (path: string) => { data: { publicUrl: string } }
}) {
  const defaultGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } })
  const defaultGetSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-123" } } } })
  const defaultUpload = vi.fn().mockResolvedValue({ data: { path: "user-123/123-abc.png" }, error: null })
  const defaultGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/product-images/user-123/123-abc.png" },
  })

  return {
    auth: {
      getUser: overrides?.getUser ?? defaultGetUser,
      getSession: overrides?.getSession ?? defaultGetSession,
    },
    storage: {
      from: () => ({
        upload: overrides?.upload ?? defaultUpload,
        getPublicUrl: overrides?.getPublicUrl ?? defaultGetPublicUrl,
      }),
    },
  } as Parameters<typeof uploadProductImageClient>[1]
}

describe("validateFile", () => {
  it("returns null for valid PNG", () => {
    const file = createMockFile({ type: "image/png" })
    expect(validateFile(file)).toBeNull()
  })

  it("returns error for file over 10MB", () => {
    const file = createMockFile({ size: 11 * 1024 * 1024 })
    expect(validateFile(file)).toContain("under 10MB")
  })

  it("returns error for invalid MIME type", () => {
    const file = createMockFile({ type: "application/pdf" })
    expect(validateFile(file)).toContain("Only JPEG, PNG, WebP, and GIF")
  })

  it("accepts image/jpeg and image/jpg", () => {
    expect(validateFile(createMockFile({ type: "image/jpeg" }))).toBeNull()
    expect(validateFile(createMockFile({ type: "image/jpg" }))).toBeNull()
  })
})

describe("uploadProductImageClient", () => {
  it("returns Unauthorized when user not logged in", async () => {
    const supabase = createMockSupabase({
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    })
    const file = createMockFile()
    const res = await uploadProductImageClient(file, supabase)
    expect(res.success).toBe(false)
    expect(res.error).toContain("Unauthorized")
  })

  it("returns success with URL when upload succeeds", async () => {
    const supabase = createMockSupabase()
    const file = createMockFile({ type: "image/jpeg", name: "photo.jpg" })
    const res = await uploadProductImageClient(file, supabase)
    expect(res.success).toBe(true)
    expect(res.url).toContain("product-images")
  })

  it("returns error when storage upload fails", async () => {
    const supabase = createMockSupabase({
      upload: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Bucket not found" },
      }),
    })
    const file = createMockFile()
    const res = await uploadProductImageClient(file, supabase)
    expect(res.success).toBe(false)
    expect(res.error).toBe("Bucket not found")
  })

  it("returns validation error for oversized file", async () => {
    const supabase = createMockSupabase()
    const file = createMockFile({ size: 11 * 1024 * 1024 })
    const res = await uploadProductImageClient(file, supabase)
    expect(res.success).toBe(false)
    expect(res.error).toContain("under 10MB")
  })
})
