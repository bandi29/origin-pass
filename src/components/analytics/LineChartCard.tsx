"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

type DataPoint = { date: string; scans?: number; claims?: number }

type LineChartCardProps = {
  title: string
  data: DataPoint[]
  dataKey: "scans" | "claims"
  loading?: boolean
}

export function LineChartCard({ title, data, dataKey, loading }: LineChartCardProps) {
  const key = dataKey === "scans" ? "scans" : "claims"
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }))

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {loading ? (
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100" />
      ) : formatted.length === 0 ? (
        <div className="mt-4 flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500">
          No data for this period
        </div>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatted} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
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
                formatter={(value) => [value, key === "scans" ? "Scans" : "Claims"]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey={key}
                stroke="#0f172a"
                strokeWidth={2}
                dot={{ fill: "#0f172a", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
