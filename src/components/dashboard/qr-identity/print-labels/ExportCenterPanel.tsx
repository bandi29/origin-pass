"use client"

import clsx from "clsx"

type ExportCenterPanelProps = {
  selectedCount: number
  exportFormat: string
  isSubmitting?: boolean
  latestJobStatus?: string | null
}

const STATUS_ROWS = [
  { key: "format", label: "Export format" },
  { key: "selection", label: "Selection" },
  { key: "queue", label: "Queue" },
  { key: "compliance", label: "Compliance" },
] as const

export function ExportCenterPanel({
  selectedCount,
  exportFormat,
  isSubmitting = false,
  latestJobStatus = null,
}: ExportCenterPanelProps) {
  const values: Record<(typeof STATUS_ROWS)[number]["key"], { value: string; hint?: string }> = {
    format: {
      value: exportFormat.toUpperCase(),
      hint: "Controlled by the sticky toolbar below",
    },
    selection: {
      value:
        selectedCount === 0
          ? "No labels selected"
          : `${selectedCount} label${selectedCount === 1 ? "" : "s"} selected`,
    },
    queue: {
      value: isSubmitting ? "Processing export…" : latestJobStatus ?? "Idle",
    },
    compliance: {
      value: "Signed URLs · immutable QR · audit logs",
    },
  }

  return (
    <article className="rounded-2xl border border-[#E7E2D7] bg-[#FCFBF8] p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#0E1B2A]">Export center</h2>
      <p className="mt-0.5 text-xs text-[#6B7079]">Live status for your label export pipeline.</p>
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
        {STATUS_ROWS.map(({ key, label }) => {
          const row = values[key]
          return (
            <li key={key} className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
              <div className="min-w-0 text-right">
                <p
                  className={clsx(
                    "text-sm font-medium text-slate-900",
                    key === "queue" && isSubmitting && "text-brand",
                  )}
                >
                  {row.value}
                </p>
                {row.hint ? <p className="mt-0.5 text-[11px] text-slate-500">{row.hint}</p> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
