import { spacing } from "@/design-system/tokens"
import { ShoppingBag, FileSpreadsheet, Webhook } from "lucide-react"
import { Link } from "@/i18n/navigation"

export default function IntegrationsPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>
                <p className="text-slate-500 mt-2">Connect product passports to your commerce, operations, and reporting workflows.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Connection options</h2>
                <p className="text-sm text-slate-600">
                    Connect OriginPass with your storefront and operations stack.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link href="/dashboard/integrations/shopify-plugin" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Shopify Plugin</Link>
                    <Link href="/dashboard/integrations/woocommerce-plugin" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">WooCommerce Plugin</Link>
                    <Link href="/dashboard/integrations/api-keys" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">API Keys</Link>
                    <Link href="/dashboard/integrations/webhooks" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Webhooks</Link>
                    <Link href="/dashboard/integrations/erp-integrations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:col-span-2">ERP Integrations</Link>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <ShoppingBag className="w-4 h-4" />
                        E-commerce
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Connect storefront products to passport records and keep details in sync.</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <FileSpreadsheet className="w-4 h-4" />
                        Operations
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Import batches and serials via spreadsheet when launching new production runs.</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-100 p-6">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <Webhook className="w-4 h-4" />
                        API + webhooks
                    </div>
                    <p className="text-sm text-slate-500 mt-2">Send scan and ownership events into your CRM, support, or BI tooling.</p>
                </div>
            </div>

        </div>
    )
}
