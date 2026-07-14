"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import type { AuditLogEntry } from "@/lib/authenticity-intelligence"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { DatePicker } from "@/components/ui/DatePicker"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  ScrollText,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import clsx from "clsx"
import { productDisplayLabel } from "@/lib/product-display-label"

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const
const DEFAULT_PAGE_SIZE = 20

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

function downloadBlob(filename: string, mime: string, body: string) {
  const blob = new Blob([body], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function startOfDayLocal(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function defaultFromDate() {
  const t = startOfDayLocal(new Date())
  const f = new Date(t)
  f.setMonth(f.getMonth() - 1)
  return toLocalISODate(f)
}

function defaultToDate() {
  return toLocalISODate(startOfDayLocal(new Date()))
}

const PASSPORT_SCAN_ACTIONS: AuditLogEntry["action"][] = ["Scan", "Verify", "Flagged"]

const VERIFICATION_CATEGORIES = ["scan", "passport", "lifecycle", "verification"] as const
const OPERATIONS_CATEGORIES = ["team", "import", "system"] as const

type AuditLogVariant = "verification" | "operations"
type CategoryFilter = "" | (typeof VERIFICATION_CATEGORIES)[number] | (typeof OPERATIONS_CATEGORIES)[number]

/** UI filter maps to underlying scan actions (data model has Scan / Verify / Flagged only). */
type ActionTypeFilter = "" | "created" | "updated" | "deleted"

function matchesActionTypeFilter(row: AuditLogEntry, filter: ActionTypeFilter): boolean {
  if (!filter) return true
  if (filter === "created") return row.action === "Scan"
  if (filter === "updated") return row.action === "Verify"
  if (filter === "deleted") return row.action === "Flagged"
  return true
}

function actionBadgeClass(action: AuditLogEntry["action"]) {
  switch (action) {
    case "Scan":
    case "PassportCreated":
      return "border-emerald-200/90 bg-emerald-50 text-emerald-900"
    case "Verify":
    case "VerificationRun":
    case "AlertReview":
      return "border-amber-200/90 bg-amber-50 text-amber-900"
    case "Flagged":
    case "LifecycleUpdated":
      return "border-rose-200/90 bg-rose-50 text-rose-900"
    case "ImportBatch":
      return "border-sky-200/90 bg-sky-50 text-sky-900"
    default:
      return "border-slate-200 bg-slate-50 text-slate-800"
  }
}

function actionDisplayLabel(action: AuditLogEntry["action"]) {
  switch (action) {
    case "Scan":
      return "Scan"
    case "Verify":
      return "Verify"
    case "Flagged":
      return "Flagged"
    case "PassportCreated":
      return "Passport created"
    case "LifecycleUpdated":
      return "Lifecycle updated"
    case "VerificationRun":
      return "Verification run"
    case "AlertReview":
      return "Alert review"
    case "ImportBatch":
      return "CSV import"
    default:
      return String(action)
  }
}

/** Page buttons with ellipses for large page counts. */
function buildPageList(current: number, total: number): (number | "ellipsis")[] {
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

function AuditTableSkeleton({ rowCount }: { rowCount: number }) {
  const colWidths = ["w-24", "w-32", "w-20", "w-24", "w-40", "w-28", "w-24"]
  return (
    <tbody className="divide-y divide-ds-border" aria-hidden>
      {Array.from({ length: rowCount }).map((_, i) => (
        <tr key={i}>
          {colWidths.map((w, j) => (
            <td key={j} className="py-4 pr-4">
              <div className={clsx("h-4 animate-pulse rounded-md bg-slate-200/75", w)} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export function AuthenticityAuditLogsClient({
  variant = "verification",
  initialRows,
  initialScope,
}: {
  variant?: AuditLogVariant
  initialRows: AuditLogEntry[]
  initialScope?: "passport_scan"
}) {
  const isVerificationView = variant === "verification"
  const [rows] = useState<AuditLogEntry[]>(initialRows)
  const [from, setFrom] = useState(defaultFromDate)
  const [to, setTo] = useState(defaultToDate)
  const [product, setProduct] = useState("")
  const [resultFilter, setResultFilter] = useState<"" | "Success" | "Failed" | "Suspicious" | "Info">("")
  const [actionTypeFilter, setActionTypeFilter] = useState<ActionTypeFilter>("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("")
  const [passportScanOnly, setPassportScanOnly] = useState(
    isVerificationView && initialScope === "passport_scan",
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [isPaging, startPagingTransition] = useTransition()

  const productOptions = useMemo(() => {
    const m = new Map<string, string | null | undefined>()
    for (const r of rows) {
      if (!m.has(r.product_id)) m.set(r.product_id, r.product_name ?? null)
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, name]) => ({ id, name }))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (isVerificationView) {
        if (passportScanOnly && !PASSPORT_SCAN_ACTIONS.includes(r.action)) return false
        if (categoryFilter && r.category !== categoryFilter) return false
      } else if (categoryFilter && r.category !== categoryFilter) {
        return false
      }
      if (isVerificationView && product && r.product_id !== product) return false
      if (isVerificationView && !matchesActionTypeFilter(r, actionTypeFilter)) return false
      if (resultFilter === "Suspicious" && r.verdict !== "suspicious" && r.result !== "Suspicious")
        return false
      if (resultFilter === "Success" && r.result !== "Success") return false
      if (resultFilter === "Failed" && r.result !== "Failed") return false
      if (resultFilter === "Info" && r.result !== "Info") return false
      const t = new Date(r.timestamp).getTime()
      if (from && t < new Date(from).getTime()) return false
      if (to && t > new Date(to).getTime() + 86400000) return false
      return true
    })
  }, [
    rows,
    product,
    resultFilter,
    actionTypeFilter,
    categoryFilter,
    from,
    to,
    passportScanOnly,
    isVerificationView,
  ])

  const totalFiltered = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))

  useEffect(() => {
    setPage(1)
  }, [from, to, product, resultFilter, actionTypeFilter, categoryFilter, passportScanOnly])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const rangeStart = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalFiltered)

  function goPage(next: number) {
    const p = Math.max(1, Math.min(totalPages, next))
    startPagingTransition(() => setPage(p))
  }

  function changePageSize(next: number) {
    startPagingTransition(() => {
      setPageSize(next)
      setPage(1)
    })
  }

  const exportCsv = () => {
    const header = [
      "event_id",
      "product_id",
      "action",
      "result",
      "location",
      "timestamp",
      "actor",
    ]
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.event_id,
          r.product_id,
          r.action,
          r.result,
          `"${r.location.replace(/"/g, '""')}"`,
          r.timestamp,
          r.actor,
        ].join(",")
      ),
    ]
    downloadBlob(
      isVerificationView ? "originpass-verification-audit-log.csv" : "originpass-security-log.csv",
      "text/csv;charset=utf-8",
      lines.join("\n"),
    )
  }

  const exportJson = () => {
    downloadBlob(
      isVerificationView ? "originpass-verification-audit-log.json" : "originpass-security-log.json",
      "application/json",
      JSON.stringify(filtered, null, 2)
    )
  }

  const pageList = buildPageList(page, totalPages)
  const selectCls = clsx(
    "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm",
    "focus:border-secondary/40 focus:outline-none focus:ring-2 focus:ring-secondary/30"
  )
  const resourceColumnLabel = isVerificationView ? "Product" : "Resource"
  const contextColumnLabel = isVerificationView ? "Location" : "Context"

  return (
    <div className="space-y-8">
      {isVerificationView && passportScanOnly ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-sm text-slate-700">
            Showing passport scan events (same records as <strong>Recent Scans</strong> on the dashboard).
          </p>
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-slate-900 underline decoration-slate-400 underline-offset-2 hover:decoration-slate-900"
            onClick={() => setPassportScanOnly(false)}
          >
            Show all audit events
          </button>
        </div>
      ) : null}

      {isVerificationView ? (
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ScrollText className="h-5 w-5 shrink-0 text-emerald-800" aria-hidden />
            <p className="text-sm font-medium text-emerald-950">
              Product asset chain audit trail: passport scans, issuance, verification reviews, and lifecycle
              status changes for DPP compliance exports.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <ScrollText className="h-5 w-5 shrink-0 text-slate-700" aria-hidden />
            <p className="text-sm font-medium text-slate-900">
              Organization admin activity: team invitations and role changes, settings updates, and CSV product
              import batches. Consumer scan events appear under Verification audit logs.
            </p>
          </div>
        </div>
      )}

      <Card
        padding
        className="rounded-2xl border border-ds-border bg-[#F9FAFB] shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-text-muted">
          Date range and filters
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label htmlFor="audit-from" className="text-xs font-medium text-ds-text-muted">
              From
            </label>
            <DatePicker
              id="audit-from"
              value={from}
              onChange={setFrom}
              placeholder="mm/dd/yyyy"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="audit-to" className="text-xs font-medium text-ds-text-muted">
              To
            </label>
            <DatePicker
              id="audit-to"
              value={to}
              onChange={setTo}
              placeholder="mm/dd/yyyy"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="audit-action-type" className="text-xs font-medium text-ds-text-muted">
              {isVerificationView ? "Action" : "Category"}
            </label>
            {isVerificationView ? (
              <select
                id="audit-action-type"
                value={actionTypeFilter}
                onChange={(e) => setActionTypeFilter(e.target.value as ActionTypeFilter)}
                className={clsx("mt-1 w-full", selectCls)}
              >
                <option value="">All Actions</option>
                <option value="created">Created (scan)</option>
                <option value="updated">Updated (verify)</option>
                <option value="deleted">Deleted / alert (flagged)</option>
              </select>
            ) : (
              <select
                id="audit-action-type"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className={clsx("mt-1 w-full", selectCls)}
              >
                <option value="">All categories</option>
                <option value="team">Team & access</option>
                <option value="import">CSV imports</option>
                <option value="system">System</option>
              </select>
            )}
          </div>
          {isVerificationView ? (
            <>
              <div>
                <label htmlFor="audit-product" className="text-xs font-medium text-ds-text-muted">
                  Product
                </label>
                <select
                  id="audit-product"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className={clsx("mt-1 w-full", selectCls)}
                >
                  <option value="">All Products</option>
                  {productOptions.map(({ id, name }) => (
                    <option key={id} value={id}>
                      {productDisplayLabel(id, name)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="audit-category" className="text-xs font-medium text-ds-text-muted">
                  Event type
                </label>
                <select
                  id="audit-category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                  className={clsx("mt-1 w-full", selectCls)}
                >
                  <option value="">All asset events</option>
                  <option value="scan">Scans</option>
                  <option value="passport">Passport issuance</option>
                  <option value="verification">Verification reviews</option>
                  <option value="lifecycle">Lifecycle changes</option>
                </select>
              </div>
            </>
          ) : null}
          <div>
            <label htmlFor="audit-result" className="text-xs font-medium text-ds-text-muted">
              Result
            </label>
            <select
              id="audit-result"
              value={resultFilter}
              onChange={(e) =>
                setResultFilter(e.target.value as "" | "Success" | "Failed" | "Suspicious" | "Info")
              }
              className={clsx("mt-1 w-full", selectCls)}
            >
              <option value="">All</option>
              <option value="Success">Success</option>
              <option value="Suspicious">Suspicious</option>
              <option value="Failed">Failed</option>
              {!isVerificationView ? <option value="Info">Info</option> : null}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportJson}>
            <FileJson className="h-4 w-4" aria-hidden />
            Export JSON
          </Button>
        </div>
      </Card>

      <Card padding className="rounded-2xl border border-ds-border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                <th className="whitespace-nowrap pb-3 pr-4">Event ID</th>
                <th className="whitespace-nowrap pb-3 pr-4">{resourceColumnLabel}</th>
                <th className="whitespace-nowrap pb-3 pr-4">Action</th>
                <th className="whitespace-nowrap pb-3 pr-4">Result</th>
                <th className="whitespace-nowrap pb-3 pr-4">{contextColumnLabel}</th>
                <th className="whitespace-nowrap pb-3 pr-4">Timestamp</th>
                <th className="whitespace-nowrap pb-3">User / system</th>
              </tr>
            </thead>
            {isPaging ? (
              <AuditTableSkeleton rowCount={pageSize} />
            ) : (
              <tbody className="divide-y divide-ds-border">
                {paginated.map((r) => (
                  <tr key={r.event_id} className="hover:bg-[#F9FAFB]">
                    <td className="py-4 pr-4 font-mono text-sm text-ds-text">{r.event_id}</td>
                    <td className="py-4 pr-4 text-sm text-ds-text">
                      {isVerificationView
                        ? productDisplayLabel(r.product_id, r.product_name)
                        : r.product_name ?? r.product_id}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={clsx(
                          "inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-medium",
                          actionBadgeClass(r.action)
                        )}
                      >
                        {isVerificationView ? actionDisplayLabel(r.action) : r.action}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-sm font-medium",
                          r.result === "Suspicious" || r.verdict === "suspicious"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : r.verdict === "failed" || r.result === "Failed"
                              ? "border-rose-200 bg-rose-50 text-rose-800"
                              : r.result === "Info"
                                ? "border-slate-200 bg-slate-50 text-slate-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800"
                        )}
                      >
                        {r.result === "Suspicious" || r.verdict === "suspicious" ? (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : r.verdict === "failed" || r.result === "Failed" ? (
                          <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ) : r.result === "Info" ? null : (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        )}
                        {r.result}
                      </span>
                    </td>
                    <td
                      className={clsx(
                        "py-4 pr-4 text-sm",
                        r.location === "Not captured"
                          ? "italic text-ds-text-muted"
                          : "text-ds-text-muted",
                      )}
                      title={
                        isVerificationView && r.location === "Not captured"
                          ? "City/country come from edge geo headers (e.g. on Vercel) or DEV_SCAN_GEO_* in .env for local dev."
                          : undefined
                      }
                    >
                      {r.location}
                    </td>
                    <td className="py-4 pr-4 text-xs text-ds-text-muted tabular-nums">
                      {formatTs(r.timestamp)}
                    </td>
                    <td className="py-4 font-mono text-sm text-ds-text-muted">{r.actor}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        {!isPaging && paginated.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ds-text-muted">No events match your filters.</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-4 border-t border-ds-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ds-text-muted">
            {totalFiltered === 0
              ? "No results"
              : `Showing ${rangeStart}–${rangeEnd} of ${totalFiltered} events (${rows.length} loaded)`}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto">
            <label className="flex items-center gap-2 text-xs font-medium text-ds-text-muted">
              Per page
              <select
                value={pageSize}
                onChange={(e) => changePageSize(Number(e.target.value))}
                className={clsx(selectCls, "py-1.5 text-xs")}
                aria-label="Results per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goPage(page - 1)}
                disabled={page <= 1 || isPaging}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-lg border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text transition",
                  page <= 1 || isPaging
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-slate-50"
                )}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous
              </button>
              <div className="flex items-center gap-0.5 px-1">
                {pageList.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`e-${idx}`} className="px-1 text-xs text-ds-text-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goPage(item)}
                      disabled={isPaging}
                      className={clsx(
                        "min-w-8 rounded-lg px-2 py-1.5 text-xs font-medium transition",
                        item === page
                          ? "bg-slate-900 text-white"
                          : "text-ds-text hover:bg-slate-100"
                      )}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
              <button
                type="button"
                onClick={() => goPage(page + 1)}
                disabled={page >= totalPages || isPaging}
                className={clsx(
                  "inline-flex items-center gap-1 rounded-lg border border-ds-border bg-white px-3 py-2 text-xs font-medium text-ds-text transition",
                  page >= totalPages || isPaging
                    ? "cursor-not-allowed opacity-50"
                    : "hover:bg-slate-50"
                )}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
