import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"

const sections = [
    { href: "/dashboard/verifications/pending-verifications", label: "Pending Verifications" },
    { href: "/dashboard/verifications/approved", label: "Approved" },
    { href: "/dashboard/verifications/rejected", label: "Rejected" },
    { href: "/dashboard/verifications/fraud-detection", label: "Fraud Detection" },
]

export default function VerificationsPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Verifications</h1>
                <p className="text-slate-500 mt-2">Manage verification decisions and fraud monitoring workflows.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {sections.map((item) => (
                    <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition">
                        <span className="font-medium text-slate-900">{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
