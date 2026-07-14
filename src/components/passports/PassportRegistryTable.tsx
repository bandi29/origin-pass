"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { ChevronRight } from "lucide-react"
import clsx from "clsx"
import type { PassportRegistryRow } from "@/lib/passport-registry-map"

export const PASSPORT_REGISTRY_PAGE_SIZE = 8

type PassportRegistryTableProps = {
  rows: PassportRegistryRow[]
  /** Resets page when the user switches All vs This month. */
  viewKey: string
  /** Resets page when search (or other filter) changes. */
  pageResetKey?: string
  /** One-shot page jump (e.g. wizard success landing). */
  pageOverride?: number | null
  /** Row id to flash with a success tint on mount. */
  highlightRowId?: string | null
}

export function PassportRegistryTable({
  rows,
  viewKey,
  pageResetKey = "",
  pageOverride = null,
  highlightRowId = null,
}: PassportRegistryTableProps) {
  const [page, setPage] = useState(0)
  const [flashRowId, setFlashRowId] = useState<string | null>(null)
  const [flashPeak, setFlashPeak] = useState(false)

  useEffect(() => {
    setPage(0)
  }, [viewKey, pageResetKey])

  useEffect(() => {
    if (pageOverride == null || pageOverride < 0) return
    setPage(pageOverride)
  }, [pageOverride])

  useEffect(() => {
    if (!highlightRowId) return
    setFlashRowId(highlightRowId)
    setFlashPeak(true)
    const fadeTimer = window.setTimeout(() => setFlashPeak(false), 80)
    const clearTimer = window.setTimeout(() => setFlashRowId(null), 3000)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(clearTimer)
    }
  }, [highlightRowId])

  const totalPages = Math.max(1, Math.ceil(rows.length / PASSPORT_REGISTRY_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)

  const pageRows = useMemo(() => {
    const start = currentPage * PASSPORT_REGISTRY_PAGE_SIZE
    return rows.slice(start, start + PASSPORT_REGISTRY_PAGE_SIZE)
  }, [rows, currentPage])

  const rangeStart = currentPage * PASSPORT_REGISTRY_PAGE_SIZE + 1
  const rangeEnd = Math.min((currentPage + 1) * PASSPORT_REGISTRY_PAGE_SIZE, rows.length)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Serial ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Batch
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((item) => (
              <tr
                key={item.id}
                className={clsx(
                  "transition-colors duration-[2800ms] ease-out",
                  flashRowId === item.id && flashPeak && "bg-emerald-50",
                  flashRowId === item.id && !flashPeak && "bg-white",
                  flashRowId !== item.id && "hover:bg-slate-50",
                )}
              >
                <td className="px-6 py-4">
                  <code className="font-mono text-sm text-slate-900">{item.serial_id}</code>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{item.productName}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{item.batchName}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center justify-end gap-3">
                    <Link
                      href={`/dashboard/product-passports/${item.id}`}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 transition hover:text-blue-700"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/dashboard/product-passports/${item.id}/edit`}
                      className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && totalPages > 1 ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage + 1} of {totalPages} · Showing {rangeStart}–{rangeEnd} of {rows.length}
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
    </>
  )
}
