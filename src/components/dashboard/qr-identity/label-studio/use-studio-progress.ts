"use client"

import { useMemo } from "react"
import type { VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"
import type { LabelStudioStepId } from "@/components/dashboard/qr-identity/label-studio/types"

export type StudioProgressStepStatus = "done" | "blocked" | "incomplete"

export type StudioProgressStep = {
  key: LabelStudioStepId
  label: string
  index: number
  satisfied: boolean
  required: boolean
  status: StudioProgressStepStatus
  isCurrent: boolean
  reason?: string
  subtext: string
}

const STEP_ORDER: { key: LabelStudioStepId; label: string; index: number; required: boolean }[] = [
  { key: "products", label: "Products", index: 1, required: true },
  { key: "layout", label: "Layout", index: 2, required: true },
  { key: "branding", label: "Branding", index: 3, required: false },
  { key: "destination", label: "Destination", index: 4, required: true },
  { key: "export", label: "Export", index: 5, required: true },
]

export type StudioProgressInput = {
  selectedProductIds: string[]
  selectedTemplate: VisualTemplate | null
  cellWidthMm: number
  cellHeightMm: number
  destinationReady: boolean
  hasSelection: boolean
  hasPassportAmongSelection: boolean
  currentStepId: LabelStudioStepId
}

function isProductsSatisfied(input: StudioProgressInput): boolean {
  return input.selectedProductIds.length > 0
}

function isLayoutSatisfied(input: StudioProgressInput): boolean {
  return Boolean(
    input.selectedTemplate &&
      Number.isFinite(input.cellWidthMm) &&
      input.cellWidthMm > 0 &&
      Number.isFinite(input.cellHeightMm) &&
      input.cellHeightMm > 0,
  )
}

/** Branding is optional and always satisfied by studio defaults. */
function isBrandingSatisfied(): boolean {
  return true
}

function isDestinationSatisfied(input: StudioProgressInput): boolean {
  return input.destinationReady
}

function isExportSatisfied(input: StudioProgressInput): boolean {
  return (
    isProductsSatisfied(input) && isLayoutSatisfied(input) && isDestinationSatisfied(input)
  )
}

function stepSatisfied(key: LabelStudioStepId, input: StudioProgressInput): boolean {
  switch (key) {
    case "products":
      return isProductsSatisfied(input)
    case "layout":
      return isLayoutSatisfied(input)
    case "branding":
      return isBrandingSatisfied()
    case "destination":
      return isDestinationSatisfied(input)
    case "export":
      return isExportSatisfied(input)
    default:
      return false
  }
}

function priorRequiredSatisfied(stepIndex: number, satisfiedByKey: Record<LabelStudioStepId, boolean>): boolean {
  for (let i = 0; i < stepIndex; i += 1) {
    const meta = STEP_ORDER[i]
    if (meta.required && !satisfiedByKey[meta.key]) return false
  }
  return true
}

function blockedReason(key: LabelStudioStepId, input: StudioProgressInput): string {
  switch (key) {
    case "products":
      return "Select at least one product"
    case "layout":
      return "Choose a template and cell size"
    case "destination":
      if (!input.hasSelection) return "Select products first"
      if (!input.hasPassportAmongSelection) return "Awaiting passport"
      return "Configure scan destination"
    case "export":
      return "Complete required steps first"
    default:
      return "Needs attention"
  }
}

function doneSubtext(key: LabelStudioStepId, input: StudioProgressInput): string {
  switch (key) {
    case "products": {
      const n = input.selectedProductIds.length
      return n === 1 ? "1 selected" : `${n} selected`
    }
    case "layout":
      return input.selectedTemplate?.name?.trim() || "Template ready"
    case "branding":
      return "Ready"
    case "destination":
      return "Passport linked"
    case "export":
      return "Ready to export"
    default:
      return "Ready"
  }
}

function incompleteHint(key: LabelStudioStepId): string {
  switch (key) {
    case "products":
      return "Add products"
    case "layout":
      return "Set layout"
    case "branding":
      return "Optional"
    case "destination":
      return "Link passport"
    case "export":
      return "Finish setup"
    default:
      return "Not started"
  }
}

function resolveSubtext(
  key: LabelStudioStepId,
  status: StudioProgressStepStatus,
  isCurrent: boolean,
  input: StudioProgressInput,
  reason?: string,
): string {
  if (status === "blocked") return reason ?? blockedReason(key, input)
  if (isCurrent) return "In progress"
  if (status === "done") return doneSubtext(key, input)
  return incompleteHint(key)
}

/** Pure progress model — identical input always yields identical steps. */
export function computeStudioProgress(input: StudioProgressInput): StudioProgressStep[] {
  const satisfiedByKey = STEP_ORDER.reduce(
    (acc, meta) => {
      acc[meta.key] = stepSatisfied(meta.key, input)
      return acc
    },
    {} as Record<LabelStudioStepId, boolean>,
  )

  return STEP_ORDER.map((meta, stepIndex) => {
    const satisfied = satisfiedByKey[meta.key]
    const priorRequiredDone = priorRequiredSatisfied(stepIndex, satisfiedByKey)
    const isCurrent = input.currentStepId === meta.key

    let status: StudioProgressStepStatus = "incomplete"
    let reason: string | undefined

    if (meta.required && !satisfied && priorRequiredDone) {
      status = "blocked"
      reason = blockedReason(meta.key, input)
    } else if (satisfied && priorRequiredDone) {
      status = "done"
    }

    const subtext = resolveSubtext(meta.key, status, isCurrent, input, reason)

    return {
      key: meta.key,
      label: meta.label,
      index: meta.index,
      satisfied,
      required: meta.required,
      status,
      isCurrent,
      reason,
      subtext,
    }
  })
}

export function countReadySteps(steps: StudioProgressStep[]): number {
  return steps.filter((s) => s.status === "done").length
}

export function useStudioProgress(input: StudioProgressInput) {
  const {
    selectedProductIds,
    selectedTemplate,
    cellWidthMm,
    cellHeightMm,
    destinationReady,
    hasSelection,
    hasPassportAmongSelection,
    currentStepId,
  } = input

  const steps = useMemo(
    () =>
      computeStudioProgress({
        selectedProductIds,
        selectedTemplate,
        cellWidthMm,
        cellHeightMm,
        destinationReady,
        hasSelection,
        hasPassportAmongSelection,
        currentStepId,
      }),
    [
      selectedProductIds,
      selectedTemplate,
      cellWidthMm,
      cellHeightMm,
      destinationReady,
      hasSelection,
      hasPassportAmongSelection,
      currentStepId,
    ],
  )
  const readyCount = useMemo(() => countReadySteps(steps), [steps])
  return { steps, readyCount, totalSteps: STEP_ORDER.length }
}
