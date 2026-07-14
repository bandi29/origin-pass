import { spacing } from "@/design-system/tokens"
import { PageHeader } from "@/components/layout/PageHeader"

export default function OwnershipWarrantyPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Warranty lifecycle"
        description="Warranty activation, coverage, and lifecycle touchpoints."
        contextBadge="Product · Ownership"
      />

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Configure warranty rules and notifications from your dashboard.
      </div>
    </div>
  )
}
