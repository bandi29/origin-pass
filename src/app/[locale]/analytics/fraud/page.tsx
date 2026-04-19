import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function AnalyticsFraudPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Fraud detection"
        description="Suspicious activity and counterfeit alerts."
        actions={
          <Link href="/dashboard/verifications" className={outlineBtn}>
            Verifications
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Fraud</h2>
            <p className="text-sm text-slate-500">
              Monitor duplicate scans, geographic anomalies, and flagged passports.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
