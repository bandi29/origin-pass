import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ScanLine } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function AnalyticsScansPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Scan analytics"
        description="Scan trends, volume, and verification rates."
        actions={
          <Link href="/dashboard/scans" className={outlineBtn}>
            Scan history
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ScanLine className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Scans</h2>
            <p className="text-sm text-slate-500">
              View scan history, trends over time, and verification outcomes.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
