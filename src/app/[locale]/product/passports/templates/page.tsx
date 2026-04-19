import { spacing } from "@/design-system/tokens"
import { FileText } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"

export default function PassportTemplatesPage() {
  return (
    <div className={spacing.pageStack}>
      <PageHeader
        title="Passport templates"
        description="Manage reusable passport templates by product category."
        contextBadge="Product · Passports"
      />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100">
          <FileText className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">Coming soon</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Save time by creating templates for common product types. Apply a template
          when creating new passports.
        </p>
      </div>
    </div>
  )
}
