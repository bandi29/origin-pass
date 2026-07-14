import type { InspectorTabStatus } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import type { LabelStudioStepStatus } from "@/components/dashboard/qr-identity/label-studio/types"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"

export type LabelStudioWorkflowStatus = {
  selectionCount: number
  hasSelection: boolean
  hasPassportAmongSelection: boolean
  /** ≥1 product selected and at least one has an active passport (`passportId`). */
  destinationReady: boolean
  productsStepStatus: LabelStudioStepStatus
  destinationStepStatus: LabelStudioStepStatus
  destinationInspectorTabStatus: InspectorTabStatus
  destinationInspectorTabLabel: string | undefined
  /** Shown in Destination card + tooltips when export/print are blocked. */
  exportPrintBlockedReason: string | null
  exportPrintReady: boolean
}

export function deriveLabelStudioWorkflowStatus(
  selectedProducts: ProductPrintCandidate[],
): LabelStudioWorkflowStatus {
  const selectionCount = selectedProducts.length
  const hasSelection = selectionCount >= 1
  const hasPassportAmongSelection = selectedProducts.some((p) => Boolean(p.passportId))
  const destinationReady = hasSelection && hasPassportAmongSelection

  const productsStepStatus: LabelStudioStepStatus = hasSelection ? "done" : "todo"

  let destinationStepStatus: LabelStudioStepStatus = "todo"
  if (destinationReady) destinationStepStatus = "done"
  else if (hasSelection) destinationStepStatus = "warn"

  let destinationInspectorTabStatus: InspectorTabStatus = "info"
  if (destinationReady) destinationInspectorTabStatus = "valid"
  else if (hasSelection) destinationInspectorTabStatus = "attention"

  const destinationInspectorTabLabel =
    destinationInspectorTabStatus === "attention" ? "Awaiting passport" : undefined

  let exportPrintBlockedReason: string | null = null
  if (!hasSelection) {
    exportPrintBlockedReason = "Select at least one product to export or print labels."
  } else if (!hasPassportAmongSelection) {
    exportPrintBlockedReason =
      "Link an active digital passport to at least one selected product before exporting or printing."
  }

  return {
    selectionCount,
    hasSelection,
    hasPassportAmongSelection,
    destinationReady,
    productsStepStatus,
    destinationStepStatus,
    destinationInspectorTabStatus,
    destinationInspectorTabLabel,
    exportPrintBlockedReason,
    exportPrintReady: destinationReady,
  }
}

/** Human-readable blocker for the Destination inspector card (not export tooltips). */
export function destinationCardBlockedMessage(
  workflow: Pick<LabelStudioWorkflowStatus, "hasSelection" | "hasPassportAmongSelection">,
): string {
  if (!workflow.hasSelection) {
    return "Add at least one product to configure the scan destination for these labels."
  }
  if (!workflow.hasPassportAmongSelection) {
    return "None of the selected products have an active digital passport. Create or activate a passport, then return here."
  }
  return ""
}
