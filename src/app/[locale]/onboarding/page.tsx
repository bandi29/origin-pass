import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"

const steps = [
    { href: "/onboarding/create-organization", title: "Create Organization" },
    { href: "/onboarding/add-brand-details", title: "Add Brand Details" },
    { href: "/onboarding/create-first-product", title: "Create First Product" },
    { href: "/onboarding/generate-first-passport", title: "Generate First Passport" },
]

export default function OnboardingPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />
            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <SimplePageBreadcrumbs
                        items={[{ label: "Home", href: "/" }, { label: "Onboarding" }]}
                    />
                    <h1 className="text-4xl font-bold text-slate-900">Onboarding</h1>
                    <p className="text-slate-600">Goal: reach your first product passport in under 2 minutes.</p>
                    <div className="grid gap-3">
                        {steps.map((step, idx) => (
                            <Link key={step.href} href={step.href} className="rounded-xl border border-slate-200 bg-white px-4 py-4 hover:bg-slate-50 transition">
                                <span className="text-xs text-slate-400 mr-3">Step {idx + 1}</span>
                                <span className="font-medium text-slate-900">{step.title}</span>
                            </Link>
                        ))}
                    </div>
                </NarrowContainer>
            </main>
            <SiteFooter />
        </div>
    )
}
