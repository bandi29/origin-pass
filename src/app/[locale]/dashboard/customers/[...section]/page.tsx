import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "registered-owners": "View all registered product owners.",
    "product-ownership": "Track ownership state per product or passport.",
    "warranty-registrations": "Review activated warranty registrations.",
    "customer-activity": "See customer lifecycle and trust interactions.",
}

export default async function CustomersSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">Customers: {key.replace(/-/g, " ")}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Customers module placeholder.</div>
        </div>
    )
}
