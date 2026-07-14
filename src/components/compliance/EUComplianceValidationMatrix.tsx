"use client"

import { useEffect, useMemo, useState } from "react"
import clsx from "clsx"
import { FileSpreadsheet } from "lucide-react"
import { BulkImportModal } from "@/components/dashboard/qr-identity/BulkImportModal"
import { getTablePaginationMeta, TablePagination } from "@/components/ui/TablePagination"
import type {
  ComplianceFilterTier,
  ComplianceValidationPayload,
  ComplianceValidationRow,
} from "@/lib/compliance-validation-types"

const FILTER_OPTIONS: { id: ComplianceFilterTier; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fully_compliant", label: "Fully Compliant" },
  { id: "action_required", label: "Action Required" },
]

const DEFAULT_PAGE_SIZE = 10

function ComplianceStatusBadge({ row }: { row: ComplianceValidationRow }) {
  const isValidated = row.complianceTier === "fully_compliant"
  return (
    <span
      className={clsx(
        "inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium",
        isValidated
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {row.complianceLabel}
    </span>
  )
}

export function EUComplianceValidationMatrix({
  initialPayload,
}: {
  initialPayload: ComplianceValidationPayload
}) {
  const [filter, setFilter] = useState<ComplianceFilterTier>("all")
  const [importOpen, setImportOpen] = useState(false)
  const [rows, setRows] = useState<ComplianceValidationRow[]>(initialPayload.rows)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows
    return rows.filter((row) => row.complianceTier === filter)
  }, [filter, rows])

  const { currentPage } = useMemo(
    () => getTablePaginationMeta(page, pageSize, filteredRows.length),
    [filteredRows.length, page, pageSize],
  )

  const pageRows = useMemo(() => {
    const start = currentPage * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [currentPage, filteredRows, pageSize])

  useEffect(() => {
    setPage(0)
  }, [filter])

  useEffect(() => {
    setPage((prev) => getTablePaginationMeta(prev, pageSize, filteredRows.length).currentPage)
  }, [filteredRows.length, pageSize])

  const summary = useMemo(() => {
    const compliantCount = rows.filter((row) => row.complianceTier === "fully_compliant").length
    const actionRequiredCount = rows.filter((row) => row.complianceTier === "action_required").length
    return {
      totalCount: rows.length,
      compliantCount,
      actionRequiredCount,
    }
  }, [rows])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Compliance validation matrix
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live checks against recent passport manifests and batch import records.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {summary.compliantCount} validated · {summary.actionRequiredCount} action required
        </p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setFilter(option.id)
                setPage(0)
              }}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white hover:text-slate-900",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">No manifest records to validate yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Upload a CSV or Excel manifest to populate your EU compliance validation matrix.
            </p>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              Bulk Import (CSV)
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-600">No records match this compliance filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Product identity</th>
                  <th className="px-4 py-3">Batch ID</th>
                  <th className="px-4 py-3">Geographic origin</th>
                  <th className="px-4 py-3">Compliance status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-slate-500">{row.productSku}</span>
                        <span className="font-medium text-slate-900">{row.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">{row.batchId}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={clsx("text-slate-800", !row.originGeoValid && "text-amber-700")}>
                          {row.originGeo}
                        </span>
                        {!row.originGeoValid ? (
                          <span className="text-[11px] text-amber-700">Origin data incomplete</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <ComplianceStatusBadge row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={filteredRows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <BulkImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onQueued={() => {
          setImportOpen(false)
          window.location.reload()
        }}
      />
    </section>
  )
}
