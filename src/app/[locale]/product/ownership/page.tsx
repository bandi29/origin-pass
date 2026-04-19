import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { FileText, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

export default function OwnershipPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Ownership"
        description="Track post-purchase ownership and warranty journeys."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/product/ownership/records"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <FileText className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Ownership records</h2>
            <p className="text-sm text-slate-500">
              View and manage product ownership registration
            </p>
          </div>
        </Link>
        <Link
          href="/product/ownership/warranty"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <ShieldCheck className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Warranty lifecycle</h2>
            <p className="text-sm text-slate-500">
              Warranty activation and lifecycle tracking
            </p>
          </div>
        </Link>
      </div>
    </div>
  )
}
