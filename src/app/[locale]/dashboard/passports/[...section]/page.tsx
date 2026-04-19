import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    "all-passports": "Browse and manage all passports for your organization.",
    "create-passport": "Create a new passport with product and verification metadata.",
    "passport-templates": "Manage reusable passport templates by product category.",
    "passport-activity": "Review recent passport creation and update activity.",
}

export default async function PassportSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">Passports: {key.replace(/-/g, " ")}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Passports module placeholder.</div>
        </div>
    )
}
