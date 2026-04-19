import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Layers } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

const primaryBtn =
  "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"

export default function PassportBatchPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Batch passport generation"
        description="Create multiple passports in a single batch for a product run."
        contextBadge="Product · Passports"
        actions={
          <Link href="/product/passports/create" className={primaryBtn}>
            Create batch
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Layers className="h-6 w-6 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Batch creation</h2>
            <p className="text-sm text-slate-600">
              Select a product, set batch size, and generate passports with unique
              serial numbers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
