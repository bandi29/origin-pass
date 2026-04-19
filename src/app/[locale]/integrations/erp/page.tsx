import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Building2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function IntegrationsErpPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="ERP"
        description="ERP and operations integrations."
        actions={
          <Link href="/dashboard/integrations/erp-integrations" className={outlineBtn}>
            ERP integrations
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ERP</h2>
            <p className="text-sm text-slate-500">
              Connect to ERP systems for batch and product data sync.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
