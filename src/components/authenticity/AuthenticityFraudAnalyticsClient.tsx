"use client"

import type { FraudAnalyticsPayload } from "@/lib/authenticity-intelligence"
import { Card } from "@/components/ui/Card"
import { StatCard } from "@/components/ui/StatCard"
import { typography } from "@/design-system/tokens"
import { AlertOctagon, ShieldAlert, ShieldCheck } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"

const chartTooltip = {
  contentStyle: {
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "12px",
  },
}

export function AuthenticityFraudAnalyticsClient({
  data,
}: {
  data: FraudAnalyticsPayload
}) {
  const lineData = data.timeSeries.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  }))

  const totalMix = data.alertMix.reduce((a, s) => a + s.value, 0)

  return (
    <div className="space-y-8">
      {/* KPI strip via shared StatCard primitive — matches the dashboard / analytics rhythm. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total alerts (30 days)"
          value={<span className="tabular-nums">{data.kpis.totalAlerts30d.toLocaleString()}</span>}
          icon={<ShieldAlert />}
          tone="amber"
        />
        <StatCard
          label="High-risk products"
          value={
            <span className="tabular-nums text-red-700">
              {data.kpis.highRiskProducts.toLocaleString()}
            </span>
          }
          icon={<AlertOctagon />}
          tone="rose"
        />
        <StatCard
          label="Suspicious share of scans"
          value={
            <span className="tabular-nums text-emerald-700">{data.kpis.suspiciousSharePct}%</span>
          }
          icon={<ShieldCheck />}
          tone="emerald"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className={typography.h3}>Suspicious activity over time</h3>
          <div className="mt-4 h-72">
            {lineData.length === 0 ? (
              <p className="py-12 text-center text-sm text-ds-text-muted">
                No suspicious scans in the last 30 days.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    {...chartTooltip}
                    formatter={(v) => [`${v ?? ""}`, "Suspicious scans"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="suspicious_count"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ fill: "#f59e0b", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <h3 className={typography.h3}>Top affected products</h3>
          <div className="mt-4 h-72">
            {data.topAffected.length === 0 ? (
              <p className="py-12 text-center text-sm text-ds-text-muted">
                No failed or suspicious scans in the last 30 days.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.topAffected}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="product_name"
                    width={120}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <Tooltip {...chartTooltip} formatter={(v) => [`${v ?? ""}`, "Events"]} />
                  <Bar dataKey="alert_count" fill="#0f172a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className={typography.h3}>Scan result mix (non-valid)</h3>
        <div className="mt-4 flex flex-col items-center gap-4 lg:flex-row lg:justify-center">
          {data.alertMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-ds-text-muted">
              No duplicate, invalid, or suspicious scans in the last 30 days.
            </p>
          ) : (
            <>
              <div className="h-64 w-full max-w-md">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.alertMix}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {data.alertMix.map((entry, i) => (
                        <Cell key={`c-${i}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-sm text-ds-text-muted space-y-2">
                {data.alertMix.map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.fill }}
                    />
                    <span className="text-ds-text">{s.name}</span>
                    <span className="tabular-nums">
                      {totalMix > 0
                        ? `${Math.round((s.value / totalMix) * 100)}%`
                        : "0%"}
                      <span className="text-ds-text-muted"> ({s.value})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
