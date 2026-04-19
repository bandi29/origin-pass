import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

const primaryBtn =
  "inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"

export default function QRIdentityGeneratePage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Generate QR code"
        description="Create a single QR identity for a product."
        contextBadge="Product · QR Identity"
        actions={
          <Link href="/product/passports/create" className={primaryBtn}>
            Create passport
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Plus className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Generate</h2>
            <p className="text-sm text-slate-500">
              Generate a unique QR code linked to a product passport.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
