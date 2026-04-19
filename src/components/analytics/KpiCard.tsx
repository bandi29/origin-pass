"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type KpiCardProps = {
  title: string
  value: string | number
  changePercent: number | null
  icon: React.ReactNode
  loading?: boolean
}

function formatChange(change: number | null): { label: string; icon: React.ReactNode; className: string } {
  if (change == null || Number.isNaN(change)) {
    return { label: "—", icon: <Minus className="h-3.5 w-3.5" />, className: "text-slate-500" }
  }
  if (change > 0) {
    return {
      label: `+${change.toFixed(1)}%`,
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      className: "text-emerald-600",
    }
  }
  if (change < 0) {
    return {
      label: `${change.toFixed(1)}%`,
      icon: <TrendingDown className="h-3.5 w-3.5" />,
      className: "text-rose-600",
    }
  }
  return { label: "0%", icon: <Minus className="h-3.5 w-3.5" />, className: "text-slate-500" }
}

export function KpiCard({ title, value, changePercent, icon, loading }: KpiCardProps) {
  const trend = formatChange(changePercent)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-lg bg-slate-200" />
          </div>
          <div className="h-7 w-20 rounded bg-slate-200" />
          <div className="h-4 w-16 rounded bg-slate-100" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{title}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              {icon}
            </div>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
          <div className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${trend.className}`}>
            {trend.icon}
            <span>vs last period</span>
            <span>{trend.label}</span>
          </div>
        </>
      )}
    </div>
  )
}
