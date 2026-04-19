/**
 * Unit tests for upload-product-image server action.
 * Mocks Supabase to verify validation logic and upload flow.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { uploadProductImage } from "./upload-product-image"

// Mock Supabase server client
const mockStorageUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockAuthGetUser = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: () => mockAuthGetUser() },
      storage: {
        from: () => ({
          upload: (...args: unknown[]) => mockStorageUpload(...args),
          getPublicUrl: (path: string) => mockGetPublicUrl(path),
        }),
      },
    })
  ),
}))

// Mock Supabase admin client (for ensureBucketExists)
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      listBuckets: vi.fn().mockResolvedValue({ data: [{ name: "product-images" }], error: null }),
      createBucket: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

// Mock next/headers for cookies (createClient uses it)
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: () => {} })),
}))

function createMockFile(overrides: Partial<{ size: number; type: string; name: string }> = {}) {
  const defaults = {
    size: 1024,
    type: "image/png",
    name: "test.png",
  }
  const opts = { ...defaults, ...overrides }
  // Use real File (Node 18+) so FormData.get("file") returns proper object
  return new File([new Uint8Array(opts.size)], opts.name, { type: opts.type })
}

describe("uploadProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    })
    mockStorageUpload.mockResolvedValue({ data: { path: "user-123/123-abc.png" }, error: null })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.supabase.co/storage/v1/object/public/product-images/user-123/123-abc.png" },
    })
  })

  it("returns error when no file provided", async () => {
    const fd = new FormData()
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toContain("No file provided")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("returns error when file is too large (>10MB)", async () => {
    const fd = new FormData()
    const bigFile = createMockFile({ size: 11 * 1024 * 1024 })
    fd.set("file", bigFile)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toContain("under 10MB")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("returns error for invalid MIME type", async () => {
    const fd = new FormData()
    const file = createMockFile({ type: "application/pdf" })
    fd.set("file", file)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toContain("Only JPEG, PNG, WebP, and GIF")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("returns Unauthorized when user not logged in", async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: null } })
    const fd = new FormData()
    const file = createMockFile()
    fd.set("file", file)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toBe("Unauthorized")
    expect(mockStorageUpload).not.toHaveBeenCalled()
  })

  it("returns success with URL when upload succeeds", async () => {
    const fd = new FormData()
    const file = createMockFile({ type: "image/jpeg", name: "photo.jpg" })
    fd.set("file", file)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(true)
    expect(res.url).toContain("product-images")
    expect(mockStorageUpload).toHaveBeenCalled()
  })

  it("returns error when Supabase storage upload fails", async () => {
    mockStorageUpload.mockResolvedValueOnce({
      data: null,
      error: { message: "Bucket not found" },
    })
    const fd = new FormData()
    const file = createMockFile()
    fd.set("file", file)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toBe("Bucket not found")
  })

  it("accepts image/jpg MIME type", async () => {
    const fd = new FormData()
    const file = createMockFile({ type: "image/jpg" })
    fd.set("file", file)
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(true)
  })

  it("rejects object without size/arrayBuffer (truncated file)", async () => {
    const fd = new FormData()
    fd.set("file", { foo: "bar" } as unknown as Blob) // plain object, no size/arrayBuffer
    const res = await uploadProductImage(fd)
    expect(res.success).toBe(false)
    expect(res.error).toContain("No file provided")
  })
})
