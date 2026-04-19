import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { ShieldCheck, FileText, CheckCircle2, ArrowRight } from "lucide-react"

export default function CompliancePage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />

            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <SimplePageBreadcrumbs
                        items={[{ label: "Home", href: "/" }, { label: "Compliance" }]}
                    />
                    <section className={spacing.pageStack}>
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
                        EU Digital Product Passport
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                        Get ready for the EU Digital Product Passport — without enterprise complexity
                    </h1>
                    <p className="text-lg text-slate-600 leading-relaxed">
                        EU Digital Product Passports are coming. OriginPass helps small brands start collecting and presenting the right product data today — in a way that&apos;s clear, structured, and easy to explain to customers.
                    </p>
                </section>

                    <section className="grid gap-3 md:grid-cols-3">
                        <Link href="/compliance/eu-digital-product-passport" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                            EU Digital Product Passport
                        </Link>
                        <Link href="/compliance/sustainability-transparency" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                            Sustainability Transparency
                        </Link>
                        <Link href="/compliance/supply-chain-traceability" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                            Supply Chain Traceability
                        </Link>
                    </section>

                    <section className="grid gap-6 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <ShieldCheck className="h-6 w-6 text-emerald-600" />
                        <h2 className="mt-4 text-lg font-semibold text-slate-900">Structured product data</h2>
                        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                            Capture materials, origin, production details, and lifecycle information in a format that aligns with emerging EU Digital Product Passport expectations — without needing to interpret regulations yourself.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <FileText className="h-6 w-6 text-blue-600" />
                        <h2 className="mt-4 text-lg font-semibold text-slate-900">Clear explanations for customers</h2>
                        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                            Each product passport includes a plain-language explanation of what your data represents, so customers understand your sourcing and production without legal jargon.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                        <CheckCircle2 className="h-6 w-6 text-amber-600" />
                        <h2 className="mt-4 text-lg font-semibold text-slate-900">Honest and transparent by design</h2>
                        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                            OriginPass helps you present traceability data clearly, while making it explicit which claims are brand-owned and which are informational.
                        </p>
                    </div>
                </section>

                    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-8">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Important note
                    </h3>
                    <p className="mt-4 text-sm text-emerald-900 leading-relaxed">
                        OriginPass is a traceability and product data platform. We help brands collect and present product information in a Digital Product Passport–aligned structure.
                    </p>
                    <p className="mt-3 text-sm text-emerald-900 leading-relaxed">
                        We do not certify regulatory compliance or verify third-party claims. Brands remain responsible for their own legal and regulatory obligations.
                    </p>
                </section>

                    <div className="flex justify-end">
                        <Link href="/documentation" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                            Explore documentation <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </NarrowContainer>
            </main>

            <SiteFooter />
        </div>
    )
}
