import { spacing } from "@/design-system/tokens"
import { Activity } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

export default function PassportActivityPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Passport activity"
        description="Review recent passport creation and scan activity across your organization."
        contextBadge="Product · Passports"
      />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
          <Activity className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Coming soon</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Track passport creation, scans, and status changes in one place.
        </p>
      </div>
    </div>
  )
}
