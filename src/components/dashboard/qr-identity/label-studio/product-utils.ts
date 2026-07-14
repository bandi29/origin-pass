import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { productDisplayLabel } from "@/lib/product-display-label"

export function productMetaLine(p: ProductPrintCandidate): string | null {
  const sku = p.sku?.trim()
  const cat = p.category?.trim()
  if (sku && cat) return `${sku} · ${cat}`
  if (sku) return sku
  if (cat) return cat
  return null
}

export function productPrimaryLabel(p: ProductPrintCandidate): string {
  return productDisplayLabel(p.id, p.name)
}

export type PassportLinkStatus = "linked" | "awaiting"

export function passportLinkStatus(p: ProductPrintCandidate): PassportLinkStatus {
  return p.passportId ? "linked" : "awaiting"
}

export function passportStatusLabel(status: PassportLinkStatus): string {
  return status === "linked" ? "Passport linked" : "Awaiting passport"
}
