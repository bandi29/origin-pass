import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { FileText } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

const outlineBtn =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
const primaryBtn =
  "inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"

export default function OwnershipRecordsPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Ownership records"
        description="View and manage product ownership registration records."
        contextBadge="Product · Ownership"
        actions={
          <>
            <button type="button" className={outlineBtn} disabled>
              Export
            </button>
            <Link href="/dashboard/customers" className={primaryBtn}>
              View customers
            </Link>
          </>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Records</h2>
            <p className="text-sm text-slate-500">
              Track who owns each product and when ownership was registered.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Link href="/dashboard/customers" className={outlineBtn}>
            Open in dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
