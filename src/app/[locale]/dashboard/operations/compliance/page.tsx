import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ShieldCheck, ArrowRight, Globe } from "lucide-react"
import { EU_DPP_COMPLIANCE_PATH } from "@/lib/verification-nav"

export default function OperationsComplianceHubPage() {
  return (
    <div className={spacing.pageStack}>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Compliance</h1>
        <p className="mt-2 text-slate-500">
          Regional compliance standards and Digital Product Passport alignment
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href={EU_DPP_COMPLIANCE_PATH}
          className="group rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">EU Digital Product Passport</h3>
              <p className="text-xs text-slate-500">European Union</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            Get ready for EU DPP requirements with structured product data and traceability.
          </p>
          <div className="inline-flex items-center gap-1 text-sm text-blue-600 transition-all group-hover:gap-2">
            View Details <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 opacity-50">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <Globe className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-700">Other Regions</h3>
              <p className="text-xs text-slate-400">Coming Soon</p>
            </div>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Support for additional regional compliance standards will be added in future updates.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">Need help with compliance?</h3>
        <p className="mb-4 text-sm text-blue-800">
          Our team can help you understand how to structure your product data to meet regulatory
          requirements.
        </p>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          Contact Support <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
