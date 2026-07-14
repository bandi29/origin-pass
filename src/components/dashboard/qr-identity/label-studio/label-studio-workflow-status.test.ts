import { describe, expect, it } from "vitest"
import {
  deriveLabelStudioWorkflowStatus,
  destinationCardBlockedMessage,
} from "@/components/dashboard/qr-identity/label-studio/label-studio-workflow-status"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"

function product(overrides: Partial<ProductPrintCandidate> = {}): ProductPrintCandidate {
  return {
    id: "p1",
    name: "Test",
    sku: "SKU-1",
    category: "leather",
    supplier: null,
    batchId: null,
    verificationStatus: "verified",
    qrStatus: "active",
    imageUrl: null,
    passportId: null,
    origin: null,
    materials: null,
    story: null,
    ...overrides,
  }
}

describe("deriveLabelStudioWorkflowStatus", () => {
  it("marks products todo and destination todo when empty", () => {
    const w = deriveLabelStudioWorkflowStatus([])
    expect(w.selectionCount).toBe(0)
    expect(w.productsStepStatus).toBe("todo")
    expect(w.destinationStepStatus).toBe("todo")
    expect(w.destinationReady).toBe(false)
    expect(w.exportPrintReady).toBe(false)
    expect(w.exportPrintBlockedReason).toMatch(/Select at least one/)
  })

  it("marks products done and destination warn without passport", () => {
    const w = deriveLabelStudioWorkflowStatus([product()])
    expect(w.productsStepStatus).toBe("done")
    expect(w.destinationStepStatus).toBe("warn")
    expect(w.destinationInspectorTabStatus).toBe("attention")
    expect(w.destinationReady).toBe(false)
    expect(w.exportPrintBlockedReason).toMatch(/active digital passport/)
  })

  it("marks destination done when any selected product has passportId", () => {
    const w = deriveLabelStudioWorkflowStatus([
      product({ id: "a" }),
      product({ id: "b", passportId: "pass-123" }),
    ])
    expect(w.destinationStepStatus).toBe("done")
    expect(w.destinationInspectorTabStatus).toBe("valid")
    expect(w.destinationReady).toBe(true)
    expect(w.exportPrintReady).toBe(true)
    expect(w.exportPrintBlockedReason).toBeNull()
  })
})

describe("destinationCardBlockedMessage", () => {
  it("returns distinct copy for no selection vs no passport", () => {
    expect(destinationCardBlockedMessage({ hasSelection: false, hasPassportAmongSelection: false })).toMatch(
      /Add at least one product/,
    )
    expect(destinationCardBlockedMessage({ hasSelection: true, hasPassportAmongSelection: false })).toMatch(
      /active digital passport/,
    )
    expect(destinationCardBlockedMessage({ hasSelection: true, hasPassportAmongSelection: true })).toBe("")
  })
})
