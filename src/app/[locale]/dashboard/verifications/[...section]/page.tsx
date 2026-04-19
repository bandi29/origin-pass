import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "pending-verifications": "Review verification requests that need manual action.",
    approved: "View approved verification decisions.",
    rejected: "Review rejected verification requests and reasons.",
    "fraud-detection": "Monitor verification anomalies and fraud detection alerts.",
}

const tabs = [
    { href: "/dashboard/verifications/pending-verifications", key: "pending-verifications", label: "Pending Verifications" },
    { href: "/dashboard/verifications/approved", key: "approved", label: "Approved" },
    { href: "/dashboard/verifications/rejected", key: "rejected", label: "Rejected" },
    { href: "/dashboard/verifications/fraud-detection", key: "fraud-detection", label: "Fraud Detection" },
]

export default async function VerificationSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{tabs.find((t) => t.key === key)?.label ?? "Verifications"}</h1>
            <p className="text-slate-600">{sections[key]}</p>
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Verification module placeholder.</div>
        </div>
    )
}
