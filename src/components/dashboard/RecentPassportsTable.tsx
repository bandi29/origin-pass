"use client"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"

export type RecentPassportRow = {
  id: string
  serial_id: string
  created_at: string | null
  status?: string | null
  productName?: string
}

const PAGE_SIZE = 8

export function RecentPassportsTable({ passports }: { passports: RecentPassportRow[] }) {
  const [page, setPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(passports.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)

  const pageRows = useMemo(() => {
    const start = currentPage * PAGE_SIZE
    return passports.slice(start, start + PAGE_SIZE)
  }, [passports, currentPage])

  const rangeStart = passports.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, passports.length)

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Passports</h2>
        <Link href="/dashboard/product-passports/all-passports" className="text-sm text-slate-500 hover:text-slate-900">
          View all
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Passport ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {passports.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                  No passports yet.
                </td>
              </tr>
            ) : (
              pageRows.map((passport) => (
                <tr key={passport.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">{passport.serial_id}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{passport.productName || "—"}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      {passport.status || "active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {passport.created_at ? new Date(passport.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/verify/${passport.serial_id}`}
                      className="text-sm text-slate-700 hover:text-slate-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {passports.length > 0 && totalPages > 1 ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {currentPage + 1} of {totalPages} · Showing {rangeStart}–{rangeEnd} of {passports.length}
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
