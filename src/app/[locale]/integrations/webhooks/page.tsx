import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { Webhook } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function IntegrationsWebhooksPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Webhooks"
        description="Event webhooks for scan and verification events."
        actions={
          <Link href="/dashboard/integrations/webhooks" className={outlineBtn}>
            Configure webhooks
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Webhook className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Webhooks</h2>
            <p className="text-sm text-slate-500">
              Configure webhook endpoints for real-time event notifications.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
