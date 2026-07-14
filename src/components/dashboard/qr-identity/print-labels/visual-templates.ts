import type { LabelTemplate } from "@/lib/label-print-studio-server-data"
import type { VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"

const GRID_BY_KEY: Record<string, { cols: number; rows: number; doubleSided: boolean }> = {
  "sys-luxury": { cols: 1, rows: 1, doubleSided: true },
  "sys-thermal": { cols: 4, rows: 6, doubleSided: false },
  "sys-pack": { cols: 2, rows: 2, doubleSided: false },
  "sys-compliance": { cols: 3, rows: 4, doubleSided: false },
}

function inferGrid(template: LabelTemplate): { cols: number; rows: number; doubleSided: boolean } {
  const preset = GRID_BY_KEY[template.id]
  if (preset) return preset
  const blob = `${template.category} ${template.name} ${template.dimensions}`.toLowerCase()
  if (blob.includes("hang") || blob.includes("tag")) {
    return { cols: 1, rows: 1, doubleSided: true }
  }
  if (blob.includes("thermal") || blob.includes("1x1")) {
    return { cols: 4, rows: 6, doubleSided: false }
  }
  if (blob.includes("pack")) {
    return { cols: 2, rows: 2, doubleSided: false }
  }
  if (blob.includes("sheet") || blob.includes("a4") || blob.includes("compliance")) {
    return { cols: 3, rows: 4, doubleSided: false }
  }
  return { cols: 3, rows: 4, doubleSided: false }
}

export function buildVisualTemplates(templates: LabelTemplate[]): VisualTemplate[] {
  return templates.map((t) => {
    const grid = inferGrid(t)
    return {
      id: t.id,
      name: t.name,
      dimensions: t.dimensions,
      cols: grid.cols,
      rows: grid.rows,
      doubleSided: grid.doubleSided,
    }
  })
}

export const FALLBACK_VISUAL_TEMPLATE: VisualTemplate = {
  id: "sys-luxury",
  name: "Luxury Hang Tag",
  dimensions: "50×90 mm",
  cols: 1,
  rows: 1,
  doubleSided: true,
}
