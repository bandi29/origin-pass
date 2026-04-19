import { FileBadge2, ShieldCheck, QrCode, RefreshCw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type ProductModule = {
  id: string
  slug: string
  title: string
  description: string
  icon: LucideIcon
}

export const productModules: ProductModule[] = [
  {
    id: "passports",
    slug: "passports",
    title: "Digital Product Passports",
    description: "Create structured product records for trust and compliance readiness.",
    icon: FileBadge2,
  },
  {
    id: "authenticity",
    slug: "authenticity",
    title: "Authenticity Verification",
    description: "Give customers instant proof a product is genuine.",
    icon: ShieldCheck,
  },
  {
    id: "qr-identity",
    slug: "qr-identity",
    title: "QR Product Identity",
    description: "Attach unique QR identities to products and batches.",
    icon: QrCode,
  },
  {
    id: "ownership",
    slug: "ownership",
    title: "Ownership & Lifecycle Tracking",
    description: "Track post-purchase ownership and warranty journeys.",
    icon: RefreshCw,
  },
]

export function getProductModuleBySlug(slug: string): ProductModule | undefined {
  return productModules.find((m) => m.slug === slug)
}
