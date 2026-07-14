"use client"

import clsx from "clsx"
import type { PrintJobRow } from "@/lib/label-print-studio-server-data"
import {
  printJobStatusLabel,
  printJobStatusTone,
} from "@/components/dashboard/qr-identity/print-labels/layout-utils"

type PrintHistoryPanelProps = {
  jobs: PrintJobRow[]
}

export function PrintHistoryPanel({ jobs }: PrintHistoryPanelProps) {
  return (
    <article className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Print history</h2>
      <ul className="mt-3 space-y-2">
        {jobs.slice(0, 12).map((job) => (
          <li key={job.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">Template: {job.templateName}</p>
                <p className="text-xs text-slate-600">
                  {job.quantity} label{job.quantity === 1 ? "" : "s"} · {job.exportFormat.toUpperCase()} ·{" "}
                  {new Date(job.createdAt).toLocaleString()}
                </p>
              </div>
              <span
                className={clsx(
                  "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  printJobStatusTone(job.status),
                )}
              >
                {printJobStatusLabel(job.status)}
              </span>
            </div>
          </li>
        ))}
        {jobs.length === 0 ? (
          <li className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-500">
            No print history yet.
          </li>
        ) : null}
      </ul>
    </article>
  )
}
