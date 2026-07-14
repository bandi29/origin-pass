/** Top progress-rail steps (Products is not an Inspector tab). */
export type LabelStudioStepId = "products" | "layout" | "branding" | "destination" | "export"

export type LabelStudioStepStatus = "todo" | "active" | "done" | "warn"

/** Inspector panel tabs; Export step maps to `output`. */
export type LabelStudioInspectorTab = "layout" | "branding" | "destination" | "output"

export type LabelStudioStepDef = {
  id: LabelStudioStepId
  label: string
  /** 1-based index shown in todo nodes */
  index: number
  status: LabelStudioStepStatus
}
