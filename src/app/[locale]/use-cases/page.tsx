import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"

const useCases = [
    { href: "/use-cases/artisan-brands", title: "Artisan Brands", blurb: "Protect handcrafted value with visible authenticity and origin proof." },
    { href: "/use-cases/fashion-brands", title: "Fashion Brands", blurb: "Support transparency and trust across product collections." },
    { href: "/use-cases/cosmetics", title: "Cosmetics", blurb: "Reinforce ingredient-origin confidence and authenticity claims." },
    { href: "/use-cases/specialty-foods", title: "Specialty Foods", blurb: "Show provenance and quality with scanable product records." },
]

export default function UseCasesPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />
            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <SimplePageBreadcrumbs
                        items={[{ label: "Home", href: "/" }, { label: "Use cases" }]}
                    />
                    <h1 className="text-4xl font-bold text-slate-900">Use Cases</h1>
                    <p className="text-slate-600 max-w-2xl">Pick an industry to see how OriginPass builds trust, improves transparency, and supports authenticity verification.</p>
                    <div className="flex flex-wrap gap-2">
                        {useCases.map((item) => (
                            <Link
                                key={`pill-${item.href}`}
                                href={item.href}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                            >
                                {item.title}
                            </Link>
                        ))}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                        {useCases.map((item) => (
                            <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:bg-slate-50 transition">
                                <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                                <p className="mt-2 text-sm text-slate-600">{item.blurb}</p>
                            </Link>
                        ))}
                    </div>
                </NarrowContainer>
            </main>
            <SiteFooter />
        </div>
    )
}
