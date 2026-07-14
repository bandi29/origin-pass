import { spacing } from "@/design-system/tokens"
import { BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

export default function AuthenticityReportsPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Reports"
        description="Verification and trust analytics reports."
        contextBadge="Product · Authenticity"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
            <p className="text-sm text-slate-500">
              View verification rates, scan trends, and trust metrics.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
