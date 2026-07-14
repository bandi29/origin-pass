import { describe, expect, it } from "vitest"
import {
  computeStudioProgress,
  countReadySteps,
  type StudioProgressInput,
} from "@/components/dashboard/qr-identity/label-studio/use-studio-progress"
import { FALLBACK_VISUAL_TEMPLATE } from "@/components/dashboard/qr-identity/print-labels/visual-templates"

function baseInput(overrides: Partial<StudioProgressInput> = {}): StudioProgressInput {
  return {
    selectedProductIds: [],
    selectedTemplate: FALLBACK_VISUAL_TEMPLATE,
    cellWidthMm: 50,
    cellHeightMm: 90,
    destinationReady: false,
    hasSelection: false,
    hasPassportAmongSelection: false,
    currentStepId: "layout",
    ...overrides,
  }
}

function step(key: StudioProgressInput["currentStepId"], input: StudioProgressInput) {
  return computeStudioProgress(input).find((s) => s.key === key)!
}

describe("computeStudioProgress", () => {
  it("with 0 products, Branding does not show done and Products is blocked", () => {
    const steps = computeStudioProgress(baseInput({ currentStepId: "branding" }))
    expect(step("products", baseInput()).status).toBe("blocked")
    expect(step("branding", baseInput()).status).toBe("incomplete")
    expect(step("layout", baseInput()).status).toBe("incomplete")
    expect(step("destination", baseInput()).status).toBe("incomplete")
    expect(step("export", baseInput()).status).toBe("incomplete")
    expect(countReadySteps(steps)).toBe(0)
  })

  it("does not change checkmarks when only currentStepId changes", () => {
    const data = baseInput({
      selectedProductIds: ["p1"],
      hasSelection: true,
      destinationReady: false,
      hasPassportAmongSelection: false,
    })
    const a = computeStudioProgress({ ...data, currentStepId: "layout" })
    const b = computeStudioProgress({ ...data, currentStepId: "branding" })
    expect(a.map((s) => ({ key: s.key, status: s.status }))).toEqual(
      b.map((s) => ({ key: s.key, status: s.status })),
    )
    expect(a.find((s) => s.key === "layout")?.isCurrent).toBe(true)
    expect(b.find((s) => s.key === "branding")?.isCurrent).toBe(true)
  })

  it("complete up to step 4: steps 1–3 green, destination blocked, export incomplete", () => {
    const steps = computeStudioProgress(
      baseInput({
        selectedProductIds: ["p1"],
        hasSelection: true,
        currentStepId: "destination",
      }),
    )
    expect(step("products", baseInput({ selectedProductIds: ["p1"], hasSelection: true })).status).toBe(
      "done",
    )
    expect(step("layout", baseInput({ selectedProductIds: ["p1"], hasSelection: true })).status).toBe(
      "done",
    )
    expect(step("branding", baseInput({ selectedProductIds: ["p1"], hasSelection: true })).status).toBe(
      "done",
    )
    expect(steps.find((s) => s.key === "destination")?.status).toBe("blocked")
    expect(steps.find((s) => s.key === "destination")?.reason).toMatch(/Awaiting passport/)
    expect(steps.find((s) => s.key === "export")?.status).toBe("incomplete")
    expect(countReadySteps(steps)).toBe(3)
  })

  it("passport product turns Destination and Export green", () => {
    const input = baseInput({
      selectedProductIds: ["p1"],
      hasSelection: true,
      hasPassportAmongSelection: true,
      destinationReady: true,
    })
    expect(step("destination", input).status).toBe("done")
    expect(step("export", input).status).toBe("done")
    expect(countReadySteps(computeStudioProgress(input))).toBe(5)
  })

  it("removing passport reverts Destination and Export", () => {
    const withPassport = baseInput({
      selectedProductIds: ["p1"],
      hasSelection: true,
      hasPassportAmongSelection: true,
      destinationReady: true,
    })
    const withoutPassport = baseInput({
      selectedProductIds: ["p1"],
      hasSelection: true,
      hasPassportAmongSelection: false,
      destinationReady: false,
    })
    expect(step("destination", withPassport).status).toBe("done")
    expect(step("export", withPassport).status).toBe("done")
    expect(step("destination", withoutPassport).status).toBe("blocked")
    expect(step("export", withoutPassport).status).toBe("incomplete")
  })

  it("removing last product reverts later steps from done to incomplete/blocked", () => {
    const empty = baseInput()
    const selected = baseInput({
      selectedProductIds: ["p1"],
      hasSelection: true,
      destinationReady: true,
      hasPassportAmongSelection: true,
    })
    expect(countReadySteps(computeStudioProgress(selected))).toBe(5)
    expect(countReadySteps(computeStudioProgress(empty))).toBe(0)
    expect(step("products", empty).status).toBe("blocked")
  })
})
