"use client"

import { useMemo } from "react"
import { usePathname } from "@/i18n/navigation"
import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"

function prettySegment(segment: string) {
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

const SEGMENT_LABELS: Record<string, string> = {
  analytics: "Analytics",
  integrations: "Integrations",
  settings: "Settings",
  dashboard: "Dashboard",
  products: "Products",
  passports: "Passports",
  customers: "Customers",
  batches: "Batches",
  compliance: "Compliance",
  fraud: "Fraud",
  locations: "Locations",
  scans: "Scans",
  billing: "Billing",
  account: "Account",
  security: "Security",
  team: "Team",
  api: "API",
  webhooks: "Webhooks",
  shopify: "Shopify",
  erp: "ERP",
  overview: "Overview",
}

export default function RouteBreadcrumbs() {
  const pathname = usePathname()

  const { root, crumbs } = useMemo(() => {
    if (!pathname) {
      return {
        root: null as { href: string; label: string } | null,
        crumbs: [] as { label: string; href: string; last: boolean }[],
      }
    }
    const noLocale = pathname.replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
    if (noLocale === "/" || noLocale === "/dashboard") {
      return { root: null, crumbs: [] }
    }
    const segs = noLocale.split("/").filter(Boolean)
    if (segs.length === 0) return { root: null, crumbs: [] }

    const first = segs[0]
    let root: { href: string; label: string } | null = null
    let trail = segs
    let hrefMode: "dashboard" | "full" | "home" = "home"

    if (first === "dashboard") {
      root = { href: "/dashboard", label: "Dashboard" }
      trail = segs.slice(1)
      hrefMode = "dashboard"
    } else if (["analytics", "settings", "integrations"].includes(first)) {
      root = { href: "/dashboard", label: "Dashboard" }
      trail = segs
      hrefMode = "full"
    } else {
      root = { href: "/", label: "Home" }
      trail = segs
      hrefMode = "full"
    }

    if (trail.length === 0) return { root, crumbs: [] }

    const labelForSeg = (seg: string) => {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
        return "Details"
      }
      return SEGMENT_LABELS[seg] ?? prettySegment(seg)
    }

    const crumbs = trail.map((seg, idx) => {
      const href =
        hrefMode === "dashboard"
          ? "/" + ["dashboard", ...trail.slice(0, idx + 1)].join("/")
          : "/" + trail.slice(0, idx + 1).join("/")
      return {
        label: labelForSeg(seg),
        href,
        last: idx === trail.length - 1,
      }
    })

    return { root, crumbs }
  }, [pathname])

  if (!root && crumbs.length === 0) return null
  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500"
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {root ? (
          <li className="flex items-center gap-1.5">
            <Link
              href={root.href}
              className="rounded px-1.5 py-0.5 underline-offset-2 transition-colors hover:bg-slate-100 hover:text-slate-800 hover:underline"
            >
              {root.label}
            </Link>
          </li>
        ) : null}
        {crumbs.map((part) => (
          <li key={part.href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
            {part.last ? (
              <span
                className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-900"
                aria-current="page"
              >
                {part.label}
              </span>
            ) : (
              <Link
                href={part.href}
                className="rounded px-1.5 py-0.5 underline-offset-2 transition-colors hover:bg-slate-100 hover:text-slate-800 hover:underline"
              >
                {part.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
