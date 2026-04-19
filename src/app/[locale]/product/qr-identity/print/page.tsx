import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Printer } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function QRIdentityPrintPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Print labels"
        description="Print-ready QR code labels and hang tags."
        contextBadge="Product · QR Identity"
        actions={
          <Link href="/product/passports" className={outlineBtn}>
            View passports
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Printer className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Print</h2>
            <p className="text-sm text-slate-500">
              Download print-ready PDFs or SVG for labels and packaging.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
