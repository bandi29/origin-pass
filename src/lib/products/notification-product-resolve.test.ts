import { describe, expect, it, vi } from "vitest"
import { ilikeLiteralFragment, resolveScopedProductIds } from "./notification-product-resolve"

describe("notification-product-resolve", () => {
  describe("ilikeLiteralFragment", () => {
    it("removes ILIKE metacharacters", () => {
      expect(ilikeLiteralFragment("100% Leather")).toBe("100 Leather")
      expect(ilikeLiteralFragment("a_b")).toBe("ab")
    })
  })

  describe("resolveScopedProductIds", () => {
    it("returns no_input when sku and name missing", async () => {
      const q = vi.fn()
      await expect(resolveScopedProductIds({}, q)).resolves.toEqual({
        productId: null,
        reason: "no_input",
      })
      expect(q).not.toHaveBeenCalled()
    })

    it("returns first unique sku match", async () => {
      const q = vi.fn(
        async (f: { type: string; value: string }) => {
          if (f.type === "sku" && f.value === "SKU-1") return ["p1"]
          return []
        },
      )
      await expect(resolveScopedProductIds({ sku: "SKU-1" }, q)).resolves.toEqual({
        productId: "p1",
        reason: "ok",
      })
      expect(q).toHaveBeenCalledOnce()
    })

    it("falls through sku to name_exact when sku ambiguous", async () => {
      const calls: string[] = []
      const q = vi.fn(async (f: { type: string; value: string }) => {
        calls.push(`${f.type}:${f.value}`)
        if (f.type === "sku") return ["a", "b"]
        if (f.type === "name_exact") return ["p9"]
        return []
      })
      await expect(
        resolveScopedProductIds({ sku: "x", name: "Leather Tote" }, q),
      ).resolves.toEqual({ productId: "p9", reason: "ok" })
      expect(calls).toEqual(["sku:x", "name_exact:Leather Tote"])
    })

    it("uses name_loose when exact name not unique", async () => {
      const q = vi.fn(async (f: { type: string; value: string }) => {
        if (f.type === "name_exact") return ["a", "b"]
        if (f.type === "name_loose" && f.value === "%Leather Tote Bag%") return ["only"]
        return []
      })
      await expect(resolveScopedProductIds({ name: "Leather Tote Bag" }, q)).resolves.toEqual({
        productId: "only",
        reason: "ok",
      })
    })

    it("returns not_found when all queries empty", async () => {
      const q = vi.fn(async () => [])
      await expect(resolveScopedProductIds({ sku: "nope", name: "nope" }, q)).resolves.toEqual({
        productId: null,
        reason: "not_found",
      })
    })

    it("returns ambiguous when last query returns 2 ids", async () => {
      const q = vi.fn(async (f: { type: string }) => {
        if (f.type === "sku") return ["x", "y"]
        if (f.type === "name_exact") return ["a", "b"]
        if (f.type === "name_loose") return ["m", "n"]
        return []
      })
      await expect(resolveScopedProductIds({ sku: "s", name: "Long Enough Name" }, q)).resolves.toEqual({
        productId: null,
        reason: "ambiguous",
      })
    })

    it("skips name_loose when fragment shorter than 3 chars", async () => {
      const q = vi.fn(async (f: { type: string }) => {
        if (f.type === "name_exact") return []
        return ["should-not-run"]
      })
      await expect(resolveScopedProductIds({ name: "Lo" }, q)).resolves.toEqual({
        productId: null,
        reason: "not_found",
      })
      expect(q.mock.calls.every((c) => (c[0] as { type: string }).type !== "name_loose")).toBe(true)
    })
  })
})
