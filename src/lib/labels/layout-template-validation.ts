import {
  LABEL_LAYOUT_SNAPSHOT_VERSION,
  LABEL_TEMPLATE_DESCRIPTION_MAX,
  LABEL_TEMPLATE_LOGO_MAX_BYTES,
  LABEL_TEMPLATE_NAME_MAX,
  type LabelLayoutSnapshot,
} from "@/lib/labels/layout-template-types"
import { byteLengthOfDataUrl } from "@/lib/labels/logo-snapshot-utils"
import { normalizeLayoutSnapshot } from "@/lib/labels/layout-template-snapshot"

export function trimTemplateName(name: unknown): string | null {
  if (typeof name !== "string") return null
  const trimmed = name.trim()
  if (!trimmed) return null
  if (trimmed.length > LABEL_TEMPLATE_NAME_MAX) return null
  return trimmed
}

export function trimTemplateDescription(description: unknown): string | null {
  if (description == null || description === "") return null
  if (typeof description !== "string") return null
  const trimmed = description.trim()
  if (!trimmed) return null
  if (trimmed.length > LABEL_TEMPLATE_DESCRIPTION_MAX) return null
  return trimmed
}

export function validateLayoutSnapshot(raw: unknown): LabelLayoutSnapshot | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Layout snapshot is required" }
  }
  const snap = normalizeLayoutSnapshot(raw)
  if (snap.snapshotVersion > LABEL_LAYOUT_SNAPSHOT_VERSION) {
    return { error: "Unsupported layout snapshot version" }
  }
  if (snap.logoDataUrl && byteLengthOfDataUrl(snap.logoDataUrl) > LABEL_TEMPLATE_LOGO_MAX_BYTES) {
    return { error: `Logo exceeds ${Math.round(LABEL_TEMPLATE_LOGO_MAX_BYTES / 1024)}KB limit` }
  }
  return snap
}

export function isDuplicateNameError(message: string): boolean {
  return message.includes("label_layout_templates_brand_name_unique") ||
    message.toLowerCase().includes("duplicate key")
}

export function duplicateNameUserMessage(): string {
  return "A template with this name already exists. Choose a different name."
}
