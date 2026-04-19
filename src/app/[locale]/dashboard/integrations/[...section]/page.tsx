import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "api-keys": "Manage API keys for server-to-server integration.",
    webhooks: "Configure event webhooks for scans and ownership updates.",
    "shopify-plugin": "Install and manage the Shopify plugin integration.",
    "woocommerce-plugin": "Install and manage the WooCommerce plugin integration.",
    "erp-integrations": "Connect ERP and operations systems to passport data workflows.",
}

export default async function IntegrationsSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">Integrations: {key.replace(/-/g, " ")}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Integration module placeholder.</div>
        </div>
    )
}
