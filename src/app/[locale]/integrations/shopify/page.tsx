import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { ShoppingBag } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const outlineBtn =
  "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"

export default function IntegrationsShopifyPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Shopify"
        description="Connect OriginPass to your Shopify store."
        actions={
          <Link href="/dashboard/integrations/shopify-plugin" className={outlineBtn}>
            Shopify plugin
          </Link>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <ShoppingBag className="h-8 w-8 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Shopify</h2>
            <p className="text-sm text-slate-500">
              Install the OriginPass app for Shopify to sync products and display
              verification on product pages.
            </p>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}
