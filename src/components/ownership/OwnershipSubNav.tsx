"use client"

import { Link, usePathname } from "@/i18n/navigation"
import clsx from "clsx"
import { normalizeDashboardPath } from "@/lib/verification-nav"

const OWNERSHIP_HUB_PATH = "/dashboard/ownership"

const tabs = [
  {
    href: "/dashboard/ownership/records",
    label: "Ownership Records",
    match: (path: string) =>
      path === "/dashboard/ownership/records" ||
      path.startsWith("/dashboard/ownership/records/"),
  },
  {
    href: "/dashboard/ownership/warranty",
    label: "Warranty Lifecycle",
    match: (path: string) =>
      path === "/dashboard/ownership/warranty" ||
      path.startsWith("/dashboard/ownership/warranty/"),
  },
] as const

export function OwnershipSubNav() {
  const pathname = normalizeDashboardPath(usePathname())

  if (pathname === OWNERSHIP_HUB_PATH) {
    return null
  }

  return (
    <nav
      aria-label="Ownership sections"
      className="flex flex-wrap gap-6 border-b border-slate-200"
    >
      {tabs.map(({ href, label, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "-mb-px border-b-2 pb-2 text-sm transition-colors",
              active
                ? "border-slate-900 font-medium text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
