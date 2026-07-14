"use client"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import clsx from "clsx"
import { VERIFICATION_ROUTES } from "@/lib/verification-nav"

export type RecentScanEventRow = {
  id: string
  created_at: string | null
  result?: string | null
  device?: string | null
  city?: string | null
  country?: string | null
  passport_serial?: string | null
}

type LucideIcon = typeof ShieldCheck

function scanResultPresentation(raw: string | null | undefined): {
  label: string
  Icon: LucideIcon
  pillClass: string
  iconClass: string
} {
  const r = (raw ?? "").toLowerCase().trim()
  if (r === "suspicious") {
    return {
      label: "Suspicious",
      Icon: AlertTriangle,
      pillClass: "border border-amber-200 bg-amber-50 text-amber-700",
      iconClass: "text-amber-700",
    }
  }
  if (r === "fraud") {
    return {
      label: "Fraud",
      Icon: AlertTriangle,
      pillClass: "border border-rose-200 bg-rose-50 text-rose-800",
      iconClass: "text-rose-700",
    }
  }
  if (r === "invalid" || r === "duplicate") {
    return {
      label: r === "duplicate" ? "Duplicate" : "Invalid",
      Icon: AlertTriangle,
      pillClass: "border border-rose-200 bg-rose-50 text-rose-800",
      iconClass: "text-rose-700",
    }
  }
  if (r === "valid" || r === "") {
    return {
      label: "Valid",
      Icon: ShieldCheck,
      pillClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClass: "text-emerald-700",
    }
  }
  const label = raw?.trim() ? raw.trim().replace(/^\w/, (c) => c.toUpperCase()) : "Recorded"
  return {
    label,
    Icon: ShieldCheck,
    pillClass: "border border-slate-200 bg-slate-50 text-slate-700",
    iconClass: "text-slate-600",
  }
}

const AUDIT_SCANS_HREF = `${VERIFICATION_ROUTES.audit}?event=passport_scan`

const PAGE_SIZE = 8

export function RecentScansTable({ scans }: { scans: RecentScanEventRow[] }) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(scans.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)

  const pageRows = useMemo(() => {
    const start = currentPage * PAGE_SIZE
    return scans.slice(start, start + PAGE_SIZE)
  }, [scans, currentPage])

  const rangeStart = scans.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, scans.length)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Scans</h2>
        <Link
          href={AUDIT_SCANS_HREF}
          className="cursor-pointer text-sm text-slate-500 transition hover:text-slate-900"
        >
          View logs
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Scan ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Passport
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Device
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                  No scan events yet.
                </td>
              </tr>
            ) : (
              pageRows.map((scan) => {
                const vis = scanResultPresentation(scan.result)
                const Icon = vis.Icon
                return (
                  <tr key={scan.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">{scan.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{scan.passport_serial || "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {scan.city || scan.country || "Unknown"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{scan.device || "Unknown"}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          vis.pillClass,
                        )}
                      >
                        <Icon className={clsx("h-3.5 w-3.5 shrink-0", vis.iconClass)} aria-hidden />
                        <span>{vis.label}</span>
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {scans.length > 0 && totalPages > 1 ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage + 1} of {totalPages} · Showing {rangeStart}–{rangeEnd} of {scans.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
