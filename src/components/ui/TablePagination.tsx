"use client"

import clsx from "clsx"

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50] as const

export type TablePaginationProps = {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  className?: string
}

export function getTablePaginationMeta(
  page: number,
  pageSize: number,
  totalItems: number,
): {
  totalPages: number
  currentPage: number
  rangeStart: number
  rangeEnd: number
} {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(Math.max(0, page), totalPages - 1)
  const rangeStart = totalItems === 0 ? 0 : currentPage * pageSize + 1
  const rangeEnd = Math.min((currentPage + 1) * pageSize, totalItems)
  return { totalPages, currentPage, rangeStart, rangeEnd }
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: TablePaginationProps) {
  if (totalItems === 0) return null

  const { totalPages, currentPage, rangeStart, rangeEnd } = getTablePaginationMeta(
    page,
    pageSize,
    totalItems,
  )

  const showControls = totalPages > 1 || Boolean(onPageSizeChange)

  if (!showControls) return null

  return (
    <div
      className={clsx(
        "flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-xs text-slate-500">
        Page {currentPage + 1} of {totalPages} · Showing {rangeStart}–{rangeEnd} of{" "}
        {totalItems.toLocaleString()}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
