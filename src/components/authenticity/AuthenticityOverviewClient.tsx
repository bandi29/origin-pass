"use client"

import { useEffect, useMemo, useState } from "react"
import type {
  AuthenticityMetric,
  AuthenticityRow,
  AuthenticityVerificationStatus,
} from "@/lib/authenticity-dashboard-data"
import type { ScanEvent } from "@/lib/authenticity-intelligence"
import {
  enrichRowsWithRisk,
  riskBand,
  type EnrichedAuthenticityRow,
} from "@/lib/authenticity-intelligence"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { IconChip } from "@/components/ui/IconChip"
import { StatCard } from "@/components/ui/StatCard"
import { typography } from "@/design-system/tokens"
import {
  CheckCircle2,
  Cpu,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import clsx from "clsx"

/** Map an AuthenticityMetric.id → a brand-aligned IconChip tone. Keeps the
 *  metric strip visually distinct without falling back to slate-on-slate. */
function toneForMetric(id: string): "indigo" | "emerald" | "amber" | "rose" | "violet" | "navy" {
  const lower = id.toLowerCase()
  if (lower.includes("scan")) return "indigo"
  if (lower.includes("verified") || lower.includes("success")) return "emerald"
  if (lower.includes("alert") || lower.includes("fraud") || lower.includes("risk")) return "rose"
  if (lower.includes("review") || lower.includes("pending")) return "amber"
  if (lower.includes("owner")) return "violet"
  return "navy"
}

function StatusBadge({ status }: { status: AuthenticityVerificationStatus }) {
  const map = {
    verified: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80",
    suspicious: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    failed: "bg-red-50 text-red-800 ring-1 ring-red-200/80",
  } as const
  const labels = {
    verified: "Verified",
    suspicious: "Suspicious",
    failed: "Failed",
  } as const
  return (
    <Badge className={clsx("rounded-lg font-medium ring-inset", map[status])}>
      {labels[status]}
    </Badge>
  )
}

function RiskScoreCell({ score }: { score: number }) {
  const band = riskBand(score)
  const cls =
    band === "safe"
      ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80"
      : band === "suspicious"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80"
        : "bg-red-50 text-red-800 ring-1 ring-red-200/80"
  return (
    <span
      className={clsx(
        "inline-flex min-w-[3rem] justify-center rounded-lg px-2 py-0.5 text-xs font-semibold tabular-nums",
        cls
      )}
    >
      {score}
    </span>
  )
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

export function AuthenticityOverviewClient({
  metrics,
  verificationRows,
  scansByProductId,
}: {
  metrics: AuthenticityMetric[]
  verificationRows: AuthenticityRow[]
  scansByProductId: Record<string, ScanEvent[]>
}) {
  const rows = useMemo(
    () => enrichRowsWithRisk(verificationRows, scansByProductId),
    [verificationRows, scansByProductId]
  )
  const [selected, setSelected] = useState<EnrichedAuthenticityRow | null>(null)

  useEffect(() => {
    if (!rows.length) {
      setSelected(null)
      return
    }
    setSelected((prev) => {
      if (!prev) return rows[0]!
      if (rows.some((r) => r.qr_id === prev.qr_id)) return prev
      return rows[0]!
    })
  }, [rows])

  const intelligenceSummary = useMemo(() => {
    if (!rows.length) {
      return { high: 0, watch: 0, avg: 0 }
    }
    const high = rows.filter((r) => riskBand(r.risk_score) === "high").length
    const watch = rows.filter((r) => riskBand(r.risk_score) === "suspicious").length
    return {
      high,
      watch,
      avg: Math.round(rows.reduce((a, r) => a + r.risk_score, 0) / rows.length),
    }
  }, [rows])

  const previewStatus = useMemo(() => {
    if (!selected) {
      return {
        badgeClass: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        label: "No selection",
        message: "Scan activity will appear here once customers verify your products.",
      }
    }
    if (selected.status === "verified") {
      return {
        badgeClass:
          "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
        label: "Verified",
        message: "This product is verified and authentic.",
      }
    }
    if (selected.status === "suspicious") {
      return {
        badgeClass: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
        label: "Suspicious",
        message:
          "Verification raised a flag. Review rules and alert inbox for details.",
      }
    }
    return {
      badgeClass: "bg-red-50 text-red-800 ring-1 ring-red-200",
      label: "Failed",
      message: "Verification could not be completed for this scan.",
    }
  }, [selected])

  return (
    <div className="space-y-8">
      {/* Metric strip — drives off the shared StatCard primitive so radius,
          number weight, icon-chip styling all match the main dashboard. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <StatCard
            key={m.id}
            label={m.label}
            value={<span className="tabular-nums">{m.value}</span>}
            icon={
              m.trendUp ? (
                <TrendingUp aria-hidden />
              ) : (
                <TrendingDown aria-hidden />
              )
            }
            tone={toneForMetric(m.id)}
            helper={
              <span
                className={clsx(
                  "inline-flex items-center gap-1 font-medium",
                  m.trendUp ? "text-emerald-600" : "text-slate-500",
                )}
              >
                {m.trendLabel}
              </span>
            }
          />
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-ds-border pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <IconChip tone="navy" size="lg">
              <Cpu />
            </IconChip>
            <div>
              <h2 className={typography.h2}>AI detection engine</h2>
              <p className="mt-0.5 text-sm leading-relaxed text-ds-text-muted">
                Automatically identify suspicious product activity using rule-based scoring.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-800", ring: "ring-emerald-200/80", label: "0–30 Safe" },
              { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-900", ring: "ring-amber-200/80", label: "31–70 Suspicious" },
              { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-800", ring: "ring-red-200/80", label: "71–100 High risk" },
            ].map((band) => (
              <span
                key={band.label}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ring-1",
                  band.bg,
                  band.text,
                  band.ring,
                )}
              >
                <span className={clsx("h-1.5 w-1.5 rounded-full", band.dot)} />
                {band.label}
              </span>
            ))}
          </div>
        </div>
        {/* Intelligence summary — three soft tiles driven by the canvas token
            (replaces the magic #F9FAFB). Tone of the number tracks the band. */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Catalog avg. risk", value: intelligenceSummary.avg, valueClass: "text-ds-text" },
            { label: "In review (31–70)", value: intelligenceSummary.watch, valueClass: "text-amber-700" },
            { label: "High risk SKUs", value: intelligenceSummary.high, valueClass: "text-red-700" },
          ].map((tile) => (
            <Card key={tile.label} variant="soft" padding={false} className="px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                {tile.label}
              </p>
              <p className={clsx("mt-1 text-2xl font-semibold tabular-nums", tile.valueClass)}>
                {tile.value}
              </p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ds-text-muted">
          Signals: duplicate bursts (&lt;2 min), impossible travel (&gt;500 km in &lt;10 min),
          velocity (&gt;10 scans / 5 min), region mismatch. Scores use recent scan locations
          (approximated when only city or country is stored).
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <Card className="min-w-0">
          <div className="flex flex-col gap-1 border-b border-ds-border pb-4">
            <h2 className={typography.h2}>Verification status</h2>
            <p className="text-sm leading-relaxed text-ds-text-muted">
              Recent scans across your catalog
            </p>
          </div>
          {!rows.length ? (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-ds-border bg-canvas px-4 py-5">
              <IconChip tone="slate" size="md">
                <ShieldCheck />
              </IconChip>
              <div>
                <p className="text-sm font-medium text-ds-text">No verification scans yet</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ds-text-muted">
                  When customers scan your QR codes, recent activity will show here.
                </p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-ds-border text-xs font-medium uppercase tracking-wide text-ds-text-muted">
                  <th className="whitespace-nowrap pb-3 pr-4">Product</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Batch ID</th>
                  <th className="whitespace-nowrap pb-3 pr-4">QR code ID</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Last scan</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Risk</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Anomaly</th>
                  <th className="whitespace-nowrap pb-3 pr-4">Status</th>
                  <th className="whitespace-nowrap pb-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ds-border">
                {rows.map((row) => {
                  const active = selected ? row.qr_id === selected.qr_id : false
                  return (
                    <tr
                      key={row.qr_id}
                      className={clsx(
                        "cursor-pointer transition-colors",
                        active ? "bg-slate-50" : "hover:bg-canvas",
                      )}
                      onClick={() => setSelected(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Show preview for ${row.product_name}`}
                    >
                      <td className="py-3 pr-4 font-medium text-ds-text">
                        {row.product_name}
                      </td>
                      <td className="py-3 pr-4 text-ds-text-muted">{row.batch_id}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-ds-text-muted">
                        {row.qr_id}
                      </td>
                      <td className="py-3 pr-4 text-ds-text-muted">
                        {row.last_scan_location}
                      </td>
                      <td className="py-3 pr-4">
                        <RiskScoreCell score={row.risk_score} />
                      </td>
                      <td className="py-3 pr-4 text-ds-text-muted">{row.anomaly_type}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="py-3 text-ds-text-muted">{formatTs(row.timestamp)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variant="soft" className="h-fit xl:sticky xl:top-24">
          <div className="flex items-center gap-2 border-b border-ds-border pb-4">
            <IconChip tone="slate" size="sm">
              <Shield />
            </IconChip>
            <h2 className={typography.h2}>Live verification preview</h2>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ds-text-muted">
            Based on the selected row and rule-based scoring from recent scan patterns.
          </p>

          <div className="mt-6 rounded-2xl border border-ds-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Passport preview
            </p>
            <p className="mt-2 text-lg font-semibold text-ds-text">
              {selected?.product_name ?? "—"}
            </p>
            <p className="mt-1 text-sm text-ds-text-muted">
              Origin: {selected?.origin ?? "—"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <RiskScoreCell score={selected?.risk_score ?? 0} />
              <span className="text-xs text-ds-text-muted">Risk score</span>
            </div>
            {selected && selected.risk_breakdown.reasons.length > 0 ? (
              <ul className="mt-3 list-inside list-disc text-xs text-ds-text-muted">
                {selected.risk_breakdown.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex items-center gap-2">
              <CheckCircle2
                className={clsx(
                  "h-5 w-5",
                  !selected
                    ? "text-slate-400"
                    : selected.status === "verified"
                      ? "text-emerald-600"
                      : selected.status === "suspicious"
                        ? "text-amber-600"
                        : "text-red-600"
                )}
                aria-hidden
              />
              <span
                className={clsx(
                  "inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold",
                  previewStatus.badgeClass
                )}
              >
                {previewStatus.label}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ds-text-muted">
              {previewStatus.message}
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
