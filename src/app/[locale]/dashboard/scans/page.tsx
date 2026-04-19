import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"

const scanSections = [
    { href: "/dashboard/scans/scan-history", label: "Scan History" },
    { href: "/dashboard/scans/scan-analytics", label: "Scan Analytics" },
    { href: "/dashboard/scans/suspicious-scans", label: "Suspicious Scans" },
]

export default function ScansPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Authenticity Scans</h1>
                <p className="text-slate-500 mt-2">Verification activity and counterfeit risk signals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {scanSections.map((s) => (
                    <Link
                        key={`tab-${s.href}`}
                        href={s.href}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                        {s.label}
                    </Link>
                ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {scanSections.map((s) => (
                    <Link key={s.href} href={s.href} className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition">
                        <span className="font-medium text-slate-900">{s.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
