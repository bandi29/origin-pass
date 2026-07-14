"use client"

import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { useSearchParams } from "next/navigation"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import clsx from "clsx"
import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  QrCode,
  Package,
  ShieldCheck,
  Users,
  KeyRound,
  Settings,
  FileSearch,
  LineChart,
  ShieldAlert,
  BookOpenCheck,
} from "lucide-react"
import { useNavigationRouteProgress } from "@/components/layout/NavigationProgressProvider"
import {
  VERIFICATION_ROUTES,
  FRAUD_ANALYTICS_PATH,
  OPERATIONS_SECURITY_LOGS_PATH,
  OPERATIONS_COMPLIANCE_HUB_PATH,
  VERIFICATION_SUITE_NAV_VISIBLE,
  isExactNavPath,
  isSupplierIntelligencePath,
  normalizeDashboardPath,
} from "@/lib/verification-nav"
import { SCAN_ANALYTICS_PATH } from "@/lib/analytics-nav"
import {
  DASHBOARD_MODULE_HUBS,
  isDashboardModuleHubGroup,
  type DashboardModuleHubKey,
} from "@/lib/dashboard-module-hubs"
import {
  PRODUCT_IDENTITY_MODULE_HUB_PATH,
  PRODUCT_IDENTITY_PASSPORTS_PATH,
} from "@/lib/product-identity-nav"
import {
  isQrIdentityModulePath,
  QR_IDENTITY_PATHS,
  QR_IDENTITY_SUITE_BASE,
} from "@/lib/qr-identity-nav"

type NavItem = {
  key: string
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  badge?: string
}

type NavGroup = {
  key: string
  label: string
  collapsible?: boolean
  defaultOpen?: boolean
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    items: [{ key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    key: "identity",
    label: "Product Identity",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        key: "products",
        href: "/dashboard/products",
        label: "Products",
        icon: Package,
      },
      {
        key: "passports",
        href: "/dashboard/product-passports",
        label: "Product Passports",
        icon: BookOpenCheck,
      },
      {
        key: "qr",
        href: "/dashboard/qr-identity",
        label: "QR Identity",
        icon: QrCode,
      },
      ...(VERIFICATION_SUITE_NAV_VISIBLE
        ? [
            {
              key: "verification",
              href: VERIFICATION_ROUTES.overview,
              label: "Verification",
              icon: ShieldCheck,
            } satisfies NavItem,
          ]
        : []),
    ],
  },
  {
    key: "operations",
    label: "Operations",
    collapsible: true,
    defaultOpen: false,
    items: [
      {
        key: "ownership",
        href: "/dashboard/ownership",
        label: "Ownership Hub",
        icon: FileSearch,
      },
      {
        key: "operations-security",
        href: OPERATIONS_SECURITY_LOGS_PATH,
        label: "Security Logs",
        icon: ShieldAlert,
      },
      {
        key: "supplier",
        href: OPERATIONS_COMPLIANCE_HUB_PATH,
        label: "Supplier Intelligence",
        icon: ShieldCheck,
        badge: "Early Access",
      },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    collapsible: true,
    defaultOpen: false,
    items: [
      {
        key: "scan-analytics",
        href: SCAN_ANALYTICS_PATH,
        label: "Scan Analytics",
        icon: LineChart,
      },
      {
        key: "fraud-analytics",
        href: FRAUD_ANALYTICS_PATH,
        label: "Fraud Analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    key: "system",
    label: "System",
    collapsible: true,
    defaultOpen: false,
    items: [
      { key: "team", href: "/dashboard/team", label: "Team", icon: Users },
      { key: "api-keys", href: "/dashboard/integrations/api-keys", label: "API Keys", icon: KeyRound },
      { key: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
]

/**
 * QR Identity sub-menu. Path-driven (no local toggle state): the container is
 * rendered whenever the route is inside the QR Identity suite, and each child only
 * highlights its text on an exact sub-route match. "All QR Identities" is
 * intentionally omitted — the parent button already routes to the registry root.
 */
const QR_IDENTITY_CHILDREN: { key: string; href: string; label: string }[] = [
  { key: "qr-print", href: QR_IDENTITY_PATHS.print, label: "Print Labels" },
  { key: "qr-verification", href: QR_IDENTITY_PATHS.verification, label: "Security Verification" },
]

function isQrIdentitySuitePath(current: string) {
  return current === QR_IDENTITY_SUITE_BASE || current.startsWith(`${QR_IDENTITY_SUITE_BASE}/`)
}

/**
 * "On the QR hub landing." The root (/dashboard/qr-identity) redirects to the
 * registry (/dashboard/qr-identity/all), so both count as the landing — this is
 * the equivalent of the module hubs' `isHubPath`, and is what lets the parent
 * label toggle (instead of re-navigating) once you're already there.
 */
function isQrHubLanding(current: string) {
  return current === QR_IDENTITY_SUITE_BASE || current === QR_IDENTITY_PATHS.all
}

function normalizePath(value: string | null | undefined) {
  return normalizeDashboardPath(value)
}

function isQrIdentityPassportCreate(current: string, context: string | null) {
  return (
    context === "qr-identity" &&
    (current === "/dashboard/product-passports/create" || current === "/dashboard/passports/create")
  )
}

function isQrIdentityBatchCreate(current: string, context: string | null) {
  return context === "qr-identity" && current === "/dashboard/batches"
}

function isNavLeafActive(
  item: NavItem,
  current: string,
  opts?: { qrPassportCreate?: boolean; qrBatchCreate?: boolean },
) {
  if (item.key === "operations-security") return isExactNavPath(current, item.href)
  if (item.key === "supplier") return isSupplierIntelligencePath(current)
  return isActivePath(item.href, current, opts)
}

function isActivePath(
  href: string,
  current: string,
  opts?: { qrPassportCreate?: boolean; qrBatchCreate?: boolean },
) {
  if (
    opts?.qrPassportCreate &&
    href === "/dashboard/product-passports" &&
    (current === "/dashboard/product-passports/create" || current === "/dashboard/passports/create")
  ) {
    return false
  }
  if (opts?.qrBatchCreate && href === "/dashboard/qr-identity" && current === "/dashboard/batches") {
    return true
  }
  if (href === "/dashboard") {
    return current === "/dashboard" || current === "/dashboard/overview"
  }
  if (href === "/dashboard/product-passports") {
    return (
      current === href ||
      current.startsWith(`${href}/`) ||
      current === "/dashboard/passports" ||
      current.startsWith("/dashboard/passports/") ||
      current === PRODUCT_IDENTITY_PASSPORTS_PATH ||
      current.startsWith(`${PRODUCT_IDENTITY_PASSPORTS_PATH}/`)
    )
  }
  if (href === "/dashboard/qr-identity") {
    if (opts?.qrPassportCreate || opts?.qrBatchCreate) return true
    return isQrIdentityModulePath(current)
  }
  return current === href || current.startsWith(`${href}/`)
}

function isNavItemActiveInGroup(
  item: NavItem,
  current: string,
  opts?: { qrPassportCreate?: boolean; qrBatchCreate?: boolean },
) {
  return isNavLeafActive(item, current, opts)
}

const SUBMENU_MAX_PX = 560
const IDENTITY_GROUP_MAX_PX = 720

export default function DashboardSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { beginRouteTransition } = useNavigationRouteProgress()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    identity: true,
    operations: false,
    analytics: false,
    system: false,
  })

  const current = normalizePath(pathname)
  const contextParam = searchParams.get("context")
  const qrPassportCreate = isQrIdentityPassportCreate(current, contextParam)
  const qrBatchCreate = isQrIdentityBatchCreate(current, contextParam)
  const navOpts = { qrPassportCreate, qrBatchCreate }

  const isActive = (item: NavItem) => isNavLeafActive(item, current, navOpts)

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      for (const group of navGroups) {
        if (!group.collapsible) continue
        const active = group.items.some((item) => isNavItemActiveInGroup(item, current, navOpts))
        if (active) next[group.key] = true
        else if (next[group.key] == null) next[group.key] = Boolean(group.defaultOpen)
      }
      // QR Identity sub-menu auto-opens when inside the suite (mirrors group auto-open).
      if (isQrIdentitySuitePath(current)) next.qrSubmenu = true
      return next
    })
  }, [current, contextParam, qrPassportCreate, qrBatchCreate])

  function startRouteNav(href: string) {
    if (current !== href && !current.startsWith(`${href}/`)) beginRouteTransition()
  }

  function toggleQrSubmenu() {
    setOpenGroups((prev) => ({ ...prev, qrSubmenu: !(prev.qrSubmenu ?? false) }))
  }

  /**
   * Parent-label behavior mirrors the module-hub headers (navigateToModuleHub):
   * already on the QR root → toggle the sub-menu (a navigation would be a no-op);
   * coming from elsewhere → open the sub-menu immediately and navigate to the root.
   */
  function handleQrIdentityNav() {
    if (isQrHubLanding(current)) {
      toggleQrSubmenu()
      return
    }
    setOpenGroups((prev) => ({ ...prev, qrSubmenu: true }))
    beginRouteTransition()
    // Navigate straight to the registry landing (the root just redirects here),
    // so we never land on a path the toggle check doesn't recognise.
    router.push(QR_IDENTITY_PATHS.all)
  }

  function toggleGroup(group: NavGroup) {
    setOpenGroups((prev) => ({
      ...prev,
      [group.key]: !(prev[group.key] ?? Boolean(group.defaultOpen)),
    }))
  }

  function navigateToModuleHub(groupKey: DashboardModuleHubKey) {
    const hub = DASHBOARD_MODULE_HUBS[groupKey]
    if (hub.isHubPath(current)) {
      setOpenGroups((prev) => ({ ...prev, [groupKey]: !(prev[groupKey] ?? true) }))
      return
    }
    setOpenGroups((prev) => ({ ...prev, [groupKey]: true }))
    beginRouteTransition()
    router.push(hub.hubPath)
  }

  function isModuleHubGroupActive(groupKey: DashboardModuleHubKey) {
    const hub = DASHBOARD_MODULE_HUBS[groupKey]
    if (hub.isModulePath(current)) return true
    return (
      navGroups
        .find((group) => group.key === groupKey)
        ?.items.some((item) => isNavItemActiveInGroup(item, current, navOpts)) ?? false
    )
  }

  function renderModuleHubGroupHeader(
    group: NavGroup,
    groupOpen: boolean,
    groupHasActiveRoute: boolean,
  ) {
    const hub = DASHBOARD_MODULE_HUBS[group.key as DashboardModuleHubKey]
    const onHub = hub.isHubPath(current)
    const isPrimary = hub.headerStyle === "primary"

    if (isPrimary) {
      return (
        <div
          className={clsx(
            "flex w-full items-center gap-1 rounded-xl transition-all duration-200 ease-out",
            groupHasActiveRoute
              ? "bg-slate-100 ring-1 ring-slate-200/90"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          <button
            type="button"
            aria-current={onHub ? "page" : undefined}
            onClick={() => navigateToModuleHub(hub.key)}
            onMouseEnter={() => router.prefetch(hub.hubPath)}
            onFocus={() => router.prefetch(hub.hubPath)}
            className={clsx(
              "min-w-0 flex-1 cursor-pointer rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-colors",
              onHub
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10"
                : groupHasActiveRoute
                  ? "text-slate-900"
                  : "text-slate-600 hover:text-slate-900",
            )}
          >
            {group.label}
          </button>
          <button
            type="button"
            aria-expanded={groupOpen}
            aria-label={groupOpen ? `Collapse ${group.label} menu` : `Expand ${group.label} menu`}
            onClick={() => toggleGroup(group)}
            className="mr-2 inline-flex shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
          >
            <ChevronDown
              className={clsx(
                "h-4 w-4 opacity-80 transition-transform duration-300 ease-in-out",
                groupOpen ? "rotate-0" : "-rotate-90",
              )}
              aria-hidden
            />
          </button>
        </div>
      )
    }

    return (
      <div
        className={clsx(
          "flex w-full items-center gap-1 rounded-lg transition-all duration-200 ease-out",
          groupHasActiveRoute
            ? "bg-slate-100 ring-1 ring-slate-200/90"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
        )}
      >
        <button
          type="button"
          aria-current={onHub ? "page" : undefined}
          onClick={() => navigateToModuleHub(hub.key)}
          onMouseEnter={() => router.prefetch(hub.hubPath)}
          onFocus={() => router.prefetch(hub.hubPath)}
          className={clsx(
            "min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors",
            onHub
              ? "rounded-xl bg-slate-900 px-4 py-3 text-[15px] font-semibold normal-case text-white shadow-sm ring-1 ring-slate-900/10"
              : groupHasActiveRoute
                ? "text-slate-800"
                : "text-slate-500 hover:text-slate-700",
          )}
        >
          {group.label}
        </button>
        <button
          type="button"
          aria-expanded={groupOpen}
          aria-label={groupOpen ? `Collapse ${group.label} menu` : `Expand ${group.label} menu`}
          onClick={() => toggleGroup(group)}
          className="mr-1 inline-flex shrink-0 cursor-pointer rounded-lg p-1 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
        >
          <ChevronDown
            className={clsx(
              "h-4 w-4 transition-transform duration-200",
              groupOpen ? "rotate-0" : "-rotate-90",
            )}
            aria-hidden
          />
        </button>
      </div>
    )
  }

  /**
   * QR Identity accordion. Uses the same split-control pattern as the module-hub
   * group headers: the label routes to the registry root, while a *separate*
   * chevron button toggles the sub-menu — so navigation never clashes with the
   * toggle (no 3rd-click freeze). The sub-menu auto-opens when inside the suite
   * (see effect above) and can be collapsed/expanded manually like the others.
   * Parent shows the dark highlight only on the exact root; children only tint
   * their text on an exact sub-route match and keep transparent backgrounds.
   */
  function renderQrIdentityAccordion(item: NavItem) {
    const Icon = item.icon
    const rootActive = isQrHubLanding(current)
    const inSuite = isQrIdentitySuitePath(current)
    const open = openGroups.qrSubmenu ?? false

    return (
      <div key={item.key} className="space-y-1">
        <div className="flex w-full items-center gap-1">
          <button
            type="button"
            aria-current={rootActive ? "page" : undefined}
            onClick={handleQrIdentityNav}
            onMouseEnter={() => router.prefetch(QR_IDENTITY_PATHS.all)}
            onFocus={() => router.prefetch(QR_IDENTITY_PATHS.all)}
            className={clsx(
              "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition-all duration-200 ease-out",
              rootActive
                ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10"
                : inSuite
                  ? "text-slate-900 hover:bg-slate-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="qr-identity-submenu"
            aria-label={open ? "Collapse QR Identity menu" : "Expand QR Identity menu"}
            onClick={() => toggleQrSubmenu()}
            className="mr-1 inline-flex shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
          >
            <ChevronDown
              className={clsx(
                "h-4 w-4 transition-transform duration-200",
                open ? "rotate-0" : "-rotate-90",
              )}
              aria-hidden
            />
          </button>
        </div>

        <div
          id="qr-identity-submenu"
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: open ? 160 : 0 }}
        >
          <div className="ml-5 space-y-0.5 border-l border-slate-200 pl-3">
            {QR_IDENTITY_CHILDREN.map((child) => {
              const childActive = current === child.href
              return (
                <Link
                  key={child.key}
                  href={child.href}
                  aria-current={childActive ? "page" : undefined}
                  tabIndex={open ? undefined : -1}
                  onClick={() => startRouteNav(child.href)}
                  onMouseEnter={() => router.prefetch(child.href)}
                  onFocus={() => router.prefetch(child.href)}
                  className={clsx(
                    "block rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-out",
                    childActive
                      ? "bg-slate-900 font-medium text-white shadow-sm ring-1 ring-slate-900/10"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {child.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  function renderGroupItems(group: NavGroup) {
    return group.items.map((item) => {
      if (item.key === "qr") {
        return renderQrIdentityAccordion(item)
      }
      const Icon = item.icon
      const active = isActive(item)

      return (
        <Link
          key={item.key}
          href={item.href}
          aria-current={active ? "page" : undefined}
          onClick={() => startRouteNav(item.href)}
          className={clsx(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-out",
            group.key === "identity" && "text-[15px] font-semibold",
            active
              ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {item.badge}
            </span>
          ) : null}
        </Link>
      )
    })
  }

  return (
    <aside className="w-64 shrink-0">
      <nav className="sticky top-20 space-y-4" aria-label="Dashboard">
        {navGroups.map((group) => {
          const groupOpen = group.collapsible ? (openGroups[group.key] ?? Boolean(group.defaultOpen)) : true
          const groupHasActiveRoute = isDashboardModuleHubGroup(group.key)
            ? isModuleHubGroupActive(group.key)
            : group.items.some((item) => isNavItemActiveInGroup(item, current, navOpts))

          return (
            <section key={group.key} className="space-y-1.5">
              <div className={clsx(group.key === "identity" ? "px-0" : "px-2")}>
                {group.collapsible ? (
                  isDashboardModuleHubGroup(group.key) ? (
                    renderModuleHubGroupHeader(group, groupOpen, groupHasActiveRoute)
                  ) : (
                    <button
                      type="button"
                      aria-expanded={groupOpen}
                      onClick={() => toggleGroup(group)}
                      className={clsx(
                        "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide transition",
                        groupHasActiveRoute
                          ? "bg-slate-100 text-slate-800"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                      )}
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={clsx(
                          "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
                          groupOpen ? "rotate-0" : "-rotate-90",
                        )}
                        aria-hidden
                      />
                    </button>
                  )
                ) : (
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {group.label}
                  </p>
                )}
              </div>

              {group.collapsible ? (
                <div
                  className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                  style={{
                    maxHeight: groupOpen
                      ? group.key === "identity"
                        ? IDENTITY_GROUP_MAX_PX
                        : SUBMENU_MAX_PX
                      : 0,
                  }}
                >
                  <div className="space-y-1">{renderGroupItems(group)}</div>
                </div>
              ) : (
                <div className="space-y-1">{renderGroupItems(group)}</div>
              )}
            </section>
          )
        })}
      </nav>
    </aside>
  )
}
