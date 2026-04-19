"use client"

import { Calendar } from "lucide-react"
import type { DateRangePreset } from "@/backend/modules/analytics/dashboard"

type AnalyticsFiltersProps = {
  dateRange: DateRangePreset
  onDateRangeChange: (range: DateRangePreset) => void
}

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
]

export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Calendar className="h-4 w-4" />
        <span>Period</span>
      </div>
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onDateRangeChange(p.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              dateRange === p.value
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
