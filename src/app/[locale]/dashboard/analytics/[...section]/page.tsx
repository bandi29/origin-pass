import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    overview: "Executive analytics overview for scans and verification health.",
    "scan-trends": "Track scan volume over time and detect campaign impact.",
    "geographic-insights": "Analyze where customers scan your products.",
    "product-performance": "Compare scan engagement and verification outcomes by product.",
}

export default async function AnalyticsSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{key.replace("-", " ").replace(/\b\w/g, (m) => m.toUpperCase())}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Analytics module placeholder.</div>
        </div>
    )
}
