import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "team-members": "Invite and manage organization team members.",
    "roles-permissions": "Define role scopes and permission boundaries.",
    "audit-logs": "Review organization-level audit and activity records.",
    billing: "Manage organization plan, billing, and invoices.",
}

const tabs = [
    { href: "/dashboard/organization/team-members", key: "team-members", label: "Team Members" },
    { href: "/dashboard/organization/roles-permissions", key: "roles-permissions", label: "Roles & Permissions" },
    { href: "/dashboard/organization/audit-logs", key: "audit-logs", label: "Audit Logs" },
    { href: "/dashboard/organization/billing", key: "billing", label: "Billing" },
]

export default async function OrganizationSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{tabs.find((t) => t.key === key)?.label ?? "Organization"}</h1>
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Organization module placeholder.</div>
        </div>
    )
}
