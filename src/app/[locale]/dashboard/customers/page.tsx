import { spacing } from "@/design-system/tokens"
import { Users, ShieldCheck, RefreshCcw, BadgeCheck } from "lucide-react"
import { Link } from "@/i18n/navigation"

export default function CustomersPage() {
    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Customers / Ownership</h1>
                <p className="text-slate-500 mt-2">
                    Track ownership registration and warranty activation for verified products.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Registered Owners</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">0</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Warranty Activations</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">0</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Ownership Transfers</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">0</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Pending Requests</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">0</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900 mb-3">What you will manage here</h2>
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                    <Link href="/dashboard/customers/registered-owners" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Registered Owners</Link>
                    <Link href="/dashboard/customers/product-ownership" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Product Ownership</Link>
                    <Link href="/dashboard/customers/warranty-registrations" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Warranty Registrations</Link>
                    <Link href="/dashboard/customers/customer-activity" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Customer Activity</Link>
                </div>
                <div className="grid gap-4 md:grid-cols-2 text-sm text-slate-600">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <Users className="w-4 h-4" />
                            Ownership registry
                        </div>
                        <p className="mt-2">
                            See who registered ownership for each product passport and when it was activated.
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <BadgeCheck className="w-4 h-4" />
                            Warranty status
                        </div>
                        <p className="mt-2">
                            Track active warranties and support claims with proof of verified authenticity.
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <RefreshCcw className="w-4 h-4" />
                            Ownership transfer
                        </div>
                        <p className="mt-2">
                            Approve secure ownership transfers for resale or gifting scenarios.
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-slate-900 font-medium">
                            <ShieldCheck className="w-4 h-4" />
                            Fraud prevention signal
                        </div>
                        <p className="mt-2">
                            Compare registrations against scan behavior to identify unusual ownership claims.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
