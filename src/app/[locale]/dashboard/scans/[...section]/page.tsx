import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"
import { Link } from "@/i18n/navigation"

const sections: Record<string, { title: string; desc: string }> = {
    "scan-history": { title: "Scan History", desc: "See recent verification events and status outcomes." },
    "scan-analytics": { title: "Scan Analytics", desc: "Analyze volume, trends, and verification performance." },
    "suspicious-scans": { title: "Suspicious Scans", desc: "Review potentially risky verification patterns." },
}

export default async function ScansSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()
    const item = sections[key]
    const tabs = [
        { href: "/dashboard/scans/scan-history", label: "Scan History", key: "scan-history" },
        { href: "/dashboard/scans/scan-analytics", label: "Scan Analytics", key: "scan-analytics" },
        { href: "/dashboard/scans/suspicious-scans", label: "Suspicious Scans", key: "suspicious-scans" },
    ]

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{item.title}</h1>
            <p className="text-slate-600">{item.desc}</p>
            <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                            key === tab.key
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Section UI placeholder.</div>
        </div>
    )
}
