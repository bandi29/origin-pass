import { describe, it, expect } from "vitest"
import {
  isValidUuid,
  isValidSerialId,
  sanitizeForFilename,
  sanitizeFilename,
  isSafeImageUrl,
} from "./security"

describe("security", () => {
  describe("isValidUuid", () => {
    it("returns true for valid UUID v4", () => {
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
      expect(isValidUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true)
      expect(isValidUuid("  a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11  ")).toBe(true)
    })

    it("returns false for invalid UUID", () => {
      expect(isValidUuid("")).toBe(false)
      expect(isValidUuid("   ")).toBe(false)
      expect(isValidUuid("not-a-uuid")).toBe(false)
      expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false)
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false)
    })

    it("returns false for non-string input", () => {
      expect(isValidUuid(null as unknown as string)).toBe(false)
      expect(isValidUuid(undefined as unknown as string)).toBe(false)
    })
  })

  describe("isValidSerialId", () => {
    it("returns true for valid serial IDs", () => {
      expect(isValidSerialId("OP-ABC123")).toBe(true)
      expect(isValidSerialId("abc_123-xyz")).toBe(true)
      expect(isValidSerialId("A1B2C3")).toBe(true)
    })

    it("returns false for too short", () => {
      expect(isValidSerialId("ab")).toBe(false)
      expect(isValidSerialId("a")).toBe(false)
    })

    it("returns false for invalid characters", () => {
      expect(isValidSerialId("OP@ABC")).toBe(false)
      expect(isValidSerialId("OP ABC")).toBe(false)
      expect(isValidSerialId("OP.ABC")).toBe(false)
    })

    it("returns false for too long (>64 chars)", () => {
      expect(isValidSerialId("a".repeat(65))).toBe(false)
      expect(isValidSerialId("a".repeat(64))).toBe(true)
    })

    it("returns false for empty or non-string", () => {
      expect(isValidSerialId("")).toBe(false)
      expect(isValidSerialId("   ")).toBe(false)
      expect(isValidSerialId(null as unknown as string)).toBe(false)
    })
  })

  describe("sanitizeForFilename", () => {
    it("replaces unsafe chars with underscore", () => {
      expect(sanitizeForFilename("file/name")).toBe("file_name")
      expect(sanitizeForFilename("file:name")).toBe("file_name")
      expect(sanitizeForFilename("file*name")).toBe("file_name")
    })

    it("truncates to 64 chars", () => {
      expect(sanitizeForFilename("a".repeat(100)).length).toBe(64)
    })

    it("returns 'item' for empty or invalid", () => {
      expect(sanitizeForFilename("")).toBe("item")
      expect(sanitizeForFilename(null as unknown as string)).toBe("item")
    })
  })

  describe("sanitizeFilename", () => {
    it("sanitizes for Content-Disposition", () => {
      expect(sanitizeFilename("export.pdf")).toBe("export_pdf")
      expect(sanitizeFilename("my file name")).toBe("my_file_name")
    })

    it("truncates to 100 chars", () => {
      expect(sanitizeFilename("a".repeat(150)).length).toBe(100)
    })

    it("returns 'export' for empty or invalid", () => {
      expect(sanitizeFilename("")).toBe("export")
      expect(sanitizeFilename(null as unknown as string)).toBe("export")
    })
  })

  describe("isSafeImageUrl", () => {
    it("returns true for https URLs", () => {
      expect(isSafeImageUrl("https://example.com/image.png")).toBe(true)
    })

    it("returns true for http URLs", () => {
      expect(isSafeImageUrl("http://example.com/image.png")).toBe(true)
    })

    it("returns false for javascript: URLs", () => {
      expect(isSafeImageUrl("javascript:alert(1)")).toBe(false)
    })

    it("returns false for data: URLs", () => {
      expect(isSafeImageUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
    })

    it("returns false for empty, null, undefined", () => {
      expect(isSafeImageUrl("")).toBe(false)
      expect(isSafeImageUrl("   ")).toBe(false)
      expect(isSafeImageUrl(null)).toBe(false)
      expect(isSafeImageUrl(undefined)).toBe(false)
    })

    it("returns false for invalid URL", () => {
      expect(isSafeImageUrl("not-a-url")).toBe(false)
    })
  })
})
