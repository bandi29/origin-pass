import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateSerialId } from "./crypto"

describe("crypto", () => {
  describe("generateSerialId", () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it("generates serial ID with default OP prefix", () => {
      const id = generateSerialId()
      expect(id).toMatch(/^OP-[A-F0-9]{12}$/)
      expect(id.length).toBe(15) // "OP-" (3) + 12 hex chars
    })

    it("generates serial ID with custom prefix", () => {
      const id = generateSerialId("BR")
      expect(id).toMatch(/^BR-[A-F0-9]{12}$/)
    })

    it("produces unique IDs on each call", () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateSerialId())
      }
      expect(ids.size).toBe(100)
    })
  })
})
