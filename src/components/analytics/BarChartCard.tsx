"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

const STATUS_COLORS: Record<string, string> = {
  valid: "#10b981",
  suspicious: "#f59e0b",
  fraud: "#ef4444",
  duplicate: "#94a3b8",
  invalid: "#64748b",
}

type BarChartCardProps = {
  title: string
  data: Array<{ status: string; count: number }>
  loading?: boolean
}

export function BarChartCard({ title, data, loading }: BarChartCardProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.status.charAt(0).toUpperCase() + d.status.slice(1),
  }))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {loading ? (
        <div className="mt-4 h-56 animate-pulse rounded-lg bg-slate-100" />
      ) : formatted.length === 0 ? (
        <div className="mt-4 flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
          No data for this period
        </div>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {formatted.map((entry, i) => (
                  <Cell
                    key={entry.status}
                    fill={STATUS_COLORS[entry.status] ?? "#94a3b8"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
