import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ShieldCheck, FileText, CheckCircle2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"

export default function EUCompliancePage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="EU Digital Product Passport"
        description="Get ready for the EU Digital Product Passport — without enterprise complexity."
        contextBadge="Compliance"
        actions={
          <Link href="/dashboard/compliance" className={outlineBtn}>
            Compliance hub
          </Link>
        }
      />

      <p className="text-lg text-slate-600 leading-relaxed">
        EU Digital Product Passports are coming. OriginPass helps small brands start collecting
        and presenting the right product data today — in a way that&apos;s clear, structured, and
        easy to explain to customers.
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Structured product data</h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Capture materials, origin, production details, and lifecycle information in a format
            that aligns with emerging EU Digital Product Passport expectations — without needing to
            interpret regulations yourself.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <FileText className="h-6 w-6 text-blue-600" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Clear explanations for customers
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Each product passport includes a plain-language explanation of what your data
            represents, so customers understand your sourcing and production without legal jargon.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <CheckCircle2 className="h-6 w-6 text-amber-600" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            Honest and transparent by design
          </h2>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            OriginPass helps you present traceability data clearly, while making it explicit which
            claims are brand-owned and which are informational.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Important note
        </h3>
        <p className="mt-4 text-sm text-emerald-900 leading-relaxed">
          OriginPass is a traceability and product data platform. We help brands collect and present
          product information in a Digital Product Passport–aligned structure.
        </p>
        <p className="mt-3 text-sm text-emerald-900 leading-relaxed">
          We do not certify regulatory compliance or verify third-party claims. Brands remain
          responsible for their own legal and regulatory obligations.
        </p>
      </div>
    </div>
  )
}
