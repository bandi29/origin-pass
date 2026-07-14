export const SUPPORTED_PRINTERS = ["Zebra", "DYMO", "Brother", "PDF standard", "SVG export"] as const
export type SupportedPrinter = (typeof SUPPORTED_PRINTERS)[number]

export type LabelExportFormat = "pdf" | "svg" | "png" | "zip" | "csv"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only real DB template rows use UUID ids; studio fallbacks like `sys-luxury` must not be inserted. */
export function resolvePersistedTemplateId(templateId: string | null | undefined): string | null {
  if (!templateId?.trim()) return null
  return UUID_REGEX.test(templateId.trim()) ? templateId.trim() : null
}

export function normalizePrinter(value: string | undefined): SupportedPrinter {
  if (!value) return "PDF standard"
  return (SUPPORTED_PRINTERS.find((p) => p.toLowerCase() === value.toLowerCase()) ?? "PDF standard") as SupportedPrinter
}

export function sanitizeDimensions(value: string | undefined) {
  const v = (value ?? "").trim()
  return v || "2x2 inch"
}

export function defaultSerializedFields() {
  return ["serial_id", "sku", "passport_url"]
}
