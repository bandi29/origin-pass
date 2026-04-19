"use client"

import { useState, useEffect } from "react"
import type { ComponentType } from "react"
import { Link } from "@/i18n/navigation"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  ShieldCheck,
  QrCode,
  RefreshCw,
  BarChart3,
  Plug,
  Settings,
  ChevronRight,
} from "lucide-react"

type NavChild = { href: string; label: string }

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: Package,
    children: [{ href: "/product/passports", label: "Passports" }],
  },
  {
    href: "/dashboard/authenticity",
    label: "Authenticity",
    icon: ShieldCheck,
    children: [
      { href: "/dashboard/authenticity/rules", label: "Verification rules" },
      { href: "/dashboard/authenticity/alerts", label: "Counterfeit alerts" },
      { href: "/dashboard/authenticity/analytics", label: "Fraud analytics" },
      { href: "/dashboard/authenticity/map", label: "Global map" },
      { href: "/dashboard/authenticity/audit", label: "Audit logs" },
    ],
  },
  {
    href: "/product/qr-identity",
    label: "QR Identity",
    icon: QrCode,
    children: [
      { href: "/product/qr-identity/generate", label: "Generate codes" },
      { href: "/product/qr-identity/batch", label: "Batch export" },
      { href: "/product/qr-identity/print", label: "Print labels" },
    ],
  },
  {
    href: "/product/ownership",
    label: "Ownership",
    icon: RefreshCw,
    children: [
      { href: "/product/ownership/records", label: "Ownership records" },
      { href: "/product/ownership/warranty", label: "Warranty lifecycle" },
    ],
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    children: [
      { href: "/analytics/scans", label: "Scan analytics" },
      { href: "/analytics/locations", label: "Geographic insights" },
      { href: "/analytics/fraud", label: "Fraud detection" },
    ],
  },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
]

export default function DashboardSidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const normalizePath = (value: string | null | undefined) =>
    (value || "").replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"

  const isActive = (href: string) => {
    const current = normalizePath(pathname)
    if (href === "/dashboard")
      return current === "/dashboard" || current === "/dashboard/overview"
    return current === href || current.startsWith(`${href}/`)
  }

  useEffect(() => {
    const next: Record<string, boolean> = {}
    navItems.forEach((item) => {
      if (item.children) {
        const childActive = item.children.some((c) => isActive(c.href))
        next[item.href] = isActive(item.href) || childActive
      }
    })
    setExpanded((prev) => ({ ...next, ...prev }))
  }, [pathname])

  return (
    <aside className="w-64 flex-shrink-0">
      <nav className="sticky top-20 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          const Icon = item.icon
          const hasChildren = Boolean(item.children?.length)
          const isOpen = expanded[item.href] ?? active

          if (hasChildren) {
            return (
              <div key={item.href}>
                <div
                  className={`flex items-center rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Link
                    href={item.href}
                    className="flex flex-1 items-center gap-3 px-4 py-3"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.href]: !isOpen,
                      }))
                    }
                    className={`mr-2 rounded p-1 transition ${
                      active ? "hover:bg-white/10" : "hover:bg-slate-200/70"
                    }`}
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    aria-expanded={isOpen}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-1 ml-5 border-l border-slate-200 pl-3 space-y-1">
                    {item.children!.map((child) => {
                      const childActive = isActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition ${
                            childActive
                              ? "bg-slate-100 font-medium text-slate-900"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          }`}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
