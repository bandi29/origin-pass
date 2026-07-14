"use client"

import { Link } from "@/i18n/navigation"
import { usePathname } from "next/navigation"
import clsx from "clsx"
import {
  Shield,
  FileCheck,
  AlertTriangle,
  Globe,
  ScrollText,
} from "lucide-react"
import {
  VERIFICATION_ROUTES,
  isVerificationAuditLogsPath,
  normalizeDashboardPath,
} from "@/lib/verification-nav"

const tabs = [
  {
    href: VERIFICATION_ROUTES.overview,
    label: "Overview",
    icon: Shield,
    match: (p: string) => p === VERIFICATION_ROUTES.overview,
  },
  {
    href: VERIFICATION_ROUTES.rules,
    label: "Rules",
    icon: FileCheck,
    match: (p: string) => p.startsWith(VERIFICATION_ROUTES.rules),
  },
  {
    href: VERIFICATION_ROUTES.alerts,
    label: "Alerts",
    icon: AlertTriangle,
    match: (p: string) => p.startsWith(VERIFICATION_ROUTES.alerts),
  },
  {
    href: VERIFICATION_ROUTES.map,
    label: "Map",
    icon: Globe,
    match: (p: string) => p.startsWith(VERIFICATION_ROUTES.map),
  },
  {
    href: VERIFICATION_ROUTES.audit,
    label: "Audit logs",
    icon: ScrollText,
    match: (p: string) => isVerificationAuditLogsPath(p),
  },
] as const

export function VerificationSubNav() {
  const pathname = normalizeDashboardPath(usePathname())

  return (
    <nav
      aria-label="Verification sections"
      // Canvas token replaces the magic #F9FAFB. The pill container uses the
      // same surface family as other tab bars in the app so segmented controls
      // feel consistent regardless of where they appear.
      className="flex flex-wrap gap-1 rounded-2xl border border-ds-border bg-canvas p-1.5"
    >
      {tabs.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-smooth sm:px-4",
              active
                // Active tab uses the brand navy accent introduced in the design-token
                // refresh — gives the active section a clear, brand-aligned identity
                // instead of the previous neutral white pill.
                ? "bg-white text-brand shadow-sm ring-1 ring-brand/15"
                : "text-ds-text-muted hover:bg-white/80 hover:text-ds-text",
            )}
          >
            <Icon
              className={clsx(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-brand" : "opacity-70",
              )}
              aria-hidden
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
