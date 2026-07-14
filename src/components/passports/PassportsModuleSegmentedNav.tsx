"use client"

import { Activity, Layers, LayoutTemplate } from "lucide-react"
import { motion } from "framer-motion"
import { Link, usePathname } from "@/i18n/navigation"
import { clsx } from "clsx"

function normalizePath(value: string | null | undefined) {
  return (value || "").replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
}

function isAllPassportsActive(current: string) {
  return (
    current === "/dashboard/product-passports" ||
    current === "/dashboard/passports" ||
    current.startsWith("/dashboard/product-passports/all-passports") ||
    current.startsWith("/dashboard/passports/all-passports")
  )
}

function isTemplatesActive(current: string) {
  return (
    current === "/dashboard/product-passports/passport-templates" ||
    current === "/dashboard/passports/passport-templates" ||
    current.startsWith("/dashboard/product-passports/passport-templates/") ||
    current.startsWith("/dashboard/passports/passport-templates/")
  )
}

function isActivityActive(current: string) {
  return (
    current === "/dashboard/product-passports/passport-activity" ||
    current === "/dashboard/passports/passport-activity" ||
    current.startsWith("/dashboard/product-passports/passport-activity/") ||
    current.startsWith("/dashboard/passports/passport-activity/")
  )
}

const segmentTrackClass = clsx(
  "inline-flex w-full max-w-full min-h-16 flex-wrap items-center gap-1.5 rounded-[20px] p-2",
  "border border-slate-200/70 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_32px_-12px_rgba(15,23,42,0.1)]",
  "backdrop-blur-md supports-[backdrop-filter]:bg-white/55",
)

const tabBase = clsx(
  "group relative inline-flex cursor-pointer select-none items-center rounded-[14px] border-0",
  "px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] sm:px-5",
  "no-underline transition-all duration-200 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white/80",
)

const tabActive = clsx(tabBase, "z-10 text-white hover:-translate-y-px")

const tabInactive = clsx(
  tabBase,
  "text-slate-500 hover:bg-slate-900/[0.045] hover:text-slate-800",
)

const activeIndicatorClass = clsx(
  "absolute inset-0 rounded-[14px]",
  "bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_16px_-4px_rgba(15,23,42,0.45),0_0_0_1px_rgba(15,23,42,0.12)]",
)

function tabIconClass(isActive: boolean) {
  return clsx(
    "mr-2 h-4 w-4 shrink-0 stroke-[2] transition-all duration-200 ease-out",
    isActive
      ? "text-white/95"
      : "text-slate-400/90 group-hover:translate-x-px group-hover:text-slate-600",
  )
}

export function PassportsModuleSegmentedNav() {
  const pathname = usePathname()
  const current = normalizePath(pathname)

  const segments = [
    {
      href: "/dashboard/product-passports",
      label: "All Passports",
      Icon: Layers,
      isActive: isAllPassportsActive(current),
    },
    {
      href: "/dashboard/product-passports/passport-templates",
      label: "Passport Templates",
      Icon: LayoutTemplate,
      isActive: isTemplatesActive(current),
    },
    {
      href: "/dashboard/product-passports/passport-activity",
      label: "Passport Activity",
      Icon: Activity,
      isActive: isActivityActive(current),
    },
  ]

  return (
    <nav aria-label="Passports views" className="w-full">
      <div role="tablist" className={segmentTrackClass}>
        {segments.map(({ href, label, Icon, isActive }) => (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-current={isActive ? "page" : undefined}
            className={isActive ? tabActive : tabInactive}
          >
            {isActive ? (
              <motion.span
                layoutId="passports-module-segment-indicator"
                className={activeIndicatorClass}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                aria-hidden
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center">
              <Icon className={tabIconClass(isActive)} aria-hidden />
              {label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
