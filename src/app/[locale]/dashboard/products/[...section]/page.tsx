import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"
import { Link } from "@/i18n/navigation"

const sections: Record<string, string> = {
    "create-product": "Create and validate new product records.",
    "import-products": "Bulk import product catalog data.",
}

export default async function ProductSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params

    if (section.length >= 1 && !sections[section[0]]) {
        const productId = section[0]
        const sub = section[1] ?? "product-info"
        const validSub = new Set(["product-info", "passport-template", "qr-codes", "scan-history"])
        if (!validSub.has(sub)) notFound()
        const tabs = [
            { key: "product-info", label: "Product Info" },
            { key: "passport-template", label: "Passport Template" },
            { key: "qr-codes", label: "QR Codes" },
            { key: "scan-history", label: "Scan History" },
        ]
        return (
            <div className={spacing.pageStack}>
                <h1 className="text-3xl font-bold text-slate-900">Product Details</h1>
                <p className="text-slate-600">Product: {productId}</p>
                <p className="text-sm text-slate-500">
                    Explore all product views below to manage data, passport layout, QR assets, and scan activity.
                </p>
                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.key}
                            href={`/dashboard/products/${productId}/${tab.key}`}
                            className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                sub === tab.key
                                    ? "border-slate-900 bg-slate-900 text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            {tab.label}
                        </Link>
                    ))}
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                    Subsection: {tabs.find((tab) => tab.key === sub)?.label || sub}
                </div>
            </div>
        )
    }

    const key = section[0]
    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{key.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Products module placeholder.</div>
        </div>
    )
}
