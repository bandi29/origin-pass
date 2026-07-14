"use client"

import { useMemo, useSyncExternalStore } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { usePathname } from "@/i18n/navigation"
import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"
import { useBreadcrumbOverrides } from "@/components/layout/BreadcrumbOverrides"
import {
  VERIFICATION_BASE,
  VERIFICATION_BREADCRUMB_LABELS,
  VERIFICATION_ROUTES,
  OPERATIONS_SECURITY_LOGS_PATH,
  OPERATIONS_AUDIT_LOGS_PATH,
  PRODUCT_IDENTITY_VERIFICATION_BASE,
  OPERATIONS_COMPLIANCE_HUB_PATH,
  SUPPLIER_INTELLIGENCE_BREADCRUMB_LABELS,
  FRAUD_ANALYTICS_PATH,
} from "@/lib/verification-nav"
import { PRODUCT_IDENTITY_MODULE_HUB_PATH } from "@/lib/product-identity-nav"
import { OPERATIONS_MODULE_HUB_PATH, OWNERSHIP_HUB_PATH } from "@/lib/operations-nav"
import { ANALYTICS_MODULE_HUB_PATH, SCAN_ANALYTICS_PATH } from "@/lib/analytics-nav"
import {
  QR_IDENTITY_LOG_DIRECTORY_PATH,
  QR_IDENTITY_PASSPORT_CREATE_PATH,
  QR_IDENTITY_PATHS,
  QR_IDENTITY_SUITE_BASE,
  QR_IDENTITY_BREADCRUMB_LABELS as QR_IDENTITY_SEGMENT_LABELS,
} from "@/lib/qr-identity-nav"
import {
  SYSTEM_MODULE_HUB_PATH,
  TEAM_PATH,
  SETTINGS_PATH,
  API_KEYS_PATH,
} from "@/lib/system-nav"

const PRINT_LABELS_PATH = QR_IDENTITY_PATHS.print

/** Stable empty map used pre-mount so the first client render matches SSR. */
const EMPTY_BREADCRUMB_OVERRIDES: Record<string, string> = {}

/** Hydration-safe "is mounted" via useSyncExternalStore (no setState-in-effect). */
const noopSubscribe = () => () => {}
const QR_IDENTITY_HUB_PATH = QR_IDENTITY_LOG_DIRECTORY_PATH

// Parent crumbs for module hub landing pages.
const OPERATIONS_PARENT_HREF = OPERATIONS_MODULE_HUB_PATH
const ANALYTICS_PARENT_HREF = ANALYTICS_MODULE_HUB_PATH
const SYSTEM_PARENT_HREF = SYSTEM_MODULE_HUB_PATH

const ANALYTICS_BREADCRUMB_LABELS: Record<string, string> = {
  fraud: "Fraud Analytics",
  "geographic-insights": "Geographic Insights",
  "scan-analytics": "Scan Analytics",
}

const OWNERSHIP_BREADCRUMB_LABELS: Record<string, string> = {
  records: "Ownership Records",
  warranty: "Warranty Lifecycle",
}

const QR_IDENTITY_BREADCRUMB_LABELS: Record<string, string> = {
  ...QR_IDENTITY_SEGMENT_LABELS,
}

const PRODUCT_IDENTITY_MODULE_LABELS: Record<string, string> = {
  passports: "Product Passports",
  authenticity: "Authenticity",
  "qr-identity": "QR Identity",
  ownership: "Ownership",
}

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
  passports: "Product Passports",
  "product-passports": "Product Passports",
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
  "qr-identity": "QR Identity",
  print: "Print Labels",
  authenticity: "Verification",
  verification: "Verification",
  alerts: "Alerts",
  audit: "Audit Logs",
  operations: "Operations",
  "product-identity": "Product Identity",
  "audit-logs": "Audit logs",
  "security-logs": "Security Logs",
  rules: "Rules",
  map: "Map",
}

export default function RouteBreadcrumbs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("Breadcrumbs")
  const registeredOverrides = useBreadcrumbOverrides()

  // Page-supplied labels (e.g. a passport serial) are registered in a client
  // effect, so they aren't known during SSR. Apply them only after mount so the
  // first client render matches the server HTML — otherwise hydration mismatches.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const overrides = mounted ? registeredOverrides : EMPTY_BREADCRUMB_OVERRIDES

  const { root, crumbs } = useMemo(() => {
    if (!pathname) {
      return {
        root: null as { href: string; label: string } | null,
        crumbs: [] as { label: string; href: string; last: boolean }[],
      }
    }
    const noLocale = pathname.replace(/^\/(en|fr|it)(?=\/|$)/, "") || "/"

    if (
      (noLocale === "/dashboard/product-passports/create" || noLocale === "/dashboard/passports/create") &&
      searchParams.get("context") === "qr-identity"
    ) {
      return {
        root: { href: "/dashboard", label: "Dashboard" },
        crumbs: [
          { label: "QR Identity", href: QR_IDENTITY_LOG_DIRECTORY_PATH, last: false },
          { label: "Create passport", href: QR_IDENTITY_PASSPORT_CREATE_PATH, last: true },
        ],
      }
    }

    if (noLocale === "/dashboard/batches" && searchParams.get("context") === "qr-identity") {
      return {
        root: null,
        crumbs: [
          { label: "QR Identity", href: QR_IDENTITY_LOG_DIRECTORY_PATH, last: false },
          { label: "Batch QR Generation", href: QR_IDENTITY_PATHS.batch, last: false },
          { label: "Create New Batch", href: "/dashboard/batches?context=qr-identity", last: true },
        ],
      }
    }

    if (noLocale === "/" || noLocale === "/dashboard") {
      return { root: null, crumbs: [] }
    }
    const segs = noLocale.split("/").filter(Boolean)
    if (segs.length === 0) return { root: null, crumbs: [] }

    if (noLocale === PRINT_LABELS_PATH) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: t("product_identity"),
            href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
            last: false,
          },
          {
            label: t("print_labels"),
            href: PRINT_LABELS_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale === OPERATIONS_MODULE_HUB_PATH) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "Operations",
            href: OPERATIONS_MODULE_HUB_PATH,
            last: true,
          },
        ],
      }
    }

    if (
      noLocale === OPERATIONS_SECURITY_LOGS_PATH ||
      noLocale === OPERATIONS_AUDIT_LOGS_PATH
    ) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "Operations",
            href: OPERATIONS_PARENT_HREF,
            last: false,
          },
          {
            label: "Security Logs",
            href: OPERATIONS_SECURITY_LOGS_PATH,
            last: true,
          },
        ],
      }
    }

    if (
      noLocale === OPERATIONS_COMPLIANCE_HUB_PATH ||
      noLocale.startsWith(`${OPERATIONS_COMPLIANCE_HUB_PATH}/`)
    ) {
      const subTrail = segs.slice(3)
      const crumbs = [
        {
          label: "Operations",
          href: OPERATIONS_PARENT_HREF,
          last: false,
        },
        {
          label: "Supplier Intelligence",
          href: OPERATIONS_COMPLIANCE_HUB_PATH,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label:
            SUPPLIER_INTELLIGENCE_BREADCRUMB_LABELS[seg] ??
            SEGMENT_LABELS[seg] ??
            prettySegment(seg),
          href: `${OPERATIONS_COMPLIANCE_HUB_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === OWNERSHIP_HUB_PATH || noLocale.startsWith(`${OWNERSHIP_HUB_PATH}/`)) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "Operations",
          href: OPERATIONS_PARENT_HREF,
          last: false,
        },
        {
          label: "Ownership Hub",
          href: OWNERSHIP_HUB_PATH,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label: OWNERSHIP_BREADCRUMB_LABELS[seg] ?? SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${OWNERSHIP_HUB_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === ANALYTICS_MODULE_HUB_PATH) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "Analytics",
            href: ANALYTICS_MODULE_HUB_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale === SCAN_ANALYTICS_PATH || noLocale.startsWith(`${SCAN_ANALYTICS_PATH}/`)) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "Analytics",
            href: ANALYTICS_PARENT_HREF,
            last: false,
          },
          {
            label: "Scan Analytics",
            href: SCAN_ANALYTICS_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale === FRAUD_ANALYTICS_PATH || noLocale.startsWith(`${FRAUD_ANALYTICS_PATH}/`)) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "Analytics",
            href: ANALYTICS_PARENT_HREF,
            last: false,
          },
          {
            label: "Fraud Analytics",
            href: FRAUD_ANALYTICS_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale.startsWith(`${ANALYTICS_MODULE_HUB_PATH}/`)) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "Analytics",
          href: ANALYTICS_PARENT_HREF,
          last: false,
        },
        ...subTrail.map((seg, idx) => ({
          label: ANALYTICS_BREADCRUMB_LABELS[seg] ?? SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${ANALYTICS_MODULE_HUB_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === SYSTEM_MODULE_HUB_PATH) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "System",
            href: SYSTEM_MODULE_HUB_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale.startsWith(`${SYSTEM_MODULE_HUB_PATH}/`)) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "System",
          href: SYSTEM_PARENT_HREF,
          last: false,
        },
        ...subTrail.map((seg, idx) => ({
          label: SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${SYSTEM_MODULE_HUB_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === TEAM_PATH || noLocale.startsWith(`${TEAM_PATH}/`)) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "System",
          href: SYSTEM_PARENT_HREF,
          last: false,
        },
        {
          label: "Team",
          href: TEAM_PATH,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label: SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${TEAM_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === SETTINGS_PATH || noLocale.startsWith(`${SETTINGS_PATH}/`)) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "System",
          href: SYSTEM_PARENT_HREF,
          last: false,
        },
        {
          label: "Settings",
          href: SETTINGS_PATH,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label: SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${SETTINGS_PATH}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (noLocale === API_KEYS_PATH || noLocale.startsWith(`${API_KEYS_PATH}/`)) {
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs: [
          {
            label: "System",
            href: SYSTEM_PARENT_HREF,
            last: false,
          },
          {
            label: "API Keys",
            href: API_KEYS_PATH,
            last: true,
          },
        ],
      }
    }

    if (noLocale.startsWith("/dashboard/integrations/")) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: "System",
          href: SYSTEM_PARENT_HREF,
          last: false,
        },
        ...subTrail.map((seg, idx) => ({
          label: SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `/dashboard/integrations/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (
      segs[0] === "dashboard" &&
      segs[1] === "product-identity" &&
      segs[2] !== "verification"
    ) {
      const moduleKey = segs[2]
      if (!moduleKey) {
        return {
          root: { href: "/dashboard", label: t("dashboard") },
          crumbs: [
            {
              label: "Product Identity",
              href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
              last: true,
            },
          ],
        }
      }

      const subTrail = segs.slice(3)
      const moduleHref = `${PRODUCT_IDENTITY_MODULE_HUB_PATH}/${moduleKey}`
      const crumbs = [
        {
          label: "Product Identity",
          href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
          last: false,
        },
        {
          label:
            PRODUCT_IDENTITY_MODULE_LABELS[moduleKey] ?? prettySegment(moduleKey),
          href: moduleHref,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label:
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)
              ? "Passport details"
              : SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${moduleHref}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (
      segs[0] === "dashboard" &&
      segs[1] === "product-identity" &&
      segs[2] === "verification"
    ) {
      const subTrail = segs.slice(3)
      const crumbs = [
        {
          label: t("product_identity"),
          href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
          last: false,
        },
        {
          label: t("verification"),
          href: VERIFICATION_ROUTES.overview,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label:
            VERIFICATION_BREADCRUMB_LABELS[seg] ??
            SEGMENT_LABELS[seg] ??
            prettySegment(seg),
          href: `${PRODUCT_IDENTITY_VERIFICATION_BASE}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (segs[0] === "dashboard" && segs[1] === "qr-identity") {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: t("product_identity"),
          href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
          last: false,
        },
        {
          label: "QR Identity",
          href: QR_IDENTITY_HUB_PATH,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label:
            QR_IDENTITY_BREADCRUMB_LABELS[seg] ??
            SEGMENT_LABELS[seg] ??
            prettySegment(seg),
          href: `${QR_IDENTITY_SUITE_BASE}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

    if (
      segs[0] === "dashboard" &&
      (segs[1] === "verification" || segs[1] === "authenticity")
    ) {
      const subTrail = segs.slice(2)
      const crumbs = [
        {
          label: t("product_identity"),
          href: PRODUCT_IDENTITY_MODULE_HUB_PATH,
          last: false,
        },
        {
          label: t("verification"),
          href: VERIFICATION_ROUTES.overview,
          last: subTrail.length === 0,
        },
        ...subTrail.map((seg, idx) => ({
          label:
            seg === "alerts"
              ? t("alerts")
              : VERIFICATION_BREADCRUMB_LABELS[seg] ?? SEGMENT_LABELS[seg] ?? prettySegment(seg),
          href: `${VERIFICATION_BASE}/${subTrail.slice(0, idx + 1).join("/")}`,
          last: idx === subTrail.length - 1,
        })),
      ]
      return {
        root: { href: "/dashboard", label: t("dashboard") },
        crumbs,
      }
    }

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
      if (overrides[seg]) return overrides[seg]
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
  }, [pathname, searchParams, t, overrides])

  if (!root && crumbs.length === 0) return null
  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-slate-500"
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
        {crumbs.map((part, idx) => (
          // Index-prefixed key: some breadcrumb trails legitimately repeat the
          // same href (e.g. an "Operations" parent crumb that points at the
          // Ownership Hub because there is no Operations landing page). Pairing
          // the position with the href keeps React keys unique while still
          // being stable across renders for the same trail.
          <li key={`${idx}-${part.href}`} className="flex items-center gap-1.5">
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
