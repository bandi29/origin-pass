import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { CreditCard, Download, ExternalLink } from "lucide-react"

export default async function BillingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let monthlyPassports = 0
    try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

        const { count } = await supabase
            .from('items')
            .select('id', { count: 'exact', head: true })
            .eq('brand_id', user.id)
            .gte('created_at', monthStart)
            .lt('created_at', monthEnd)
        monthlyPassports = count ?? 0
    } catch (error) {
        console.error('Usage count error:', error)
    }

    const planLimit = 100
    const usagePercent = Math.min(100, Math.round((monthlyPassports / planLimit) * 100))

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Billing</h1>
                <p className="text-slate-500 mt-2">Manage your subscription and usage</p>
            </div>

            {/* Current Plan */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Current Plan</h2>
                        <p className="text-sm text-slate-500 mt-1">Starter Plan - $9/month</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                        Active
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-slate-600">Monthly Usage</span>
                            <span className="text-sm font-semibold text-slate-900">{monthlyPassports} / {planLimit}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${usagePercent}%` }} />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Link href="/pricing" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                            Upgrade Plan
                        </Link>
                        <button className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
                            Manage Subscription
                        </button>
                    </div>
                </div>
            </div>

            {/* Usage History */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-semibold">Usage History</h2>
                    <p className="text-sm text-slate-500 mt-1">Past months usage and billing</p>
                </div>
                <div className="p-8 text-center text-slate-400 text-sm">
                    No billing history yet. Usage data will appear after your first billing cycle.
                </div>
            </div>

            {/* Invoices */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">Invoices</h2>
                        <p className="text-sm text-slate-500 mt-1">Download past invoices</p>
                    </div>
                    <button className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition">
                        <Download className="w-4 h-4" />
                        Export All
                    </button>
                </div>
                <div className="p-8 text-center text-slate-400 text-sm">
                    No invoices yet. Invoices will appear after your first payment.
                </div>
            </div>
        </div>
    )
}
