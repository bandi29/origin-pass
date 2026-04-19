import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { BookOpen, ShieldCheck, Printer, CheckCircle2, ChevronRight, ArrowLeft, ArrowRight, Target, Megaphone, Compass, Rocket } from "lucide-react"

export default function DocumentationPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />

            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <SimplePageBreadcrumbs
                        items={[{ label: "Home", href: "/" }, { label: "Documentation" }]}
                    />
                    <div className="flex flex-col lg:flex-row gap-12">

                    {/* Sidebar / Table of Contents */}
                    <aside className={`w-full lg:w-64 flex-shrink-0 ${spacing.pageStack}`}>
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-4 px-2">Founder Playbook</h3>
                            <nav className="space-y-1">
                                <a href="#getting-started" className="block px-2 py-1.5 text-sm font-medium text-slate-900 bg-slate-100 rounded-md">Getting Started</a>
                                <Link href="/documentation/getting-started" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">Getting Started Page</Link>
                                <Link href="/documentation/api-documentation" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">API Documentation</Link>
                                <Link href="/documentation/integration-guides" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">Integration Guides</Link>
                                <a href="#segments" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">Target Segments</a>
                                <a href="#growth" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">First 100 Customers</a>
                                <a href="#mvp" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">MVP Priorities</a>
                                <a href="#positioning" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">Positioning</a>
                                <a href="#compliance" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">EU Compliance</a>
                                <a href="#printing" className="block px-2 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md">Printing Guide</a>
                            </nav>
                        </div>

                        <div className="p-4 bg-slate-900 text-white rounded-xl text-xs space-y-3 shadow-lg">
                            <p className="font-medium">Need help?</p>
                            <p className="text-slate-400">Contact our studio support team for personalized onboarding.</p>
                            <Link href="/support" className="inline-block text-white border-b border-white/20 pb-0.5 hover:border-white transition-colors">Contact Support →</Link>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <article className="flex-1 max-w-3xl space-y-16">

                        {/* Getting Started */}
                        <section id="getting-started" className="space-y-6 scroll-mt-24">
                            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                                <span>Docs</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-slate-900 font-medium">Getting Started</span>
                            </div>
                            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">OriginPass Founder Playbook</h1>
                            <p className="text-lg text-slate-600 leading-relaxed">
                                Use this guide to launch trust-focused product passports, win early customers, and validate OriginPass quickly.
                            </p>

                            <div className="grid gap-6 mt-8">
                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                                        <BookOpen className="w-24 h-24" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">1. Create a Batch</h3>
                                    <p className="text-slate-600 mb-4">Go to your Dashboard and fill out the Batch details including Artisan Name, Location, and Production Date.</p>
                                    <div className="text-sm bg-slate-50 p-3 rounded-md font-mono text-slate-500 border border-slate-100">
                                        Dashboard → New Batch
                                    </div>
                                </div>

                                <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-slate-300 transition">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition">
                                        <Rocket className="w-24 h-24" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-2">2. Launch in 3 Steps</h3>
                                    <p className="text-slate-600">Create product passport → Generate QR code → Customers scan to verify authenticity and origin instantly.</p>
                                </div>
                            </div>
                        </section>

                        <hr className="border-slate-200" />

                        <section id="segments" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg"><Target className="w-6 h-6" /></span>
                                Best Early Segments
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Premium skincare</h3>
                                    <p className="text-sm text-slate-600 mt-2">High trust and ingredient-origin sensitivity make verification a strong purchase driver.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Handmade leather goods</h3>
                                    <p className="text-sm text-slate-600 mt-2">Craftsmanship and provenance justify premium pricing and reduce copycat risk.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Sustainable fashion</h3>
                                    <p className="text-sm text-slate-600 mt-2">Customers demand transparent material and origin claims before they buy.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Artisan food and specialty beverage</h3>
                                    <p className="text-sm text-slate-600 mt-2">Origin storytelling and authenticity are core to trust and repeat purchase.</p>
                                </div>
                            </div>
                        </section>

                        <hr className="border-slate-200" />

                        <section id="growth" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg"><Megaphone className="w-6 h-6" /></span>
                                First 100 Paying Customers
                            </h2>
                            <div className="space-y-4 text-sm text-slate-700">
                                <p><strong>Week 1:</strong> Pick one vertical and one core promise: prove authenticity in one scan.</p>
                                <p><strong>Weeks 2-6:</strong> Reach out to 20-30 brands daily across Instagram, LinkedIn, Shopify directories, and craft communities.</p>
                                <p><strong>Offer:</strong> First product passport free + fast concierge setup for one product.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900 mb-2">Cold outreach template</h3>
                                    <p className="text-xs text-slate-500">Subject: Quick idea to help [Brand] prove authenticity</p>
                                    <p className="text-sm text-slate-700 mt-2">
                                        Hi [Name], I love your [product]. I built OriginPass to help small brands add a QR-based product passport so customers can verify authenticity and origin instantly. I can set up one free sample passport for your product this week.
                                    </p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900 mb-2">Early pricing</h3>
                                    <ul className="space-y-2 text-sm text-slate-700">
                                        <li><strong>Starter:</strong> $19-$39 / month</li>
                                        <li><strong>Growth:</strong> ~$79 / month</li>
                                        <li><strong>Value metric:</strong> products + monthly scans</li>
                                        <li><strong>Entry offer:</strong> first passport free</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <hr className="border-slate-200" />

                        <section id="mvp" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-amber-100 text-amber-700 p-1.5 rounded-lg"><CheckCircle2 className="w-6 h-6" /></span>
                                MVP Feature Priorities
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Must-have (V1)</h3>
                                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                        <li>Passport creation form with origin and material fields</li>
                                        <li>Unique QR generation and printable output</li>
                                        <li>Public authenticity verification page</li>
                                        <li>Basic scan analytics and timestamp history</li>
                                        <li>Simple trial-to-paid billing flow</li>
                                    </ul>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">Later (V2+)</h3>
                                    <ul className="mt-3 space-y-2 text-sm text-slate-700">
                                        <li>Ownership transfer and resale workflows</li>
                                        <li>Advanced fraud alerts and anomaly scoring</li>
                                        <li>Deep ecommerce platform sync</li>
                                        <li>Full API and partner portal</li>
                                        <li>Advanced regulatory exports</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <hr className="border-slate-200" />

                        <section id="positioning" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-cyan-100 text-cyan-700 p-1.5 rounded-lg"><Compass className="w-6 h-6" /></span>
                                Positioning Strategy
                            </h2>
                            <p className="text-slate-700">
                                Position OriginPass as a <strong>digital trust passport platform for small brands</strong>, not an enterprise traceability suite.
                            </p>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">vs Supply chain tools</h3>
                                    <p className="text-sm text-slate-600 mt-2">Lighter setup and customer-facing trust outcomes, not heavy operations software.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">vs Anti-counterfeit systems</h3>
                                    <p className="text-sm text-slate-600 mt-2">No hardware dependency and faster launch for independent brands.</p>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-5">
                                    <h3 className="font-semibold text-slate-900">vs DPP compliance suites</h3>
                                    <p className="text-sm text-slate-600 mt-2">Start simple now with EU-ready fields and scale compliance depth over time.</p>
                                </div>
                            </div>
                        </section>

                        <hr className="border-slate-200" />

                        {/* EU Compliance */}
                        <section id="compliance" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-blue-100 text-blue-700 p-1.5 rounded-lg"><ShieldCheck className="w-6 h-6" /></span>
                                EU Compliance (DPP 2026)
                            </h2>
                            <p className="text-slate-600 leading-relaxed">
                                The European Union&apos;s Digital Product Passport (DPP) regulation aims to improve product sustainability and traceability. OriginPass is designed to meet the core data requirements for textiles, leather, and artisan goods.
                            </p>
                            <ul className="space-y-3 mt-4">
                                <li className="flex gap-3 items-start">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700"><strong>Authenticity:</strong> Proof of origin and manufacturer details.</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700"><strong>Material Transparency:</strong> Disclosure of main materials (e.g., Vegetable Tanned Leather).</span>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700"><strong>Durability Info:</strong> Care instructions for product longevity (Coming Soon).</span>
                                </li>
                            </ul>
                        </section>

                        <hr className="border-slate-200" />

                        {/* Printing Guide */}
                        <section id="printing" className="space-y-6 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                <span className="bg-amber-100 text-amber-700 p-1.5 rounded-lg"><Printer className="w-6 h-6" /></span>
                                Printing Recommendations
                            </h2>
                            <p className="text-slate-600">
                                For the best scan rates and aesthetic, we recommend printing your QR codes on high-quality hang tags or sewing them into care labels.
                            </p>
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
                                <h4 className="font-semibold text-amber-900 mb-2">Recommended Dimensions</h4>
                                <ul className="list-disc list-inside text-amber-800 space-y-1 text-sm">
                                    <li>Minimum Size: 15mm x 15mm</li>
                                    <li>Quiet Zone: Ensure at least 2mm whitespace around the QR code</li>
                                    <li>Format: JPG or PNG (High Resolution)</li>
                                </ul>
                            </div>
                        </section>

                        {/* Navigation Footer */}
                        <div className="flex justify-between pt-12">
                            <Link href="/dashboard" className="group flex flex-col gap-1 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-white transition text-left w-full sm:w-auto">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 group-hover:text-slate-600"><ArrowLeft className="w-3 h-3" /> Previous</span>
                                <span className="text-slate-900 font-medium">Dashboard Overview</span>
                            </Link>

                            <Link href="/support" className="group flex flex-col gap-1 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-white transition text-right w-full sm:w-auto items-end">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 group-hover:text-slate-600">Next <ArrowRight className="w-3 h-3" /></span>
                                <span className="text-slate-900 font-medium">Studio Support</span>
                            </Link>
                        </div>
                    </article>
                    </div>
                </NarrowContainer>
            </main>

            <SiteFooter />
        </div>
    )
}
