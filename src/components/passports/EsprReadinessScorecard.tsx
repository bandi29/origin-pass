"use client"

import clsx from "clsx"
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react"
import { Link } from "@/i18n/navigation"
import type { EsprComplianceResult } from "@/lib/complianceScore"

type Props = {
  result: EsprComplianceResult
  className?: string
}

function statusCopy(status: EsprComplianceResult["status"]): {
  badge: string
  tone: string
  bar: string
  summary: string
} {
  if (status === "Compliant") {
    return {
      badge: "Ready for EU Export",
      tone: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      bar: "bg-emerald-600",
      summary: "Mandatory, GPSR, and enhanced fields look complete.",
    }
  }
  if (status === "Warning") {
    return {
      badge: "Almost ready",
      tone: "bg-amber-50 text-amber-900 ring-amber-200",
      bar: "bg-amber-500",
      summary: "Core fields are present — finish GPSR or enhanced items before EU export.",
    }
  }
  return {
    badge: "Incomplete",
    tone: "bg-rose-50 text-rose-800 ring-rose-200",
    bar: "bg-rose-500",
    summary: "Fill mandatory ESPR fields (materials, origin, GTIN/SKU) first.",
  }
}

/**
 * Dashboard ESPR / GPSR readiness scorecard with checklist + fix links.
 */
export function EsprReadinessScorecard({ result, className }: Props) {
  const copy = statusCopy(result.status)
  const score = Math.max(0, Math.min(100, result.score))

  return (
    <section
      aria-labelledby="espr-readiness-title"
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="espr-readiness-title" className="text-sm font-semibold text-slate-900">
              ESPR Compliance Score
            </h2>
            <span
              className={clsx(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                copy.tone,
              )}
            >
              {copy.badge}
            </span>
          </div>
          <p className="text-xs text-slate-500">{copy.summary}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums text-slate-900">{score}%</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {result.status}
          </p>
        </div>
      </div>

      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-label="ESPR compliance score"
      >
        <div
          className={clsx("h-full rounded-full transition-[width] duration-300", copy.bar)}
          style={{ width: `${score}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <dt className="text-slate-500">Mandatory</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {result.breakdown.mandatory}/50
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <dt className="text-slate-500">GPSR</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {result.breakdown.gpsr}/25
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <dt className="text-slate-500">Enhanced</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {result.breakdown.enhanced}/25
          </dd>
        </div>
      </dl>

      {result.missingFields.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {result.missingFields.map((field) => (
            <li
              key={field.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-slate-900">Missing {field.label}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">{field.group}</p>
                </div>
              </div>
              <Link
                href={field.href}
                className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Add now
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          All scored ESPR / GPSR fields are complete.
        </div>
      )}

      {result.completedFields.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {result.completedFields.map((label) => (
            <li key={label} className="flex items-center gap-2 text-xs text-slate-600">
              <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
