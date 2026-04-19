"use client"

import { Link } from "@/i18n/navigation"

type TopProduct = { productId: string; productName: string; scans: number }

type TopProductsTableProps = {
  data: TopProduct[]
  loading?: boolean
}

export function TopProductsTable({ data, loading }: TopProductsTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">Top products by scans</h3>
      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          No scan data for this period
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Scans</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.productId} className="border-b border-slate-100 last:border-0">
                  <td className="py-3">
                    <Link
                      href={`/dashboard/products?product=${row.productId}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {row.productName}
                    </Link>
                  </td>
                  <td className="py-3 text-right font-medium text-slate-700">
                    {row.scans}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
