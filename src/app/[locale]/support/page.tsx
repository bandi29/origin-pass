import { spacing } from "@/design-system/tokens"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { Mail, MessageCircle, HelpCircle, Printer, FileEdit, CreditCard } from "lucide-react"
import { Link } from "@/i18n/navigation"

export default function SupportPage() {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <SiteHeader />

            <main className={`flex-1 ${spacing.main}`}>
                <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
                    <SimplePageBreadcrumbs
                        items={[{ label: "Home", href: "/" }, { label: "Support" }]}
                    />
                    <div className="text-center mb-16 space-y-4">
                        <h1 className="text-4xl font-bold text-slate-900">Studio Support</h1>
                        <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                            We are here to help your brand succeed. Whether it&apos;s technical issues or compliance questions, our team is ready.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                            <Link href="/support/help-center" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Help Center</Link>
                            <Link href="/support/contact-support" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Contact Support</Link>
                            <Link href="/support/system-status" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">System Status</Link>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                    {/* Contact Form */}
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-slate-400" /> Send us a message
                        </h2>
                        <p className="text-xs text-slate-500 mb-4">
                            <span className="text-rose-500">*</span> Required fields
                        </p>

                        <form className={spacing.stackDense}>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Name <span className="text-rose-500">*</span></label>
                                    <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none" placeholder="Your Name" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Brand Name <span className="text-rose-500">*</span></label>
                                    <input type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none" placeholder="Brand Studio" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Issue Type <span className="text-rose-500">*</span></label>
                                <select className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none">
                                    <option>Technical Issue</option>
                                    <option>Billing Question</option>
                                    <option>Compliance Inquiry</option>
                                    <option>Other</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Message <span className="text-rose-500">*</span></label>
                                <textarea rows={4} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none" placeholder="Tell us how we can help..." />
                            </div>

                            <a
                                href="mailto:support@originpass.com?subject=OriginPass%20Support%20Request"
                                className="w-full inline-flex items-center justify-center bg-slate-900 text-white font-medium py-3 rounded-xl hover:bg-slate-800 transition"
                            >
                                Email support@originpass.com
                            </a>
                            <p className="text-xs text-slate-500 text-center">
                                Faster help: include product/batch ID and a screenshot.
                            </p>
                        </form>
                    </div>

                    {/* Quick Info Sidebar */}
                    <div className={spacing.pageStack}>
                        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <MessageCircle className="w-5 h-5" /> Live Chat
                            </h3>
                            <p className="text-slate-300 text-sm mb-6">
                                Available Mon-Fri, 9am - 6pm CET for Premium Plan users.
                            </p>
                            <button className="w-full bg-white text-slate-900 font-medium py-2 rounded-lg hover:bg-slate-100 transition text-sm">
                                Start Chat
                            </button>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-6">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Printer className="w-4 h-4 text-slate-500" /> Hardware Guide
                            </h3>
                            <p className="text-slate-500 text-sm mb-4">
                                reliable thermal printers for artisan labels:
                            </p>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Rollo Wireless
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Brother QL-820NWB
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Dymo 4XL
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* FAQ Section */}
                    <div className="max-w-3xl mx-auto">
                    <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center flex items-center justify-center gap-2">
                        <HelpCircle className="w-6 h-6 text-slate-400" /> Frequently Asked Questions
                    </h2>

                    <div className="space-y-4">
                        <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <summary className="flex items-center justify-between p-6 cursor-pointer font-medium text-slate-900 hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    <CreditCard className="w-5 h-5 text-slate-400" />
                                    How much does it cost?
                                </div>
                                <span className="transform group-open:rotate-180 transition-transform text-slate-400">▼</span>
                            </summary>
                            <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                                Our simple pricing model starts at <strong>$0.10 per generated passport</strong>. There are no monthly subscription fees for the Starter plan. You only pay for what you use.
                            </div>
                        </details>

                        <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <summary className="flex items-center justify-between p-6 cursor-pointer font-medium text-slate-900 hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    <FileEdit className="w-5 h-5 text-slate-400" />
                                Can I edit a passport after it&apos;s printed?
                                </div>
                                <span className="transform group-open:rotate-180 transition-transform text-slate-400">▼</span>
                            </summary>
                            <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                                To ensure authenticity and trust, certain fields (like the Serial ID and Production Run) are immutable once generated. However, you can update &quot;soft&quot; meta-data like the Craftsmanship Story or add images to the digital record at any time.
                            </div>
                        </details>

                        <details className="group bg-white rounded-xl border border-slate-200 overflow-hidden">
                            <summary className="flex items-center justify-between p-6 cursor-pointer font-medium text-slate-900 hover:bg-slate-50 transition">
                                <div className="flex items-center gap-3">
                                    <Printer className="w-5 h-5 text-slate-400" />
                                    Do you sell tags?
                                </div>
                                <span className="transform group-open:rotate-180 transition-transform text-slate-400">▼</span>
                            </summary>
                            <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
                                Currently, we provide the digital infrastructure. We can recommend trusted partners who specialize in printing NFC and QR-enabled hang tags for luxury goods. Check our Hardware Guide for printer recommendations.
                            </div>
                        </details>
                    </div>
                    </div>

                </NarrowContainer>
            </main>

            <SiteFooter />
        </div>
    )
}
