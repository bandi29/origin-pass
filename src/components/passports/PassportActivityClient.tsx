"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import clsx from "clsx"
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileCheck2,
  Info,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import {
  buildDemoPassportActivityLogs,
  DEMO_ACTIVITY_SUMMARY,
} from "@/lib/passport-activity-mock"
import type {
  PassportActivityFilter,
  PassportActivityLogEntry,
  PassportActivitySummary,
} from "@/lib/passport-activity-types"
import {
  eventTypeBadgeClass,
  eventTypeLabel,
  filterPassportActivityLogs,
  formatPassportActivityTimestamp,
  formatPassportActivityTimestampDetailed,
  passportActivityEventLabel,
} from "@/lib/passport-activity-types"

const FILTER_TABS: { id: PassportActivityFilter; label: string }[] = [
  { id: "all", label: "All Activity" },
  { id: "scans", label: "Scans" },
  { id: "creations", label: "Creations" },
  { id: "updates", label: "Updates" },
]

const filterTrackClass =
  "inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-100/70 p-1"

const filterPillBase =
  "rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200"

const ACTIVITY_PAGE_SIZE = 10

function SourceBadge({ variant }: { variant: "live" | "demo" }) {
  if (variant === "live") {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
        Live data
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
      Demo preview
    </span>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  muted,
}: {
  label: string
  value: string
  hint?: string | null
  icon: typeof ScanLine
  muted?: boolean
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-5 shadow-sm",
        muted
          ? "border-amber-200/60 bg-amber-50/30"
          : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
          <p
            className={clsx(
              "mt-2 text-3xl font-bold tracking-tight",
              muted ? "text-amber-950/80" : "text-slate-900",
            )}
          >
            {value}
          </p>
          {hint ? (
            <p
              className={clsx(
                "mt-1.5 text-xs font-medium",
                muted ? "text-amber-800/80" : "text-emerald-700",
              )}
            >
              {hint}
            </p>
          ) : null}
        </div>
        <div
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            muted ? "bg-amber-100/80 text-amber-700" : "bg-slate-100 text-slate-500",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function ActivityLogTable({
  rows,
  filter,
  onFilterChange,
  nowMs,
  emptyMessage,
  showDemoColumn,
}: {
  rows: PassportActivityLogEntry[]
  filter: PassportActivityFilter
  onFilterChange: (f: PassportActivityFilter) => void
  nowMs: number
  emptyMessage: string
  showDemoColumn?: boolean
}) {
  const [page, setPage] = useState(0)

  const filtered = useMemo(
    () => filterPassportActivityLogs(rows, filter),
    [rows, filter],
  )

  useEffect(() => {
    setPage(0)
  }, [filter, rows])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ACTIVITY_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)

  const pageRows = useMemo(() => {
    const start = currentPage * ACTIVITY_PAGE_SIZE
    return filtered.slice(start, start + ACTIVITY_PAGE_SIZE)
  }, [filtered, currentPage])

  const rangeStart = filtered.length === 0 ? 0 : currentPage * ACTIVITY_PAGE_SIZE + 1
  const rangeEnd = Math.min((currentPage + 1) * ACTIVITY_PAGE_SIZE, filtered.length)
  const filterLabel = FILTER_TABS.find((t) => t.id === filter)?.label.toLowerCase()

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className={filterTrackClass} role="tablist" aria-label="Filter activity">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(tab.id)}
                className={clsx(
                  filterPillBase,
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900",
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/80">
            <tr>
              {showDemoColumn ? (
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Source
                </th>
              ) : null}
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Event
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Description
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Target asset
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={showDemoColumn ? 5 : 4}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  className={clsx(
                    "transition hover:bg-slate-50/70",
                    row.isDemo && "bg-amber-50/20",
                  )}
                >
                  {showDemoColumn ? (
                    <td className="whitespace-nowrap px-5 py-4 align-top">
                      {row.isDemo ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                          Sample
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                          Live
                        </span>
                      )}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-5 py-4 align-top">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                        eventTypeBadgeClass(row.eventType),
                      )}
                    >
                      <FileCheck2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                      {passportActivityEventLabel(row)}
                    </span>
                  </td>
                  <td className="max-w-md px-5 py-4 align-top text-slate-700">
                    {row.description}
                    {row.isDemo ? (
                      <span className="mt-1 block text-[10px] font-medium uppercase tracking-wider text-amber-700/80">
                        Fictional example — not your organization
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-top">
                    {row.isDemo ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                        {row.targetLabel}
                      </span>
                    ) : (
                      <Link
                        href={row.targetHref}
                        className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
                      >
                        {row.targetLabel}
                        <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden />
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-slate-500">
                    <time
                      dateTime={row.occurredAt}
                      title={formatPassportActivityTimestampDetailed(row.occurredAt)}
                    >
                      {formatPassportActivityTimestamp(row.occurredAt, nowMs)}
                    </time>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {totalPages > 1 ? (
              <>
                Page {currentPage + 1} of {totalPages} · Showing {rangeStart}–{rangeEnd} of{" "}
                {filtered.length}
              </>
            ) : (
              <>Showing {filtered.length} event{filtered.length === 1 ? "" : "s"}</>
            )}
            {filter !== "all" && filterLabel ? ` · ${filterLabel}` : ""}
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export type PassportActivityClientProps = {
  liveSummary: PassportActivitySummary
  liveLogs: PassportActivityLogEntry[]
}

export function PassportActivityClient({ liveSummary, liveLogs }: PassportActivityClientProps) {
  const [liveFilter, setLiveFilter] = useState<PassportActivityFilter>("all")
  const [demoFilter, setDemoFilter] = useState<PassportActivityFilter>("all")
  const [showDemoPreview, setShowDemoPreview] = useState(liveLogs.length === 0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const demoLogs = useMemo(() => buildDemoPassportActivityLogs(nowMs), [nowMs])
  const hasLiveActivity = liveLogs.length > 0

  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <p>
          <span className="font-medium text-slate-800">Live data</span> is pulled from your
          organization&apos;s scans, passport issuances, and ownership claims.{" "}
          <span className="font-medium text-amber-900">Demo preview</span> rows are fictional
          examples for layout only — they never affect your metrics.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="live-activity-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="live-activity-heading" className="text-lg font-semibold text-slate-900">
                Your organization
              </h2>
              <SourceBadge variant="live" />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Recorded passport events from your catalog — updated when scans and claims occur.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="Total Scans"
            value={liveSummary.totalScans.toLocaleString()}
            hint={liveSummary.scansTrendLabel}
            icon={ScanLine}
          />
          <MetricCard
            label="Passports Generated"
            value={String(liveSummary.passportsGenerated)}
            icon={QrCode}
          />
          <MetricCard
            label="Ownership Claims"
            value={String(liveSummary.ownershipClaims)}
            icon={ShieldCheck}
          />
        </div>

        <ActivityLogTable
          rows={liveLogs}
          filter={liveFilter}
          onFilterChange={setLiveFilter}
          nowMs={nowMs}
          emptyMessage="No recorded activity yet. When consumers scan your QR codes or you issue passports, events will appear here."
        />
      </section>

      <section
        className="rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/20 p-5"
        aria-labelledby="demo-activity-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
              <h2 id="demo-activity-heading" className="text-base font-semibold text-amber-950">
                Sample layout preview
              </h2>
              <SourceBadge variant="demo" />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-amber-900/80">
              Fictional rows that illustrate how this audit log will look once activity picks up.
              Timestamps here are generated relative to now and are not real events.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDemoPreview((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-50"
          >
            {showDemoPreview ? (
              <>
                Hide demo <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Show demo examples <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {showDemoPreview ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Total Scans (sample)"
                value={DEMO_ACTIVITY_SUMMARY.totalScans.toLocaleString()}
                hint={DEMO_ACTIVITY_SUMMARY.scansTrendLabel}
                icon={ScanLine}
                muted
              />
              <MetricCard
                label="Passports (sample)"
                value={String(DEMO_ACTIVITY_SUMMARY.passportsGenerated)}
                icon={QrCode}
                muted
              />
              <MetricCard
                label="Claims (sample)"
                value={String(DEMO_ACTIVITY_SUMMARY.ownershipClaims)}
                icon={ShieldCheck}
                muted
              />
            </div>

            <ActivityLogTable
              rows={demoLogs}
              filter={demoFilter}
              onFilterChange={setDemoFilter}
              nowMs={nowMs}
              emptyMessage="No sample rows."
              showDemoColumn
            />
          </div>
        ) : hasLiveActivity ? (
          <p className="mt-4 text-xs text-amber-800/70">
            Demo preview is collapsed because you have live activity above. Expand to compare layout
            examples.
          </p>
        ) : null}
      </section>
    </div>
  )
}
