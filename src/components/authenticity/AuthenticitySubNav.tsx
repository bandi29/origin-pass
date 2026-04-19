"use client"

import { Link } from "@/i18n/navigation"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  Shield,
  FileCheck,
  AlertTriangle,
  BarChart3,
  Globe,
  ScrollText,
} from "lucide-react"

const tabs = [
  {
    href: "/dashboard/authenticity",
    label: "Overview",
    icon: Shield,
    match: (p: string) =>
      p === "/dashboard/authenticity" || p === "/dashboard/authenticity/",
  },
  {
    href: "/dashboard/authenticity/rules",
    label: "Rules",
    icon: FileCheck,
    match: (p: string) => p.startsWith("/dashboard/authenticity/rules"),
  },
  {
    href: "/dashboard/authenticity/alerts",
    label: "Alerts",
    icon: AlertTriangle,
    match: (p: string) => p.startsWith("/dashboard/authenticity/alerts"),
  },
  {
    href: "/dashboard/authenticity/analytics",
    label: "Analytics",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/dashboard/authenticity/analytics"),
  },
  {
    href: "/dashboard/authenticity/map",
    label: "Map",
    icon: Globe,
    match: (p: string) => p.startsWith("/dashboard/authenticity/map"),
  },
  {
    href: "/dashboard/authenticity/audit",
    label: "Audit logs",
    icon: ScrollText,
    match: (p: string) => p.startsWith("/dashboard/authenticity/audit"),
  },
] as const

function normalizePath(value: string | null | undefined) {
  return (value || "").replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
}

export function AuthenticitySubNav() {
  const pathname = normalizePath(usePathname())

  return (
    <nav
      aria-label="Authenticity sections"
      className="flex flex-wrap gap-2 rounded-2xl border border-ds-border bg-[#F9FAFB] p-2"
    >
      {tabs.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4",
              active
                ? "bg-white text-ds-text shadow-sm ring-1 ring-slate-200/80"
                : "text-ds-text-muted hover:bg-white/80 hover:text-ds-text"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
