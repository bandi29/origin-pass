import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Key, Webhook, ShoppingBag, Building2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function IntegrationsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Integrations"
        description="Connect OriginPass to your commerce and operations stack."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/integrations/api"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Key className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">API</h2>
            <p className="text-sm text-slate-500">API keys and docs</p>
          </div>
        </Link>
        <Link
          href="/integrations/webhooks"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Webhook className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Webhooks</h2>
            <p className="text-sm text-slate-500">Event webhooks</p>
          </div>
        </Link>
        <Link
          href="/integrations/shopify"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <ShoppingBag className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">Shopify</h2>
            <p className="text-sm text-slate-500">Shopify plugin</p>
          </div>
        </Link>
        <Link
          href="/integrations/erp"
          className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <Building2 className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="font-semibold text-slate-900">ERP</h2>
            <p className="text-sm text-slate-500">ERP integrations</p>
          </div>
        </Link>
      </div>
    </FadeIn>
  )
}
