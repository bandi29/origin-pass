import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Key } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function IntegrationsApiPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="API"
        description="API keys and documentation."
        actions={
          <Link href="/dashboard/integrations/api-keys" className={outlineBtn}>
            API keys
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Key className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">API</h2>
            <p className="text-sm text-slate-500">
              Manage API keys and access the REST API documentation.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
