import { spacing } from "@/design-system/tokens"
import { PageHeader } from "@/components/layout/PageHeader"

export default function OwnershipTransferPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Ownership transfer"
        description="Plan and document ownership transfers with a clear audit trail."
        contextBadge="Product · Ownership"
      />

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Transfer workflows connect to your dashboard when enabled for your organization.
      </div>
    </div>
  )
}
