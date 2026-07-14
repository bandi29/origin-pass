import type { LayoutUnit } from "./types"

export function formatLengthFromMm(mm: number, unit: LayoutUnit): string {
  if (unit === "mm") return `${mm.toFixed(1)} mm`
  if (unit === "in") return `${(mm / 25.4).toFixed(2)} in`
  const px = mm * (96 / 25.4)
  return `${Math.round(px)} px`
}

/** Preview canvas scale: mm → px for on-screen bounding boxes. */
export function previewMmToPx(mm: number): number {
  return Math.min(120, Math.max(24, mm * 3.78))
}

export function printJobStatusTone(status: string): string {
  if (status === "failed") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "processing" || status === "queued") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

export function printJobStatusLabel(status: string): string {
  if (status === "queued") return "In Queue"
  if (status === "processing") return "Processing"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function previewModeChipLabel(mode: string): string {
  switch (mode) {
    case "single":
      return "SINGLE"
    case "sheet":
      return "SHEET"
    case "hangtag":
      return "TAG"
    case "packaging":
      return "BOX"
    default:
      return mode.toUpperCase()
  }
}
