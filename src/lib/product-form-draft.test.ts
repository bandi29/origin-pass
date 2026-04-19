/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { loadDraft, saveDraft, clearDraft, DRAFT_KEY } from "./product-form-draft"

const mockDraft = {
  productName: "Handcrafted Leather Satchel",
  story: "Short craftsmanship story",
  selectedMaterials: ["Leather"],
  materialsOther: "Vegetable-tanned leather",
  originCountry: "France",
  originState: "Ile-de-France",
  originCity: "Paris",
  originOther: "",
  repairable: "Yes",
  lifespan: "10-20",
  recyclable: "Yes",
  imageUrl: "https://example.com/image.jpg",
}

describe("product-form-draft", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear()
    if (typeof sessionStorage !== "undefined") sessionStorage.clear()
  })

  describe("saveDraft and loadDraft", () => {
    it("saves and restores full draft", () => {
      saveDraft(mockDraft)
      const loaded = loadDraft()
      expect(loaded).not.toBeNull()
      expect(loaded?.productName).toBe(mockDraft.productName)
      expect(loaded?.story).toBe(mockDraft.story)
      expect(loaded?.selectedMaterials).toEqual(mockDraft.selectedMaterials)
      expect(loaded?.materialsOther).toBe(mockDraft.materialsOther)
      expect(loaded?.originCountry).toBe(mockDraft.originCountry)
      expect(loaded?.originState).toBe(mockDraft.originState)
      expect(loaded?.originCity).toBe(mockDraft.originCity)
      expect(loaded?.imageUrl).toBe(mockDraft.imageUrl)
      expect(typeof loaded?.savedAt).toBe("number")
    })

    it("returns null when no draft exists", () => {
      expect(loadDraft()).toBeNull()
    })

    it("returns null when draft is expired (>30 days)", () => {
      saveDraft(mockDraft)
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY)!)
      raw.ts = Date.now() - 31 * 24 * 60 * 60 * 1000
      localStorage.setItem(DRAFT_KEY, JSON.stringify(raw))
      expect(loadDraft()).toBeNull()
    })

    it("returns draft when within 30 days", () => {
      saveDraft(mockDraft)
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY)!)
      raw.ts = Date.now() - 2 * 24 * 60 * 60 * 1000
      localStorage.setItem(DRAFT_KEY, JSON.stringify(raw))
      expect(loadDraft()).not.toBeNull()
      expect(loadDraft()?.productName).toBe(mockDraft.productName)
    })

    it("keeps draft at exact 30-day boundary", () => {
      saveDraft(mockDraft)
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY)!)
      raw.ts = Date.now() - 30 * 24 * 60 * 60 * 1000
      localStorage.setItem(DRAFT_KEY, JSON.stringify(raw))
      expect(loadDraft()).not.toBeNull()
    })

    it("handles corrupted storage gracefully", () => {
      localStorage.setItem(DRAFT_KEY, "not valid json")
      expect(loadDraft()).toBeNull()
    })

    it("handles empty draft", () => {
      saveDraft({
        productName: "",
        story: "",
        selectedMaterials: [],
        materialsOther: "",
        originCountry: "",
        originState: "",
        originCity: "",
        originOther: "",
        repairable: "",
        lifespan: "",
        recyclable: "",
        imageUrl: "",
      })
      const loaded = loadDraft()
      expect(loaded).not.toBeNull()
      expect(loaded?.productName).toBe("")
      expect(loaded?.selectedMaterials).toEqual([])
    })
  })

  describe("clearDraft", () => {
    it("removes draft from storage", () => {
      saveDraft(mockDraft)
      expect(loadDraft()).not.toBeNull()
      clearDraft()
      expect(loadDraft()).toBeNull()
    })
  })

  describe("SSR safety", () => {
    it("saveDraft and clearDraft do not throw when window is undefined", () => {
      const orig = globalThis.window
      vi.stubGlobal("window", undefined as unknown as Window)
      expect(() => saveDraft(mockDraft)).not.toThrow()
      expect(() => clearDraft()).not.toThrow()
      vi.stubGlobal("window", orig)
    })
  })
})
