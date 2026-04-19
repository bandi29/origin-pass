import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Plus, Layers, Printer } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

export default function QRIdentityPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="QR identity"
        description="Attach unique QR identities to products and batches."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/product/qr-identity/generate"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Plus className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Generate codes</h2>
            <p className="text-sm text-slate-500">Create single QR codes</p>
          </div>
        </Link>
        <Link
          href="/product/qr-identity/batch"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Layers className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Batch export</h2>
            <p className="text-sm text-slate-500">Batch QR generation and export</p>
          </div>
        </Link>
        <Link
          href="/product/qr-identity/print"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Printer className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Print labels</h2>
            <p className="text-sm text-slate-500">Print-ready labels and hang tags</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
