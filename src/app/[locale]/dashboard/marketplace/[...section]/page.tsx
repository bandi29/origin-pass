import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "digital-passports": "Manage marketplace listings for digital passports.",
    nfts: "NFT-related marketplace controls and listing workflows.",
    licensing: "Configure licensing rules and permissions for digital assets.",
    royalties: "Track royalty configuration and payout-related settings.",
}

const tabs = [
    { href: "/dashboard/marketplace/digital-passports", key: "digital-passports", label: "Digital Passports" },
    { href: "/dashboard/marketplace/nfts", key: "nfts", label: "NFTs" },
    { href: "/dashboard/marketplace/licensing", key: "licensing", label: "Licensing" },
    { href: "/dashboard/marketplace/royalties", key: "royalties", label: "Royalties" },
]

export default async function MarketplaceSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">{tabs.find((t) => t.key === key)?.label ?? "Marketplace"}</h1>
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
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Marketplace module placeholder.</div>
        </div>
    )
}
