import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { FileCheck, ShieldAlert, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  VERIFICATION_ROUTES,
  VERIFICATION_SUITE_NAV_VISIBLE,
} from "@/lib/verification-nav"

export default function AuthenticityPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Authenticity"
        description="Give customers instant proof a product is genuine."
      />

      {VERIFICATION_SUITE_NAV_VISIBLE ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href={VERIFICATION_ROUTES.overview}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Authenticity overview</h2>
              <p className="text-sm text-slate-500">
                Metrics, verification status, and live scan preview
              </p>
            </div>
          </Link>
          <Link
            href={VERIFICATION_ROUTES.rules}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <FileCheck className="h-8 w-8 text-slate-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Verification rules</h2>
              <p className="text-sm text-slate-500">
                Configure verification rules and policies
              </p>
            </div>
          </Link>
          <Link
            href={VERIFICATION_ROUTES.alerts}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <ShieldAlert className="h-8 w-8 text-slate-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Counterfeit alerts</h2>
              <p className="text-sm text-slate-500">
                Monitor and respond to suspicious activity
              </p>
            </div>
          </Link>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-sm text-slate-600">
          The verification suite is temporarily unavailable in navigation. Use QR Identity for
          security verification workflows.
        </p>
      )}
    </div>
  )
}
