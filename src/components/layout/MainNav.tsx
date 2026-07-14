"use client"

import { useState, type ComponentType } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { useSupabaseUser } from "@/hooks/use-supabase-user"
import clsx from "clsx"
import {
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  FileSearch,
  KeyRound,
  LineChart,
  MapPin,
  Menu,
  Package,
  QrCode,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import {
  VERIFICATION_ROUTES,
  FRAUD_ANALYTICS_PATH,
  OPERATIONS_SECURITY_LOGS_PATH,
  OPERATIONS_COMPLIANCE_HUB_PATH,
  VERIFICATION_SUITE_NAV_VISIBLE,
  isVerificationScopePath,
} from "@/lib/verification-nav"
import {
  PRODUCT_IDENTITY_MODULE_HUB_PATH,
  isProductIdentityModulePath,
} from "@/lib/product-identity-nav"
import { QR_IDENTITY_SUITE_BASE, isQrIdentityModulePath } from "@/lib/qr-identity-nav"
import { OPERATIONS_MODULE_HUB_PATH, isOperationsModulePath } from "@/lib/operations-nav"
import { ANALYTICS_MODULE_HUB_PATH, isAnalyticsModulePath } from "@/lib/analytics-nav"
import { SYSTEM_MODULE_HUB_PATH, isSystemModulePath } from "@/lib/system-nav"

type IconType = ComponentType<{ className?: string }>

type DropdownEntry = {
  label: string
  href: string
  Icon: IconType
}

const productIdentityItems: DropdownEntry[] = [
  { label: "Products", href: "/dashboard/products", Icon: Package },
  { label: "Product Passports", href: "/dashboard/product-passports", Icon: BookOpenCheck },
  { label: "QR Identity", href: QR_IDENTITY_SUITE_BASE, Icon: QrCode },
  ...(VERIFICATION_SUITE_NAV_VISIBLE
    ? [{ label: "Verification", href: VERIFICATION_ROUTES.overview, Icon: ShieldCheck }]
    : []),
]

const operationsItems: DropdownEntry[] = [
  { label: "Ownership Hub", href: "/dashboard/ownership", Icon: FileSearch },
  { label: "Supplier Intelligence", href: OPERATIONS_COMPLIANCE_HUB_PATH, Icon: ShieldCheck },
  { label: "Security Logs", href: OPERATIONS_SECURITY_LOGS_PATH, Icon: ShieldAlert },
]

/** Scan + fraud analytics match sidebar; geographic uses dashboard analytics catch-all. */
const analyticsItems: DropdownEntry[] = [
  { label: "Scan Volume & Activity", href: "/dashboard/scans/scan-analytics", Icon: LineChart },
  { label: "Risk Assessment", href: FRAUD_ANALYTICS_PATH, Icon: BarChart3 },
  { label: "Geographic Reports", href: "/dashboard/analytics/geographic-insights", Icon: MapPin },
]

const systemItems: DropdownEntry[] = [
  { label: "Team", href: "/dashboard/team", Icon: Users },
  { label: "API Keys", href: "/dashboard/integrations/api-keys", Icon: KeyRound },
  { label: "Settings", href: "/dashboard/settings", Icon: Settings },
]

// Outer wrapper handles positioning + open/close animation. It sits flush against
// the trigger (`top-full`, no margin) and uses transparent top padding (`pt-2`) as
// a "hover bridge" so the cursor never crosses an un-hoverable gap on its way to the
// menu — which previously closed the dropdown before a child could be clicked.
const dropdownWrapClass =
  "absolute left-0 top-full z-50 w-56 pt-2 origin-top scale-95 opacity-0 pointer-events-none transition-all duration-150 ease-out group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto"

// Inner card carries the visible surface (border, background, shadow).
const dropdownCardClass =
  "rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-lg dark:border-slate-800/80 dark:bg-slate-950"

const dropdownItemClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"

function normalizePath(pathname: string | null) {
  return (pathname || "").replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"
}

function isQrPassportCreateFlow(noLocale: string, searchParams: URLSearchParams | null) {
  return (
    searchParams?.get("context") === "qr-identity" &&
    (noLocale === "/dashboard/product-passports/create" || noLocale === "/dashboard/passports/create")
  )
}

function isPathActive(noLocale: string, href: string, searchParams: URLSearchParams | null) {
  if (isQrPassportCreateFlow(noLocale, searchParams)) {
    if (href === QR_IDENTITY_SUITE_BASE) return true
    return false
  }
  if (href === QR_IDENTITY_SUITE_BASE) {
    return isQrIdentityModulePath(noLocale)
  }
  if (href === "/") return noLocale === "/"
  return noLocale === href || noLocale.startsWith(`${href}/`)
}

function isProductIdentityDropdownItemActive(
  noLocale: string,
  href: string,
  searchParams: URLSearchParams | null,
) {
  if (href === VERIFICATION_ROUTES.overview) {
    return isVerificationScopePath(noLocale)
  }
  return isPathActive(noLocale, href, searchParams)
}

function isProductIdentitySectionActive(noLocale: string, searchParams: URLSearchParams | null) {
  if (isProductIdentityModulePath(noLocale)) return true
  if (isQrPassportCreateFlow(noLocale, searchParams)) return true
  if (VERIFICATION_SUITE_NAV_VISIBLE && isVerificationScopePath(noLocale)) return true
  return productIdentityItems.some((item) =>
    isProductIdentityDropdownItemActive(noLocale, item.href, searchParams),
  )
}

function isOperationsSectionActive(noLocale: string, searchParams: URLSearchParams | null) {
  if (isOperationsModulePath(noLocale)) return true
  return operationsItems.some((item) => isPathActive(noLocale, item.href, searchParams))
}

function isAnalyticsSectionActive(noLocale: string, searchParams: URLSearchParams | null) {
  if (isAnalyticsModulePath(noLocale)) return true
  return analyticsItems.some((item) => isPathActive(noLocale, item.href, searchParams))
}

function isSystemSectionActive(noLocale: string, searchParams: URLSearchParams | null) {
  if (isSystemModulePath(noLocale)) return true
  return systemItems.some((item) => isPathActive(noLocale, item.href, searchParams))
}

function DesktopNavDropdown({
  label,
  items,
  sectionActive,
  pathname,
  searchParams,
  hubHref,
  isItemActive = isPathActive,
}: {
  label: string
  items: DropdownEntry[]
  sectionActive: boolean
  pathname: string | null
  searchParams: URLSearchParams | null
  hubHref?: string
  isItemActive?: (
    noLocale: string,
    href: string,
    searchParams: URLSearchParams | null,
  ) => boolean
}) {
  const noLocale = normalizePath(pathname)
  const hubActive = hubHref ? noLocale === hubHref : false
  return (
    <div className="group relative hidden lg:block">
      {hubHref ? (
        <Link
          href={hubHref}
          aria-current={hubActive ? "page" : undefined}
          className={clsx(
            "inline-flex cursor-pointer items-center gap-1 text-sm font-medium transition-colors outline-none",
            sectionActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
          )}
        >
          {label}
          <ChevronDown
            className={clsx(
              "h-3.5 w-3.5 transition-colors",
              sectionActive ? "text-slate-700" : "text-slate-400 group-hover:text-slate-700",
            )}
          />
        </Link>
      ) : (
        <button
          type="button"
          className={clsx(
            "inline-flex cursor-pointer items-center gap-1 border-none bg-transparent text-sm font-medium transition-colors outline-none",
            sectionActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
          )}
          aria-expanded={undefined}
          aria-haspopup="menu"
        >
          {label}
          <ChevronDown
            className={clsx(
              "h-3.5 w-3.5 transition-colors",
              sectionActive ? "text-slate-700" : "text-slate-400 group-hover:text-slate-700",
            )}
          />
        </button>
      )}
      <div className={dropdownWrapClass}>
        <div className={dropdownCardClass} role="menu">
          {items.map(({ label: itemLabel, href, Icon }) => {
            const active = isItemActive(noLocale, href, searchParams)
            return (
              <Link
                key={href}
                href={href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                className={clsx(
                  dropdownItemClass,
                  active && "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {itemLabel}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function MainNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, loading } = useSupabaseUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileIdentityOpen, setMobileIdentityOpen] = useState(true)
  const [mobileOperationsOpen, setMobileOperationsOpen] = useState(true)
  const [mobileAnalyticsOpen, setMobileAnalyticsOpen] = useState(true)
  const [mobileSystemOpen, setMobileSystemOpen] = useState(true)

  const noLocale = normalizePath(pathname)

  if (loading) {
    return (
      <>
        <nav className="hidden items-center gap-6 lg:flex" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 animate-pulse rounded bg-slate-100" />
          ))}
        </nav>
        <div
          className="inline-flex h-9 w-9 animate-pulse rounded-lg border border-transparent bg-slate-100 lg:hidden"
          aria-hidden
        />
      </>
    )
  }

  if (!user) {
    return null
  }

  const dashboardActive = noLocale === "/dashboard" || noLocale === "/dashboard/overview"
  const identityActive = isProductIdentitySectionActive(noLocale, searchParams)
  const operationsActive = isOperationsSectionActive(noLocale, searchParams)
  const analyticsActive = isAnalyticsSectionActive(noLocale, searchParams)
  const systemActive = isSystemSectionActive(noLocale, searchParams)

  return (
    <>
      <nav className="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Primary">
        <Link
          href="/dashboard"
          className={clsx(
            "transition-colors",
            dashboardActive ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
          )}
        >
          Dashboard
        </Link>
        <DesktopNavDropdown
          label="Product Identity"
          hubHref={PRODUCT_IDENTITY_MODULE_HUB_PATH}
          items={productIdentityItems}
          sectionActive={identityActive}
          pathname={pathname}
          searchParams={searchParams}
          isItemActive={isProductIdentityDropdownItemActive}
        />
        <DesktopNavDropdown
          label="Operations"
          hubHref={OPERATIONS_MODULE_HUB_PATH}
          items={operationsItems}
          sectionActive={operationsActive}
          pathname={pathname}
          searchParams={searchParams}
        />
        <DesktopNavDropdown
          label="Analytics"
          hubHref={ANALYTICS_MODULE_HUB_PATH}
          items={analyticsItems}
          sectionActive={analyticsActive}
          pathname={pathname}
          searchParams={searchParams}
        />
        <DesktopNavDropdown
          label="System"
          hubHref={SYSTEM_MODULE_HUB_PATH}
          items={systemItems}
          sectionActive={systemActive}
          pathname={pathname}
          searchParams={searchParams}
        />
      </nav>

      <button
        type="button"
        onClick={() => setMobileOpen((s) => !s)}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 lg:hidden"
        aria-label="Toggle navigation menu"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {mobileOpen ? (
        <div className="absolute left-0 right-0 top-16 z-50 max-h-[min(80vh,calc(100dvh-4rem))] overflow-y-auto border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto w-full max-w-[1220px] space-y-4 px-5 py-4">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "block rounded-lg px-3 py-2 text-sm font-medium",
                dashboardActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
              )}
            >
              Dashboard
            </Link>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
                <Link
                  href={PRODUCT_IDENTITY_MODULE_HUB_PATH}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "min-w-0 flex-1 rounded-lg px-1 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    noLocale === PRODUCT_IDENTITY_MODULE_HUB_PATH
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  Product Identity
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileIdentityOpen((o) => !o)}
                  aria-expanded={mobileIdentityOpen}
                  aria-label={mobileIdentityOpen ? "Collapse Product Identity menu" : "Expand Product Identity menu"}
                  className="inline-flex shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  <ChevronDown className={clsx("h-4 w-4 transition-transform", mobileIdentityOpen && "rotate-180")} />
                </button>
              </div>
              {mobileIdentityOpen ? (
                <div className="mt-1 space-y-0.5 pl-1">
                  {productIdentityItems.map(({ label: itemLabel, href, Icon }) => {
                    const active = isProductIdentityDropdownItemActive(noLocale, href, searchParams)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {itemLabel}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
                <Link
                  href={OPERATIONS_MODULE_HUB_PATH}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "min-w-0 flex-1 rounded-lg px-1 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    noLocale === OPERATIONS_MODULE_HUB_PATH
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  Operations
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOperationsOpen((o) => !o)}
                  aria-expanded={mobileOperationsOpen}
                  aria-label={mobileOperationsOpen ? "Collapse Operations menu" : "Expand Operations menu"}
                  className="inline-flex shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  <ChevronDown className={clsx("h-4 w-4 transition-transform", mobileOperationsOpen && "rotate-180")} />
                </button>
              </div>
              {mobileOperationsOpen ? (
                <div className="mt-1 space-y-0.5 pl-1">
                  {operationsItems.map(({ label: itemLabel, href, Icon }) => {
                    const active = isPathActive(noLocale, href, searchParams)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {itemLabel}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
                <Link
                  href={ANALYTICS_MODULE_HUB_PATH}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "min-w-0 flex-1 rounded-lg px-1 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    noLocale === ANALYTICS_MODULE_HUB_PATH
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  Analytics
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileAnalyticsOpen((o) => !o)}
                  aria-expanded={mobileAnalyticsOpen}
                  aria-label={mobileAnalyticsOpen ? "Collapse Analytics menu" : "Expand Analytics menu"}
                  className="inline-flex shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  <ChevronDown className={clsx("h-4 w-4 transition-transform", mobileAnalyticsOpen && "rotate-180")} />
                </button>
              </div>
              {mobileAnalyticsOpen ? (
                <div className="mt-1 space-y-0.5 pl-1">
                  {analyticsItems.map(({ label: itemLabel, href, Icon }) => {
                    const active = isPathActive(noLocale, href, searchParams)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {itemLabel}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-2">
                <Link
                  href={SYSTEM_MODULE_HUB_PATH}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    "min-w-0 flex-1 rounded-lg px-1 py-1 text-xs font-semibold uppercase tracking-wide transition",
                    noLocale === SYSTEM_MODULE_HUB_PATH
                      ? "text-slate-900"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  System
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileSystemOpen((o) => !o)}
                  aria-expanded={mobileSystemOpen}
                  aria-label={mobileSystemOpen ? "Collapse System menu" : "Expand System menu"}
                  className="inline-flex shrink-0 rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  <ChevronDown className={clsx("h-4 w-4 transition-transform", mobileSystemOpen && "rotate-180")} />
                </button>
              </div>
              {mobileSystemOpen ? (
                <div className="mt-1 space-y-0.5 pl-1">
                  {systemItems.map(({ label: itemLabel, href, Icon }) => {
                    const active = isPathActive(noLocale, href, searchParams)
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                          active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-white",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {itemLabel}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
