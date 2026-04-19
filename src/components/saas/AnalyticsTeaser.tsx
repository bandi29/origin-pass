import { Link } from "@/i18n/navigation"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { LockedFeature } from "@/components/saas/LockedFeature"
import { isFreePlan } from "@/lib/plan"

type Props = {
  /** Example headline metric */
  totalScans?: number
}

export function AnalyticsTeaser({ totalScans = 120 }: Props) {
  const locked = isFreePlan()

  const inner = (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ds-text-muted">
            Total scans
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-ds-text">
            {totalScans.toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-ds-text-muted">
            Last 30 days · sample preview
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
          <BarChart3 className="h-8 w-8" aria-hidden />
        </div>
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-ds-border bg-slate-50/80 px-4 py-6 text-center">
        <p className="text-sm text-ds-text-muted">
          Detailed breakdowns, geography, and fraud signals — on Pro.
        </p>
        <Button href="/pricing" variant="outline" size="sm" className="mt-4">
          Unlock detailed insights
        </Button>
      </div>
    </Card>
  )

  if (!locked) {
    return (
      <div>
        {inner}
        <p className="mt-2 text-center text-xs text-ds-text-muted">
          <Link href="/analytics" className="text-ds-secondary hover:underline">
            Open full analytics
          </Link>
        </p>
      </div>
    )
  }

  return <LockedFeature locked>{inner}</LockedFeature>
}
