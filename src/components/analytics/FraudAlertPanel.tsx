"use client"

import { ShieldAlert, MapPin, Calendar } from "lucide-react"
import type { FraudAlert } from "@/backend/modules/analytics/dashboard"

type FraudAlertPanelProps = {
  alerts: FraudAlert[]
  loading?: boolean
}

function formatDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function FraudAlertPanel({ alerts, loading }: FraudAlertPanelProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
        <ShieldAlert className="h-4 w-4" />
        Fraud & suspicious activity
      </h3>
      <p className="mt-1 text-xs text-amber-700">
        High-risk scans and unusual patterns requiring review.
      </p>
      {loading ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-amber-100/50" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-white/70 py-6 text-center text-sm text-amber-800">
          No suspicious activity in this period
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{a.productName}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-600">{a.serialNumber}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.riskScore >= 70 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  Risk {a.riskScore}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(a.scanTimestamp)}
                </span>
                {a.locationCountry && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {a.locationCountry}
                  </span>
                )}
              </div>
              {a.reason && (
                <p className="mt-1.5 text-xs text-amber-700">{a.reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
