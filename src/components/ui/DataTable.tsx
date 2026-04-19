"use client"

import { useMemo, useState } from "react"
import clsx from "clsx"
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"

export type ColumnDef<T> = {
  id: string
  header: string
  accessor: (row: T) => string | number | null | undefined
  sortable?: boolean
  className?: string
}

type DataTableProps<T> = {
  columns: ColumnDef<T>[]
  data: T[]
  getRowKey: (row: T) => string
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  pageSize = 10,
  emptyTitle = "No records yet",
  emptyDescription = "There’s nothing to show here yet.",
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(
    null
  )
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.id === sort.id)
    if (!col)
      return data
    const copy = [...data]
    copy.sort((a, b) => {
      const va = col.accessor(a)
      const vb = col.accessor(b)
      const aStr = va == null ? "" : String(va)
      const bStr = vb == null ? "" : String(vb)
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true })
      return sort.dir === "asc" ? cmp : -cmp
    })
    return copy
  }, [data, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRows = useMemo(() => {
    const start = currentPage * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage, pageSize])

  function toggleSort(id: string) {
    const col = columns.find((c) => c.id === id)
    if (!col?.sortable) return
    setPage(0)
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "asc" }
      if (prev.dir === "asc") return { id, dir: "desc" }
      return null
    })
  }

  if (data.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ds-border bg-ds-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-ds-border bg-slate-50/80">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={clsx(
                    "px-4 py-3 font-medium text-ds-text",
                    col.className
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-100"
                    >
                      {col.header}
                      {sort?.id === col.id ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-4 w-4 text-ds-secondary" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-ds-secondary" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ds-border">
            {pageRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="transition-colors duration-200 hover:bg-slate-50/90"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={clsx(
                      "px-4 py-3 text-ds-text-muted",
                      col.className
                    )}
                  >
                    {col.accessor(row) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="flex flex-col gap-2 border-t border-ds-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ds-text-muted">
            Page {currentPage + 1} of {totalPages} · {sorted.length} rows
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-ds-border px-3 py-1.5 text-xs font-medium text-ds-text transition hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages - 1}
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              className="rounded-lg border border-ds-border px-3 py-1.5 text-xs font-medium text-ds-text transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
