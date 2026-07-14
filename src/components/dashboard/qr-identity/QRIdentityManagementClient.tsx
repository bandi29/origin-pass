"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useSearchParams } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { Link, useRouter } from "@/i18n/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  AlertTriangle,
  Copy,
  Database,
  Download,
  Eye,
  Gauge,
  Key,
  Loader2,
  Minus,
  Printer,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import clsx from "clsx"
import type { QrDashboardPayload, QrMetric } from "@/lib/qr-identity-server-data"
import { appendPassportPreviewQuery } from "@/lib/public-passport-consumer"
import { useToast } from "@/components/ui/Toast"
import { BatchOperationsCard } from "@/components/dashboard/qr-identity/BatchOperationsCard"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { IconChip } from "@/components/ui/IconChip"
import { OnboardingEmptyState } from "@/components/ui/OnboardingEmptyState"
import { useIntentConfirmModal } from "@/components/ui/useIntentConfirmModal"
import { typography } from "@/design-system/tokens"
import { QR_IDENTITY_LOG_DIRECTORY_PATH, QR_IDENTITY_PASSPORT_CREATE_PATH } from "@/lib/qr-identity-nav"

/**
 * Clean white card by default; status colour is the *exception*, expressed as a
 * single subtle left accent rail only on cards that need attention. A calm grid
 * where problems pop reads far more premium than framing every card in top+bottom
 * "racing stripe" bars over a faint tint.
 */
function statCardSurface(status: "healthy" | "warning" | "critical") {
  const base = "border border-ds-border bg-white"
  if (status === "critical") {
    return `${base} border-l-2 border-l-rose-400`
  }
  if (status === "warning") {
    return `${base} border-l-2 border-l-amber-400`
  }
  return base
}

type ActivationFilter = "all" | "active" | "pending" | "compromised" | "revoked"

function metricLedgerFilter(metricId: string): ActivationFilter | null {
  switch (metricId) {
    case "active":
      return "active"
    case "today":
      return "all"
    case "compromised":
      return "compromised"
    case "pending":
      return "pending"
    default:
      return null
  }
}

function MetricSummaryCard({
  metric,
  onFocusLedger,
  children,
}: {
  metric: QrMetric
  onFocusLedger: (filter: ActivationFilter) => void
  children: ReactNode
}) {
  const filter = metricLedgerFilter(metric.id)
  const interactiveClass =
    "transition-all duration-200 ease-smooth hover:-translate-y-1 hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"

  if (!filter) {
    return (
      <article
        className={clsx(
          "relative flex min-h-[128px] flex-col rounded-2xl p-4 shadow-sm",
          statCardSurface(metric.status),
        )}
      >
        {children}
      </article>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onFocusLedger(filter)}
      className={clsx(
        "relative block min-h-[128px] w-full rounded-2xl text-left focus:outline-none",
        statCardSurface(metric.status),
        interactiveClass,
      )}
    >
      <div className="relative flex h-full min-h-[128px] flex-col p-4">{children}</div>
    </button>
  )
}

/** Status-driven icon + circular chip (metric id is stable from `getQrDashboardPayload`). */
function getMetricIconPresentation(metricId: string): {
  Icon: LucideIcon
  containerClass: string
  iconClass: string
} {
  switch (metricId) {
    case "active":
      return {
        Icon: Key,
        containerClass: "bg-emerald-50 dark:bg-emerald-500/10",
        iconClass: "text-emerald-600 dark:text-emerald-400",
      }
    case "compromised":
      return {
        Icon: ShieldAlert,
        containerClass: "bg-rose-50 dark:bg-rose-500/10",
        iconClass: "text-rose-600 dark:text-rose-400",
      }
    case "pending":
      return {
        Icon: Database,
        containerClass: "bg-amber-50 dark:bg-amber-500/10",
        iconClass: "text-amber-600 dark:text-amber-400",
      }
    case "successRate":
      return {
        Icon: Tag,
        containerClass: "bg-indigo-50 dark:bg-indigo-500/10",
        iconClass: "text-indigo-600 dark:text-indigo-400",
      }
    case "today":
      return {
        Icon: Activity,
        containerClass: "bg-blue-50 dark:bg-blue-500/10",
        iconClass: "text-blue-600 dark:text-blue-400",
      }
    case "avgRisk":
      return {
        Icon: Gauge,
        containerClass: "bg-violet-50 dark:bg-violet-500/10",
        iconClass: "text-violet-600 dark:text-violet-400",
      }
    default:
      return {
        Icon: Activity,
        containerClass: "bg-slate-100 dark:bg-slate-500/10",
        iconClass: "text-slate-600 dark:text-slate-400",
      }
  }
}

function MiniScanSparkline({ values }: { values: number[] }) {
  let pts = values.length >= 2 ? values.slice(-12) : [0, 0, 1, 0]
  const max = Math.max(...pts, 1)
  const min = Math.min(...pts, 0)
  const range = max - min || 1
  const w = 56
  const h = 28
  const pad = 3
  const pathD = pts
    .map((v, i) => {
      const x = pad + (i / Math.max(pts.length - 1, 1)) * (w - pad * 2)
      const y = pad + (1 - (v - min) / range) * (h - pad * 2)
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-slate-500"
      aria-hidden
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-qr-spark-stroke"
      />
    </svg>
  )
}

/**
 * Bottom-right micro-indicator. Sentiment is derived from the server-computed
 * `m.status` (and value) so it can never contradict the headline number — these
 * were previously hard-coded "all good" deltas that showed green even when a
 * metric was critical (e.g. risk 100 → "Within target"), which misleads the user.
 */
function MetricMicroTrend({ m }: { m: QrMetric }) {
  const count = () => Number.parseInt(String(m.value).replace(/[^\d]/g, ""), 10) || 0
  const tone =
    m.status === "critical"
      ? "text-rose-600"
      : m.status === "warning"
        ? "text-amber-600"
        : "text-emerald-600"

  if (m.id === "today") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
        <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Last 24h traffic
      </span>
    )
  }

  if (m.id === "compromised") {
    if (count() === 0) {
      return <span className="text-xs text-slate-400">No active compromises</span>
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Action required
      </span>
    )
  }

  if (m.id === "pending") {
    return count() === 0 ? (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Queue clear
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Awaiting activation
      </span>
    )
  }

  if (m.id === "active") {
    const Icon = m.status === "healthy" ? ShieldCheck : AlertTriangle
    return (
      <span className={clsx("inline-flex items-center gap-1 text-xs font-medium", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {m.status === "healthy" ? "All codes live" : "Compromise detected"}
      </span>
    )
  }

  if (m.id === "successRate") {
    const Icon = m.status === "healthy" ? TrendingUp : AlertTriangle
    const label =
      m.status === "healthy" ? "On target" : m.status === "warning" ? "Below target" : "Well below target"
    return (
      <span className={clsx("inline-flex items-center gap-1 text-xs font-medium", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </span>
    )
  }

  if (m.id === "avgRisk") {
    const Icon = m.status === "healthy" ? TrendingDown : AlertTriangle
    const label =
      m.status === "healthy" ? "Within target" : m.status === "warning" ? "Elevated risk" : "High risk — review"
    return (
      <span className={clsx("inline-flex items-center gap-1 text-xs font-medium", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </span>
    )
  }

  return null
}

function passportRowStatus(raw: string): { label: string; pill: string } {
  if (raw === "active") return { label: "Active", pill: "bg-emerald-50 text-emerald-800 border border-emerald-200/80" }
  if (raw === "counterfeit_flagged") {
    return { label: "Pending", pill: "bg-amber-50 text-amber-900 border border-amber-200/80" }
  }
  if (raw === "expired") return { label: "Pending", pill: "bg-amber-50 text-amber-900 border border-amber-200/80" }
  if (raw === "revoked") return { label: "Draft", pill: "bg-slate-100 text-slate-800 border border-slate-200/80" }
  return { label: "Draft", pill: "bg-slate-100 text-slate-800 border border-slate-200/80" }
}

function ProductThumb({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover"
      />
    )
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?"
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600">
      {initials}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  compromised: "bg-rose-50 text-rose-700 border border-rose-200",
  revoked: "bg-slate-100 text-slate-700 border border-slate-200",
}

export function QRIdentityManagementClient({
  initialData,
}: {
  initialData: QrDashboardPayload
}) {
  const [rows, setRows] = useState(initialData.rows)
  const [selectedId, setSelectedId] = useState<string | null>(initialData.rows[0]?.id ?? null)
  const [query, setQuery] = useState("")
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activationFilter, setActivationFilter] = useState<"all" | "active" | "pending" | "compromised" | "revoked">("all")
  const [previewHighlight, setPreviewHighlight] = useState(false)
  const previewPanelRef = useRef<HTMLElement>(null)
  const ledgerRef = useRef<HTMLElement>(null)
  const pendingPreviewIdRef = useRef<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const { openModal, confirmModal } = useIntentConfirmModal()

  function focusLedger(filter: ActivationFilter) {
    setActivationFilter(filter)
    const href =
      filter === "all"
        ? QR_IDENTITY_LOG_DIRECTORY_PATH
        : `${QR_IDENTITY_LOG_DIRECTORY_PATH}?status=${filter}`
    router.replace(href, { scroll: false })
    window.setTimeout(() => {
      ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  useEffect(() => {
    const status = searchParams.get("status")
    if (
      status === "active" ||
      status === "pending" ||
      status === "compromised" ||
      status === "revoked"
    ) {
      setActivationFilter(status)
      const scrollTimer = window.setTimeout(() => {
        ledgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 150)
      return () => window.clearTimeout(scrollTimer)
    }
  }, [searchParams])

  useEffect(() => {
    const previewId = searchParams.get("preview")
    if (!previewId) return

    pendingPreviewIdRef.current = previewId
    setSelectedId(previewId)
    setPreviewHighlight(true)
    router.refresh()

    const scrollTimer = window.setTimeout(() => {
      previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, 150)

    const highlightTimer = window.setTimeout(() => setPreviewHighlight(false), 3200)

    router.replace(QR_IDENTITY_LOG_DIRECTORY_PATH)

    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(highlightTimer)
    }
  }, [searchParams, router])

  useEffect(() => {
    setRows(initialData.rows)
    const targetId = pendingPreviewIdRef.current
    if (targetId && initialData.rows.some((row) => row.id === targetId)) {
      setSelectedId(targetId)
      pendingPreviewIdRef.current = null
    }
  }, [initialData.rows])

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null
  const hasQrIdentities = rows.length > 0
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (activationFilter !== "all" && r.activationStatus !== activationFilter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        r.qrCode.toLowerCase().includes(q)
      )
    })
  }, [rows, activationFilter, query])

  const riskBands = useMemo(() => {
    let safe = 0
    let suspicious = 0
    let high = 0
    for (const r of rows) {
      if (r.riskScore >= 71) high += 1
      else if (r.riskScore >= 31) suspicious += 1
      else safe += 1
    }
    return [
      { status: "Safe", count: safe, color: "#10b981" },
      { status: "Suspicious", count: suspicious, color: "#f59e0b" },
      { status: "High Risk", count: high, color: "#ef4444" },
    ]
  }, [rows])

  async function toggleStatus(id: string, next: "active" | "revoked") {
    const route = next === "active" ? "/api/qr/activate" : "/api/qr/revoke"
    const res = await fetch(route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrIdentityId: id }),
    })
    if (!res.ok) {
      toast.error(next === "active" ? "Activation failed" : "Could not revoke QR identity")
      return false
    }
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, activationStatus: next } : row)),
    )
    return true
  }

  async function activateSelected(id: string) {
    const row = rows.find((r) => r.id === id)
    if (!row || row.activationStatus === "active" || activatingId) return

    setActivatingId(id)
    try {
      const ok = await toggleStatus(id, "active")
      if (!ok) return
      toast.success(
        "Passport Activated",
        "Digital identity is now live on the public registry network.",
      )
      router.refresh()
    } finally {
      setActivatingId(null)
    }
  }

  function handleRevoke() {
    if (!selected || selected.activationStatus === "revoked") return

    openModal({
      title: "Permanently Revoke QR Identity?",
      description:
        "This action is completely irreversible. Consumers scanning this physical item will instantly see a counterfeit warning.",
      confirmText: "Yes, Revoke Permanently",
      intent: "danger",
      onConfirm: async () => {
        const ok = await toggleStatus(selected.id, "revoked")
        if (!ok) return
        toast.success(
          "QR identity revoked",
          "Consumers scanning this label will now see a counterfeit warning.",
        )
        router.refresh()
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {/* Hero — uses Card variant="hero" (surfaces.heroDark) so radius + gradient
            come from the token. CTAs use Button variant="onDarkPrimary" (white pill)
            and variant="onDark" (translucent) — matching the dashboard hero. */}
        <Card variant="hero" padding={false} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                QR Identity
              </h1>
              <span className="hidden shrink-0 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300 sm:inline">
                Dashboard · Overview
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <Button href="/dashboard/qr-identity/print" variant="onDark" size="sm">
                Print Labels
              </Button>
              <Button href="/api/authenticity/audit/export" variant="onDark" size="sm" external>
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {!hasQrIdentities ? (
          <OnboardingEmptyState
            icon={<QrCode className="h-6 w-6" />}
            heading="Generate secure product QR labels"
            body="Create serialized batch identities to attach to physical items for fraud prevention and live scan telemetry tracking."
            primaryAction={{
              label: "Create product passport",
              href: QR_IDENTITY_PASSPORT_CREATE_PATH,
            }}
            secondaryAction={{
              label: "Import products",
              href: "/dashboard/products/import-products",
            }}
          />
        ) : (
          <>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {initialData.metrics.map((m) => {
            const { Icon, containerClass, iconClass } = getMetricIconPresentation(m.id)
            return (
              <MetricSummaryCard key={m.id} metric={m} onFocusLedger={focusLedger}>
                <div
                  className={clsx(
                    "absolute right-3 top-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5",
                    containerClass,
                  )}
                  aria-hidden
                >
                  <Icon className={iconClass} />
                </div>
                <p className="pr-14 text-xs font-semibold uppercase tracking-wider text-ds-text-muted">{m.label}</p>
                <div
                  className={clsx(
                    "mt-1 flex items-baseline gap-2",
                    m.id === "today" ? "min-w-0" : "",
                  )}
                >
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-ds-text">{m.value}</p>
                  {m.id === "today" ? <MiniScanSparkline values={m.sparkline} /> : null}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500 sm:text-xs">{m.trend}</p>
                <div className="mt-auto flex justify-end pt-3">
                  <MetricMicroTrend m={m} />
                </div>
              </MetricSummaryCard>
            )
          })}
        </section>

        <Card padding={false} className="mt-6 overflow-hidden">
          <div className="border-b border-ds-border px-5 py-4">
            <h2 className={typography.h3}>Recent Digital Passports</h2>
            <p className="mt-0.5 text-xs text-ds-text-muted">Newly issued passports linked to your catalog.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-ds-border text-left text-xs font-medium uppercase tracking-wider text-ds-text-muted">
                <tr>
                  <th className="px-5 py-2.5">Product</th>
                  <th className="px-5 py-2.5">SKU</th>
                  <th className="px-5 py-2.5">Category</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {initialData.recentPassports.map((row) => {
                  const st = passportRowStatus(row.status)
                  return (
                    <tr key={row.passportId} className="transition-colors hover:bg-canvas">
                      <td className="px-5 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <ProductThumb name={row.productName} url={row.imageUrl} />
                          <Link
                            href={`/dashboard/products/${row.productId}/product-info`}
                            className="min-w-0 truncate font-medium text-slate-900 underline-offset-2 hover:text-slate-700 hover:underline"
                          >
                            {row.productName}
                          </Link>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{row.sku ?? "—"}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-full border border-ds-border bg-canvas px-2.5 py-0.5 text-xs font-medium text-ds-text-muted">
                          {row.category?.trim() || "General"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={clsx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", st.pill)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500 tabular-nums">
                        {new Date(row.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  )
                })}
                {initialData.recentPassports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                      No digital passports yet. Generate a QR identity to see it here.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
          </>
        )}
      </div>

      {hasQrIdentities ? (
      <>
      <section ref={ledgerRef} id="qr-identity-ledger" className="scroll-mt-24">
      <Card padding={false} className="grid overflow-hidden xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product, SKU, QR code..."
              className="min-w-[240px] flex-1 rounded-xl border border-ds-border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand/30 focus:ring-2 focus:ring-brand/15"
            />
            <select
              value={activationFilter}
              onChange={(e) => setActivationFilter(e.target.value as typeof activationFilter)}
              className="rounded-xl border border-ds-border bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-brand/30 focus:ring-2 focus:ring-brand/15"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="compromised">Compromised</option>
              <option value="revoked">Revoked</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-ds-border text-xs uppercase tracking-wider text-ds-text-muted">
                <tr>
                  <th className="pb-3 text-left">QR ID</th>
                  <th className="pb-3 text-left">Product</th>
                  <th className="pb-3 text-left">SKU</th>
                  <th className="pb-3 text-left">Passport</th>
                  <th className="pb-3 text-left">Activation</th>
                  <th className="pb-3 text-left">Scans</th>
                  <th className="pb-3 text-left">Last scan</th>
                  <th className="pb-3 text-left">Risk</th>
                  <th className="pb-3 text-left">Ownership</th>
                  <th className="pb-3 text-left">Geo</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={clsx(
                      "cursor-pointer transition-colors hover:bg-canvas",
                      selected?.id === row.id && "bg-canvas",
                    )}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td className="py-3 font-mono text-xs text-slate-700">{row.qrCode.slice(0, 12)}</td>
                    <td className="py-3 text-slate-900">{row.productName}</td>
                    <td className="py-3 text-slate-600">{row.sku ?? "—"}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.passportStatus}</span>
                    </td>
                    <td className="py-3">
                      <span className={clsx("rounded-md px-2 py-1 text-xs font-medium", STATUS_STYLE[row.activationStatus] ?? STATUS_STYLE.pending)}>
                        {row.activationStatus}
                      </span>
                    </td>
                    <td className="py-3 text-slate-700">{row.scanCount}</td>
                    <td className="py-3 text-slate-600">{row.lastScanAt ? new Date(row.lastScanAt).toLocaleString() : "—"}</td>
                    <td className="py-3">
                      <span className={clsx("rounded-md px-2 py-1 text-xs font-medium", row.riskScore >= 71 ? "bg-rose-50 text-rose-700" : row.riskScore >= 31 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                        {row.riskScore}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600">{row.ownershipState}</td>
                    <td className="py-3 text-slate-600">{row.geoStatus}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(row.verifyUrl) }}>
                          <Copy className="h-4 w-4" />
                        </button>
                        <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" onClick={(e) => { e.stopPropagation(); window.open(appendPassportPreviewQuery(row.verifyUrl), "_blank") }}>
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-sm text-slate-500">
                      No QR identities match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside
          ref={previewPanelRef}
          className="space-y-4 border-t border-ds-border p-6 xl:border-l xl:border-t-0"
        >
          {selected ? (
            <>
              <div
                className={clsx(
                  "rounded-xl border border-ds-border bg-canvas p-4 transition-shadow duration-500",
                  previewHighlight && "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-white",
                )}
              >
                <p className="text-xs uppercase tracking-wider text-ds-text-muted">Live QR Preview</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{selected.productName}</p>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(selected.verifyUrl)}`} alt="QR Preview" className="mt-3 h-44 w-44 rounded-lg border border-ds-border bg-white p-2" />
                <p className="mt-2 break-all text-[11px] text-slate-600">{selected.verifyUrl}</p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="flex items-center justify-between"><span className="text-slate-500">Verification status</span><span className="font-medium text-slate-900">{selected.riskScore <= 30 ? "Verified" : selected.riskScore <= 70 ? "Suspicious" : "Compromised"}</span></p>
                <p className="flex items-center justify-between"><span className="text-slate-500">Ownership chain</span><span className="font-medium text-slate-900">{selected.ownershipState}</span></p>
                <p className="flex items-center justify-between"><span className="text-slate-500">Last scan</span><span className="font-medium text-slate-900">{selected.lastScanAt ? new Date(selected.lastScanAt).toLocaleDateString() : "—"}</span></p>
                <p className="flex items-center justify-between"><span className="text-slate-500">Scan heat score</span><span className="font-medium text-slate-900">{selected.scanCount}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text shadow-sm transition hover:bg-canvas" onClick={() => window.open(appendPassportPreviewQuery(selected.verifyUrl), "_blank")}>Open passport</button>
                <button className="rounded-xl border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text shadow-sm transition hover:bg-canvas"><Printer className="mr-1 inline h-3.5 w-3.5" />Print</button>
                <button
                  type="button"
                  disabled={selected.activationStatus === "revoked"}
                  className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={handleRevoke}
                >
                  Revoke
                </button>
                <button
                  type="button"
                  disabled={selected.activationStatus === "active" || activatingId === selected.id}
                  onClick={() => void activateSelected(selected.id)}
                  className={clsx(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition",
                    selected.activationStatus === "active"
                      ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-70",
                  )}
                >
                  {activatingId === selected.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {selected.activationStatus === "active"
                    ? "✓ Activated"
                    : activatingId === selected.id
                      ? "Activating…"
                      : "Activate"}
                </button>
                <a href={selected.verifyUrl} target="_blank" rel="noreferrer" className="col-span-2 rounded-xl bg-brand px-3 py-2 text-center text-xs font-medium text-white shadow-sm transition hover:opacity-95"><Download className="mr-1 inline h-3.5 w-3.5" />Download</a>
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-ds-border bg-canvas p-6 text-center">
              <IconChip tone="slate" size="lg">
                <ShieldCheck />
              </IconChip>
              <h3
                className="mt-3 text-lg text-slate-900"
                style={{ fontFamily: '"Playfair Display", ui-serif, Georgia, serif' }}
              >
                Select an Identity
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ds-text-muted">
                Choose a QR identity from the table to preview secure details and contextual actions.
              </p>
            </div>
          )}
        </aside>
      </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card padding={false} className="p-4">
          <h3 className={typography.h3}>Scan timeline</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={initialData.scanSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="scans" stroke="#0f172a" strokeWidth={2} />
                <Line type="monotone" dataKey="suspicious" stroke="#f59e0b" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card padding={false} className="p-4">
          <h3 className={typography.h3}>Risk distribution</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBands}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskBands.map((d) => (
                    <Cell key={d.status} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <BatchOperationsCard />
        <Card padding={false} className="p-4">
          <h3 className={typography.h3}>Recent security activity</h3>
          <ul className="mt-3 space-y-2">
            {initialData.recentActivity.slice(0, 8).map((evt) => (
              <li key={evt.id} className="flex items-center justify-between rounded-lg border border-ds-border bg-canvas px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{evt.label}</p>
                  <p className="text-xs text-ds-text-muted">{new Date(evt.at).toLocaleString()}</p>
                </div>
                <span className={clsx("rounded-full px-2 py-1 text-xs font-medium", evt.severity === "high" ? "bg-rose-100 text-rose-700" : evt.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{evt.severity}</span>
              </li>
            ))}
            {initialData.recentActivity.length === 0 ? (
              <li className="rounded-lg border border-dashed border-ds-border bg-canvas px-3 py-3 text-sm text-ds-text-muted">No security events yet.</li>
            ) : null}
          </ul>
        </Card>
      </section>
      </>
      ) : null}
      {confirmModal}
    </div>
  )
}
