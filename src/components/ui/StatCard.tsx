import type { ReactNode } from "react"
import { twMerge } from "tailwind-merge"
import clsx from "clsx"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { Card } from "@/components/ui/Card"
import { IconChip, type IconChipTone } from "@/components/ui/IconChip"

type Trend = {
  /** Signed percentage change, e.g. 12.5 or -3. Null = no comparison data. */
  pctChange: number | null
  /** What the comparison reads against, shown next to the delta ("vs. last 7d"). */
  label?: string
}

type Props = {
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: IconChipTone
  trend?: Trend
  /** Optional explainer under the label (above the value). */
  labelHint?: ReactNode
  /** Optional secondary line under the value, e.g. "12 active". */
  helper?: ReactNode
  /** When provided the card becomes a link and gains hover-lift. */
  href?: string
  className?: string
}

function formatPct(pct: number): string {
  const abs = Math.abs(pct)
  const digits = abs < 10 ? 1 : 0
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : ""
  return `${sign}${abs.toFixed(digits)}%`
}

/**
 * Canonical KPI / stat card. Use anywhere a "label, big number, icon-chip,
 * optional trend" pattern is needed — dashboard headers, analytics summaries,
 * settings counters.
 *
 * Replaces the 5 inline KPI implementations on `dashboard/page.tsx`, the
 * `<KpiCard>` flavour on `AnalyticsDashboardClient.tsx`, and the settings
 * tiles. One spacing scale, one number weight (`text-2xl font-semibold
 * tracking-tight`), one trend pill style, one hover-lift.
 */
export function StatCard({ label, value, icon, tone = "slate", trend, labelHint, helper, href, className }: Props) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ds-text-muted">{label}</p>
          {labelHint ? (
            <p className="mt-1 text-[11px] leading-snug text-ds-text-muted/90">{labelHint}</p>
          ) : null}
        </div>
        <IconChip tone={tone} size="md">
          {icon}
        </IconChip>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ds-text md:text-3xl">
        {value}
      </p>
      {(trend?.pctChange != null || helper) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-ds-text-muted">
          {trend?.pctChange != null && (
            <span
              className={clsx(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                trend.pctChange > 0
                  ? "bg-green-soft text-success"
                  : trend.pctChange < 0
                    ? "bg-rose-50 text-danger"
                    : "bg-slate-100 text-slate-600",
              )}
            >
              {trend.pctChange > 0 ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden />
              ) : trend.pctChange < 0 ? (
                <ArrowDownRight className="h-3 w-3" aria-hidden />
              ) : null}
              {formatPct(trend.pctChange)}
            </span>
          )}
          {trend?.label && <span className="text-ds-text-muted/80">{trend.label}</span>}
          {helper && <span className="text-ds-text-muted/80">{helper}</span>}
        </div>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={twMerge("block no-underline", className)}>
        <Card interactive padding>
          {content}
        </Card>
      </Link>
    )
  }

  return (
    <Card padding className={className}>
      {content}
    </Card>
  )
}
