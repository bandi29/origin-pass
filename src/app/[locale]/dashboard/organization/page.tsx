import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"

const sections = [
    { href: "/dashboard/organization/team-members", label: "Team Members" },
    { href: "/dashboard/organization/roles-permissions", label: "Roles & Permissions" },
    { href: "/dashboard/organization/audit-logs", label: "Audit Logs" },
    { href: "/dashboard/organization/billing", label: "Billing" },
]

export default function OrganizationPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Organization</h1>
                <p className="text-slate-500 mt-2">Manage workspace structure, access, and billing controls.</p>
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
