import { describe, it, expect } from "vitest"
import { validateMaterialComposition } from "./material-validation"

describe("material-validation", () => {
  describe("validateMaterialComposition", () => {
    it("returns valid for single material at 100%", () => {
      const result = validateMaterialComposition([{ material: "Leather", percentage: 100 }])
      expect(result.valid).toBe(true)
      expect(result.total).toBe(100)
    })

    it("returns valid for multiple materials totaling 100%", () => {
      const result = validateMaterialComposition([
        { material: "Wool", percentage: 60 },
        { material: "Cotton", percentage: 40 },
      ])
      expect(result.valid).toBe(true)
      expect(result.total).toBe(100)
    })

    it("returns invalid when total < 100%", () => {
      const result = validateMaterialComposition([
        { material: "Wool", percentage: 50 },
        { material: "Cotton", percentage: 30 },
      ])
      expect(result.valid).toBe(false)
      expect(result.total).toBe(80)
      expect(result.error).toContain("100%")
      expect(result.error).toContain("80%")
    })

    it("returns invalid when total > 100%", () => {
      const result = validateMaterialComposition([
        { material: "Wool", percentage: 60 },
        { material: "Cotton", percentage: 50 },
      ])
      expect(result.valid).toBe(false)
      expect(result.total).toBe(110)
      expect(result.error).toContain("exceed 100%")
    })

    it("returns invalid for empty entries", () => {
      const result = validateMaterialComposition([])
      expect(result.valid).toBe(false)
      expect(result.error).toBe("Add at least one material")
    })

    it("returns invalid when material name is empty", () => {
      const result = validateMaterialComposition([
        { material: "Wool", percentage: 50 },
        { material: "  ", percentage: 50 },
      ])
      expect(result.valid).toBe(false)
      expect(result.error).toBe("All materials must have a name")
    })

    it("treats 0 as valid percentage", () => {
      const result = validateMaterialComposition([
        { material: "A", percentage: 100 },
        { material: "B", percentage: 0 },
      ])
      expect(result.valid).toBe(true)
      expect(result.total).toBe(100)
    })
  })
})
