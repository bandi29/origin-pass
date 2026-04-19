import { spacing } from "@/design-system/tokens"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"

export default function InsightsPublicPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />
            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <h1 className="text-4xl font-bold text-slate-900">Blog / Insights</h1>
                    <p className="text-slate-600">
                        Educational content on authenticity, product trust, EU DPP readiness, and growth playbooks for small brands.
                    </p>
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                        Content hub placeholder. Publish founder insights, customer stories, and compliance explainers here.
                    </div>
                </NarrowContainer>
            </main>
            <SiteFooter />
        </div>
    )
}
