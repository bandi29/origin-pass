import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"

const sections = [
    { href: "/dashboard/marketplace/digital-passports", label: "Digital Passports" },
    { href: "/dashboard/marketplace/nfts", label: "NFTs" },
    { href: "/dashboard/marketplace/licensing", label: "Licensing" },
    { href: "/dashboard/marketplace/royalties", label: "Royalties" },
]

export default function MarketplacePage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Marketplace</h1>
                <p className="text-slate-500 mt-2">Explore monetization and commerce modules around digital product assets.</p>
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
