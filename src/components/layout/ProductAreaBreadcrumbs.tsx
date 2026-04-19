"use client"

import { useMemo } from "react"
import { usePathname } from "@/i18n/navigation"
import { Breadcrumb, BreadcrumbItem } from "@/components/ui/Breadcrumb"

const MODULE_LABELS: Record<string, string> = {
  passports: "Passports",
  authenticity: "Authenticity",
  "qr-identity": "QR Identity",
  ownership: "Ownership",
}

const LEAF_LABELS: Record<string, string> = {
  records: "Records",
  transfer: "Transfer",
  warranty: "Warranty",
  activity: "Activity",
  batch: "Batch",
  templates: "Templates",
  create: "Create",
  alerts: "Alerts",
  reports: "Reports",
  rules: "Rules",
  generate: "Generate",
  print: "Print",
}

function prettySegment(seg: string) {
  return seg
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function labelForSegment(seg: string) {
  if (MODULE_LABELS[seg]) return MODULE_LABELS[seg]
  if (LEAF_LABELS[seg]) return LEAF_LABELS[seg]
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
    return "Passport"
  }
  return prettySegment(seg)
}

export function ProductAreaBreadcrumbs() {
  const pathname = usePathname()

  const items = useMemo(() => {
    if (!pathname) return []
    const noLocale =
      pathname.replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
    const parts = noLocale.split("/").filter(Boolean)
    if (parts[0] !== "product") return []

    const rest = parts.slice(1)
    if (rest.length === 0) {
      return [{ label: "Product", href: undefined as string | undefined }]
    }

    const out: { label: string; href?: string }[] = [
      { label: "Product", href: "/product" },
    ]

    for (let i = 0; i < rest.length; i++) {
      const seg = rest[i]
      const isLast = i === rest.length - 1
      const path = "/product/" + rest.slice(0, i + 1).join("/")
      const label = labelForSegment(seg)
      if (isLast) {
        out.push({ label })
      } else {
        out.push({ label, href: path })
      }
    }
    return out
  }, [pathname])

  if (items.length === 0) return null

  return (
    <Breadcrumb className="mb-0">
      {items.map((item, i) => (
        <BreadcrumbItem key={`${item.label}-${i}`} href={item.href}>
          {item.label}
        </BreadcrumbItem>
      ))}
    </Breadcrumb>
  )
}
