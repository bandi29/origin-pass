import { FileBadge2, ShieldCheck, QrCode, RefreshCw } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export type ProductModule = {
  id: string
  slug: string
  title: string
  description: string
  icon: LucideIcon
  /** Soft tint + stroke colors for the icon container on hub cards. */
  iconTheme?: string
}

export const productModules: ProductModule[] = [
  {
    id: "passports",
    slug: "passports",
    title: "Digital Product Passports",
    description: "Create structured product records for trust and compliance readiness.",
    icon: FileBadge2,
    iconTheme: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  },
  {
    id: "authenticity",
    slug: "authenticity",
    title: "Authenticity Verification",
    description: "Give customers instant proof a product is genuine.",
    icon: ShieldCheck,
    iconTheme: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  },
  {
    id: "qr-identity",
    slug: "qr-identity",
    title: "QR Product Identity",
    description: "Attach unique QR identities to products and batches.",
    icon: QrCode,
    iconTheme: "bg-violet-50 text-violet-600 group-hover:bg-violet-100",
  },
  {
    id: "ownership",
    slug: "ownership",
    title: "Ownership & Lifecycle Tracking",
    description: "Track post-purchase ownership and warranty journeys.",
    icon: RefreshCw,
    iconTheme: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  },
]

export function getProductModuleBySlug(slug: string): ProductModule | undefined {
  return productModules.find((m) => m.slug === slug)
}
