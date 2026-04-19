"use client"

import { MapPin } from "lucide-react"

type CountryCount = { country: string; count: number }

type TopCountriesCardProps = {
  data: CountryCount[]
  loading?: boolean
}

export function TopCountriesCard({ data, loading }: TopCountriesCardProps) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MapPin className="h-4 w-4" />
        Top countries
      </h3>
      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          No geographic data for this period
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((row, i) => (
            <li key={row.country} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-5 text-right text-slate-400">{i + 1}.</span>
                {row.country || "Unknown"}
              </span>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 min-w-[60px] max-w-24 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-300"
                    style={{
                      width: `${total > 0 ? (row.count / total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium text-slate-900">
                  {row.count}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
