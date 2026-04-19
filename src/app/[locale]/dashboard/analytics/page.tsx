import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"

const items = [
    { href: "/dashboard/analytics/overview", label: "Overview" },
    { href: "/dashboard/analytics/scan-trends", label: "Scan Trends" },
    { href: "/dashboard/analytics/geographic-insights", label: "Geographic Insights" },
    { href: "/dashboard/analytics/product-performance", label: "Product Performance" },
]

export default function AnalyticsPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
                <p className="text-slate-500 mt-2">Brand intelligence from scan behavior and ownership activity.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                    <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 hover:bg-slate-50 transition">
                        <span className="font-medium text-slate-900">{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
