import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"

const sections: Record<string, string> = {
    profile: "Manage account profile and personal preferences.",
    security: "Configure security, session, and access controls.",
    branding: "Customize brand visuals and presentation settings.",
    notifications: "Choose operational and verification notification preferences.",
    "developer-settings": "Configure developer access and technical preferences.",
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
    const { section } = await params
    const key = section[0]
    if (!sections[key]) notFound()

    return (
        <div className={spacing.pageStack}>
            <h1 className="text-3xl font-bold text-slate-900">Settings: {key.replace("-", " ")}</h1>
            <p className="text-slate-600">{sections[key]}</p>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Settings module placeholder.</div>
        </div>
    )
}
