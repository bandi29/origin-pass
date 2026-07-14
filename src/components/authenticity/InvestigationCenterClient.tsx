"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  MapPin,
  Radar,
  Shield,
  ShieldCheck,
  UserRound,
  X,
  Zap,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import clsx from "clsx"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Input } from "@/components/ui/Input"
import type {
  CounterfeitAlertSeverity,
  CounterfeitAlertStatus,
  CounterfeitResolutionType,
  InvestigationAlertDetail,
  InvestigationAlertRow,
  InvestigationSummary,
  ResolutionAction,
} from "@/lib/counterfeit-alerts-types"
import {
  formatAlertStatus,
  formatCounterfeitIssueType,
  formatTriggerSource,
} from "@/lib/counterfeit-alerts-types"
import type { OriginPassRole } from "@/lib/rbac"
import {
  canManageCounterfeitInvestigations,
  canResolveCounterfeitAlerts,
} from "@/lib/rbac"

const CHART_COLORS = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4"]

const ALERTS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const
const DEFAULT_ALERTS_PAGE_SIZE = 25

function buildAlertPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const raw = new Set<number>()
  raw.add(1)
  raw.add(total)
  for (let d = -1; d <= 1; d++) {
    const p = current + d
    if (p >= 1 && p <= total) raw.add(p)
  }
  const sorted = [...raw].sort((a, b) => a - b)
  const out: (number | "ellipsis")[] = []
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!
    if (i > 0 && n - sorted[i - 1]! > 1) out.push("ellipsis")
    out.push(n)
  }
  return out
}

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function SeverityBadge({ severity }: { severity: CounterfeitAlertSeverity }) {
  const styles = {
    low: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80",
    medium: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    high: "bg-orange-50 text-orange-900 ring-1 ring-orange-200/80",
    critical: "bg-red-50 text-red-800 ring-1 ring-red-200/80 animate-pulse",
  } as const
  const labels = { low: "Low", medium: "Medium", high: "High", critical: "Critical" } as const
  return (
    <Badge className={clsx("rounded-lg font-medium capitalize", styles[severity])}>
      {labels[severity]}
    </Badge>
  )
}

function StatusBadge({ status }: { status: CounterfeitAlertStatus }) {
  const styles: Record<CounterfeitAlertStatus, string> = {
    new: "bg-slate-100 text-slate-800",
    investigating: "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80",
    pending_evidence: "bg-violet-50 text-violet-900",
    escalated: "bg-rose-50 text-rose-900",
    confirmed_fraud: "bg-red-100 text-red-900",
    false_positive: "bg-emerald-50 text-emerald-900",
    resolved: "bg-emerald-50 text-emerald-800",
    archived: "bg-slate-50 text-slate-600",
  }
  return (
    <Badge className={clsx("rounded-lg font-medium", styles[status])}>
      {formatAlertStatus(status)}
    </Badge>
  )
}

function IssueIcon({ issue }: { issue: InvestigationAlertRow["issue_type"] }) {
  if (issue === "duplicate_scans" || issue === "velocity_anomaly") {
    return <Zap className="h-4 w-4 text-amber-600" aria-hidden />
  }
  if (issue === "impossible_travel" || issue === "location_mismatch") {
    return <MapPin className="h-4 w-4 text-rose-600" aria-hidden />
  }
  if (issue === "invalid_qr" || issue === "qr_cloning") {
    return <Crosshair className="h-4 w-4 text-red-700" aria-hidden />
  }
  return <Radar className="h-4 w-4 text-indigo-600" aria-hidden />
}

function SlaCountdown({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ds-text-muted">—</span>
  const t = new Date(iso).getTime()
  const diff = t - Date.now()
  if (diff < 0) {
    return <span className="font-medium text-red-600">Overdue</span>
  }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return (
    <span className="tabular-nums text-ds-text">
      {h}h {m}m
    </span>
  )
}

type FeedItem = {
  id: string
  ref: string
  issue_type: InvestigationAlertRow["issue_type"]
  severity: CounterfeitAlertSeverity
  status: CounterfeitAlertStatus
  confidence: number
  created_at: string
  region: string | null
}

export function InvestigationCenterClient({
  initialAlerts,
  initialSummary,
  role,
}: {
  initialAlerts: InvestigationAlertRow[]
  initialSummary: InvestigationSummary
  role: OriginPassRole
}) {
  const canInvestigate = canManageCounterfeitInvestigations(role)
  const canResolve = canResolveCounterfeitAlerts(role)

  const [alerts, setAlerts] = useState(initialAlerts)
  const [summary, setSummary] = useState(initialSummary)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_ALERTS_PAGE_SIZE)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<InvestigationAlertDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/alerts")
    if (!res.ok) return
    const data = (await res.json()) as {
      alerts: InvestigationAlertRow[]
      summary: InvestigationSummary
    }
    setAlerts(data.alerts)
    setSummary(data.summary)
  }, [])

  const refreshFeed = useCallback(async () => {
    const res = await fetch("/api/alerts?feed=1")
    if (!res.ok) return
    const data = (await res.json()) as { feed: FeedItem[] }
    setFeed(data.feed)
  }, [])

  useEffect(() => {
    void refreshFeed()
    const id = window.setInterval(() => {
      void refreshFeed()
    }, 30000)
    return () => window.clearInterval(id)
  }, [refreshFeed])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh()
    }, 120000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!selectedId || !drawerOpen) return
    let cancelled = false
    setDetailLoading(true)
    void (async () => {
      const res = await fetch(`/api/alerts/${selectedId}`)
      if (!res.ok) {
        if (!cancelled) setDetailLoading(false)
        return
      }
      const data = (await res.json()) as { alert: InvestigationAlertDetail }
      if (!cancelled) {
        setDetail(data.alert)
        setDetailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, drawerOpen])

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (severityFilter !== "all" && a.severity !== severityFilter) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        const blob = `${a.product_name} ${a.investigation_ref} ${a.issue_type} ${a.region ?? ""} ${a.qr_code ?? ""} ${a.sku ?? ""}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [alerts, statusFilter, severityFilter, query])

  const sortedRows = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      if (a.is_critical_open !== b.is_critical_open) return a.is_critical_open ? -1 : 1
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return copy
  }, [filtered])

  const totalFiltered = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const pageList = useMemo(() => buildAlertPageList(page, totalPages), [page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, severityFilter, query])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  const rangeStart = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalFiltered)

  const openById = (id: string) => {
    setSelectedId(id)
    setDetail(null)
    setDrawerOpen(true)
  }

  const openRow = (row: InvestigationAlertRow) => {
    openById(row.id)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
  }

  const pieData = summary.by_issue_type.map((x) => ({
    name: formatCounterfeitIssueType(x.type),
    value: x.count,
  }))

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-4">
        <Card padding className="rounded-2xl border border-ds-border bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">Open investigations</p>
            <Activity className="h-4 w-4 text-emerald-400" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{summary.total_open}</p>
          <p className="mt-1 text-xs text-white/60">Active queue requiring analyst attention</p>
        </Card>
        <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">Critical</p>
          <p className="mt-2 text-2xl font-semibold text-red-600 tabular-nums">{summary.critical_open}</p>
          <p className="mt-1 text-xs text-ds-text-muted">Pinned and high-severity signals</p>
        </Card>
        <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">SLA overdue</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700 tabular-nums">{summary.overdue}</p>
          <p className="mt-1 text-xs text-ds-text-muted">Breached deadlines (open cases)</p>
        </Card>
        <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">False positive rate</p>
          <p className="mt-2 text-2xl font-semibold text-ds-text tabular-nums">
            {summary.false_positive_rate != null ? `${summary.false_positive_rate}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-ds-text-muted">Resolved / archived denominator (30d)</p>
        </Card>
      </div>

      <details className="rounded-2xl border border-ds-border bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ds-text">Advanced Insights</p>
              <p className="text-xs text-ds-text-muted">
                Enterprise analytics and live feed (optional)
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Advanced
            </span>
          </div>
        </summary>
        <div className="space-y-6 border-t border-ds-border px-5 py-5">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ds-text">Alerts over time</h3>
                <span className="text-xs text-ds-text-muted">Last 30 days</span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.alerts_per_day}>
                    <defs>
                      <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis width={32} tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#4f46e5" fill="url(#invGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-ds-text">Fraud categories</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card
            padding
            className="rounded-2xl border border-indigo-200/60 bg-gradient-to-r from-indigo-50/80 via-white to-white shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <h3 className="text-sm font-semibold text-ds-text">Live alert feed</h3>
              </div>
              <span className="text-xs text-ds-text-muted">Auto-refresh · 30s</span>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {feed.length === 0 ? (
                <p className="text-sm text-ds-text-muted">No stream items yet — waiting for telemetry.</p>
              ) : (
                feed.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => openById(f.id)}
                    className="min-w-[220px] rounded-xl border border-ds-border bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-indigo-300"
                  >
                    <p className="font-mono text-[11px] text-ds-text-muted">{f.ref}</p>
                    <p className="mt-1 line-clamp-1 text-sm font-medium text-ds-text">
                      {formatCounterfeitIssueType(f.issue_type)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="text-xs text-ds-text-muted">{f.confidence}% conf.</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </details>

      <div className="sticky top-0 z-20 -mx-1 border-b border-ds-border/80 bg-[color-mix(in_oklab,var(--color-background)_92%,white)] px-1 py-3 backdrop-blur-md">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs font-medium text-ds-text-muted">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product, ref, SKU, region…"
              className="max-w-md"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ds-text-muted">Status</label>
            <select
              className="rounded-xl border border-ds-border bg-white px-3 py-2 text-sm text-ds-text"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="investigating">Investigating</option>
              <option value="pending_evidence">Pending evidence</option>
              <option value="escalated">Escalated</option>
              <option value="confirmed_fraud">Confirmed fraud</option>
              <option value="false_positive">False positive</option>
              <option value="resolved">Resolved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ds-text-muted">Severity</label>
            <select
              className="rounded-xl border border-ds-border bg-white px-3 py-2 text-sm text-ds-text"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState
          title="No suspicious activity detected."
          description="Your authenticity signals are clean for the current filters. The investigation center will populate automatically when scans, ownership, or compliance rules raise fraud signals."
          icon={<ShieldCheck className="h-7 w-7 text-emerald-600" aria-hidden />}
        />
      ) : (
        <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                  <th className="whitespace-nowrap pb-3 pr-3">Alert</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Product</th>
                  <th className="whitespace-nowrap pb-3 pr-3">SKU</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Batch</th>
                  <th className="whitespace-nowrap pb-3 pr-3">QR</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Issue</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Severity</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Risk</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Status</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Assigned</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Region</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Last scan</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Scans</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Source</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Conf.</th>
                  <th className="whitespace-nowrap pb-3 pr-3">SLA</th>
                  <th className="whitespace-nowrap pb-3 pr-3">Created</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className={clsx(
                      "cursor-pointer transition-colors hover:bg-slate-50/90",
                      row.is_critical_open && "bg-red-50/40",
                    )}
                    onClick={() => openRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openRow(row)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <IssueIcon issue={row.issue_type} />
                        <div>
                          <p className="font-mono text-[11px] text-ds-text-muted">{row.investigation_ref}</p>
                          <p className="text-xs text-ds-text-muted">{row.priority} priority</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-medium text-ds-text">{row.product_name}</td>
                    <td className="py-3 pr-3 text-ds-text-muted">{row.sku ?? "—"}</td>
                    <td className="py-3 pr-3 text-ds-text-muted">{row.batch ?? "—"}</td>
                    <td className="max-w-[120px] truncate py-3 pr-3 font-mono text-[11px] text-ds-text-muted">
                      {row.qr_code ?? row.qr_identity_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="py-3 pr-3 text-ds-text-muted">{formatCounterfeitIssueType(row.issue_type)}</td>
                    <td className="py-3 pr-3">
                      <SeverityBadge severity={row.severity} />
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-ds-text">
                      {row.product_risk_score ?? row.risk_score_snapshot}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="py-3 pr-3 text-ds-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" aria-hidden />
                        {row.assignee_label ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-ds-text-muted">{row.region ?? "—"}</td>
                    <td className="py-3 pr-3 text-ds-text-muted">
                      {row.last_scan_at ? formatTs(row.last_scan_at) : "—"}
                    </td>
                    <td className="py-3 pr-3 tabular-nums text-ds-text-muted">{row.scan_count}</td>
                    <td className="py-3 pr-3 text-xs text-ds-text-muted">
                      {formatTriggerSource(row.trigger_source)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                        {row.confidence_score}%
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      <SlaCountdown iso={row.sla_due_at} />
                    </td>
                    <td className="py-3 pr-3 text-ds-text-muted">{formatTs(row.created_at)}</td>
                    <td className="py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          openRow(row)
                        }}
                      >
                        Investigate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 flex flex-col gap-4 border-t border-ds-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ds-text-muted">
              {totalFiltered === 0
                ? "No results"
                : `Showing ${rangeStart}–${rangeEnd} of ${totalFiltered} alerts`}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto">
              <label className="flex items-center gap-2 text-xs font-medium text-ds-text-muted">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="rounded-xl border border-ds-border bg-white px-2 py-1.5 text-xs text-ds-text"
                  aria-label="Alerts per page"
                >
                  {ALERTS_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-lg border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text transition",
                    page <= 1 ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50",
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Previous
                </button>
                <div className="flex items-center gap-0.5 px-1">
                  {pageList.map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-ds-text-muted">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPage(item)}
                        className={clsx(
                          "min-w-8 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                          item === page
                            ? "bg-slate-900 text-white"
                            : "text-ds-text hover:bg-slate-100",
                        )}
                      >
                        {item}
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-lg border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text transition",
                    page >= totalPages ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50",
                  )}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <InvestigationDrawer
        open={drawerOpen}
        detail={detail}
        loading={detailLoading}
        onClose={closeDrawer}
        canInvestigate={canInvestigate}
        canResolve={canResolve}
        busy={busy}
        setBusy={setBusy}
        onApplied={() => {
          void refresh()
          if (selectedId) {
            void (async () => {
              const res = await fetch(`/api/alerts/${selectedId}`)
              if (res.ok) {
                const data = (await res.json()) as { alert: InvestigationAlertDetail }
                setDetail(data.alert)
              }
            })()
          }
        }}
      />
    </div>
  )
}

function InvestigationDrawer({
  open,
  detail,
  loading,
  onClose,
  canInvestigate,
  canResolve,
  busy,
  setBusy,
  onApplied,
}: {
  open: boolean
  detail: InvestigationAlertDetail | null
  loading: boolean
  onClose: () => void
  canInvestigate: boolean
  canResolve: boolean
  busy: boolean
  setBusy: (v: boolean) => void
  onApplied: () => void
}) {
  const [mounted, setMounted] = useState(false)
  const [comment, setComment] = useState("")
  const [resolveNotes, setResolveNotes] = useState("")
  const [resolutionType, setResolutionType] = useState<CounterfeitResolutionType>("legitimate_activity")
  const [assigneeId, setAssigneeId] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const post = async (url: string, body: unknown) => {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        window.alert(j?.error ?? "Request failed")
        return
      }
      onApplied()
    } finally {
      setBusy(false)
    }
  }

  if (!mounted || typeof document === "undefined") return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200]"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
            aria-label="Close panel"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-ds-border bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-ds-border p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                  Investigation workspace
                </p>
                <h2 className="mt-1 text-lg font-semibold text-ds-text">
                  {detail?.investigation_ref ?? "Loading…"}
                </h2>
                {detail ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SeverityBadge severity={detail.severity} />
                    <StatusBadge status={detail.status} />
                    <Badge className="rounded-lg bg-indigo-50 text-indigo-900">
                      {detail.confidence_score}% confidence
                    </Badge>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-ds-text-muted hover:bg-slate-100 hover:text-ds-text"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-8">
              {loading || !detail ? (
                <p className="text-sm text-ds-text-muted">Loading investigation data…</p>
              ) : (
                <>
                  <section className="rounded-2xl border border-ds-border bg-slate-50/60 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Overview</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                      <p>
                        <span className="text-ds-text-muted">Product · </span>
                        <span className="font-medium text-ds-text">{detail.product_name}</span>
                      </p>
                      <p>
                        <span className="text-ds-text-muted">SKU · </span>
                        {detail.sku ?? "—"}
                      </p>
                      <p>
                        <span className="text-ds-text-muted">QR identity · </span>
                        <span className="font-mono text-xs">{detail.qr_code ?? detail.qr_identity_id ?? "—"}</span>
                      </p>
                      <p>
                        <span className="text-ds-text-muted">Passport · </span>
                        {detail.passport_serial ?? "—"}
                      </p>
                      <p>
                        <span className="text-ds-text-muted">Product risk · </span>
                        {detail.product_risk_score ?? detail.risk_score_snapshot}
                      </p>
                      <p>
                        <span className="text-ds-text-muted">Verification · </span>
                        {detail.verification_status ?? "—"}
                      </p>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
                      Confidence breakdown
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {detail.analytics_hint.factors.map((f, i) => (
                        <li
                          key={`${f.label}-${i}`}
                          className="flex items-center justify-between rounded-xl border border-ds-border bg-white px-3 py-2 text-sm"
                        >
                          <span>{f.label}</span>
                          <span className="font-medium tabular-nums text-ds-text">+{f.weight}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Timeline</h3>
                    <ol className="mt-3 max-h-64 space-y-3 overflow-y-auto border-l-2 border-slate-200 pl-4">
                      {detail.timeline.map((t, i) => (
                        <li key={`${t.at}-${i}`} className="relative text-sm">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                          <p className="font-medium text-ds-text">{t.label}</p>
                          {t.detail ? <p className="text-xs text-ds-text-muted">{t.detail}</p> : null}
                          <p className="text-xs text-ds-text-muted">{formatTs(t.at)}</p>
                        </li>
                      ))}
                    </ol>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Evidence</h3>
                    <ul className="mt-3 space-y-2">
                      {detail.evidence.map((e) => (
                        <li key={e.id} className="rounded-xl border border-ds-border bg-[#F9FAFB] px-3 py-2 text-xs">
                          <p className="font-medium text-ds-text">{e.evidence_type}</p>
                          <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-ds-text-muted">
                            {JSON.stringify(e.payload, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Map view</h3>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {detail.map_points.length === 0 ? (
                        <p className="text-sm text-ds-text-muted">No geo points for this passport yet.</p>
                      ) : (
                        detail.map_points.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-xl border border-ds-border bg-white px-3 py-2 text-xs shadow-sm"
                          >
                            <p className="font-medium text-ds-text">{p.label}</p>
                            <p className="text-ds-text-muted">
                              {p.lat.toFixed(2)}, {p.long.toFixed(2)} · {formatTs(p.at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">Analyst notes</h3>
                    <div className="mt-3 space-y-3">
                      {detail.comments.map((c) => (
                        <div key={c.id} className="rounded-xl border border-ds-border bg-white px-3 py-2 text-sm">
                          <p className="text-ds-text">{c.body}</p>
                          <p className="mt-1 text-xs text-ds-text-muted">{formatTs(c.created_at)}</p>
                        </div>
                      ))}
                      {canInvestigate ? (
                        <div className="space-y-2">
                          <textarea
                            className="min-h-[88px] w-full rounded-xl border border-ds-border p-3 text-sm"
                            placeholder="Add internal note…"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="primary"
                            disabled={busy || !comment.trim()}
                            onClick={() =>
                              void post("/api/alerts/comment", {
                                alertId: detail.id,
                                body: comment,
                              }).then(() => setComment(""))
                            }
                          >
                            Post comment
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {canInvestigate ? (
                    <section className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-4">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-900">
                        <Shield className="h-4 w-4" aria-hidden />
                        Action center
                      </h3>
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            placeholder="Assignee user id (UUID)"
                            value={assigneeId}
                            onChange={(e) => setAssigneeId(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy || !assigneeId.trim()}
                            onClick={() =>
                              void post("/api/alerts/assign", {
                                alertId: detail.id,
                                assigneeId: assigneeId.trim(),
                              })
                            }
                          >
                            Assign
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void post("/api/alerts/escalate", {
                                alertId: detail.id,
                                note: "Escalated from investigation center",
                              })
                            }
                          >
                            Escalate
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            className="border-red-200 text-red-800 hover:bg-red-50"
                            onClick={() =>
                              void post("/api/alerts/confirm-fraud", {
                                alertId: detail.id,
                                note: "Confirmed counterfeit pattern",
                              })
                            }
                          >
                            Confirm fraud
                          </Button>
                        </div>
                        {canResolve ? (
                          <div className="space-y-2 border-t border-indigo-200/60 pt-4">
                            <p className="text-xs font-medium text-indigo-900">Resolve investigation</p>
                            <select
                              className="w-full rounded-xl border border-ds-border bg-white px-3 py-2 text-sm"
                              value={resolutionType}
                              onChange={(e) =>
                                setResolutionType(e.target.value as CounterfeitResolutionType)
                              }
                            >
                              <option value="legitimate_activity">Legitimate activity</option>
                              <option value="customer_travel">Customer travel</option>
                              <option value="logistics_explanation">Logistics explanation</option>
                              <option value="counterfeit_confirmed">Counterfeit confirmed</option>
                              <option value="duplicate_packaging_issue">Duplicate packaging issue</option>
                              <option value="testing_activity">Testing activity</option>
                              <option value="supplier_verification_completed">Supplier verification completed</option>
                            </select>
                            <textarea
                              className="min-h-[96px] w-full rounded-xl border border-ds-border p-3 text-sm"
                              placeholder="Resolution notes (required for audit)…"
                              value={resolveNotes}
                              onChange={(e) => setResolveNotes(e.target.value)}
                            />
                            <ResolutionActionsForm
                              busy={busy}
                              onResolve={(actions) =>
                                void post("/api/alerts/resolve", {
                                  alertId: detail.id,
                                  resolutionType,
                                  notes: resolveNotes,
                                  actions,
                                }).then(() => setResolveNotes(""))
                              }
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-ds-text-muted">
                            Your role can triage and escalate; resolution is limited to fraud, compliance, and admins.
                          </p>
                        )}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

function ResolutionActionsForm({
  busy,
  onResolve,
}: {
  busy: boolean
  onResolve: (actions: ResolutionAction[]) => void
}) {
  const [lower, setLower] = useState(false)
  const [suspend, setSuspend] = useState(false)
  const [revoke, setRevoke] = useState(false)
  const [blacklist, setBlacklist] = useState(false)
  const [whitelist, setWhitelist] = useState(false)
  const [fp, setFp] = useState(false)

  return (
    <div className="space-y-3">
      <p className="text-xs text-ds-text-muted">Product / QR actions (optional)</p>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} />
          Lower risk
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={suspend} onChange={(e) => setSuspend(e.target.checked)} />
          Suspend QR
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />
          Revoke passport
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={blacklist} onChange={(e) => setBlacklist(e.target.checked)} />
          Blacklist product
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={whitelist} onChange={(e) => setWhitelist(e.target.checked)} />
          Whitelist / trust product
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={fp} onChange={(e) => setFp(e.target.checked)} />
          Mark false positive
        </label>
      </div>
      <Button
        type="button"
        variant="primary"
        disabled={busy}
        onClick={() => {
          const actions: ResolutionAction[] = []
          if (lower) actions.push("lower_risk")
          if (suspend) actions.push("suspend_qr")
          if (revoke) actions.push("revoke_passport")
          if (blacklist) actions.push("blacklist_product")
          if (whitelist) actions.push("whitelist_product")
          if (fp) actions.push("mark_false_positive")
          onResolve(actions)
        }}
      >
        <Clock className="h-4 w-4" aria-hidden />
        Submit resolution
      </Button>
    </div>
  )
}
