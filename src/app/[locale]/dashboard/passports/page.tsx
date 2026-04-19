import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { ExternalLink, Search } from "lucide-react"

type SearchParams = { view?: string }

export default async function PassportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const params = await searchParams
    const viewThisMonth = params?.view === 'this-month'

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

    type ItemRow = { id: string; serial_id: string; created_at: string | null; batch?: unknown }
    let items: ItemRow[] = []

    try {
        let query = supabase
            .from('items')
            .select(`
                id,
                serial_id,
                created_at,
                batch:batches(production_run_name, product:products(name))
            `)
            .eq('brand_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100)

        if (viewThisMonth) {
            query = query.gte('created_at', monthStart).lt('created_at', monthEnd)
        }

        const { data } = await query
        items = (data ?? []) as ItemRow[]
    } catch (error) {
        console.error('Items fetch error:', error)
    }

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Passports</h1>
                <p className="text-slate-500 mt-2">
                    {viewThisMonth ? 'Passports generated this month' : 'All generated digital product passports'}
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">
                                {viewThisMonth ? 'This Month' : 'All Passports'}
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">{items.length} passport{items.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                            <Link
                                href="/dashboard/passports"
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                                    !viewThisMonth
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All
                            </Link>
                            <Link
                                href="/dashboard/passports?view=this-month"
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                                    viewThisMonth
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                This month
                            </Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400">
                        <Search className="w-4 h-4" />
                        <span className="text-xs">Search (Coming Soon)</span>
                    </div>
                </div>
                <div className="px-6 pb-4 pt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/dashboard/passports/all-passports" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">All Passports</Link>
                    <Link href="/dashboard/passports/create-passport" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Create Passport</Link>
                    <Link href="/dashboard/passports/passport-templates" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Passport Templates</Link>
                    <Link href="/dashboard/passports/passport-activity" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Passport Activity</Link>
                </div>
                {items.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No passports yet. Create a batch to generate your first passports.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-6 py-3">
                                        Serial ID
                                    </th>
                                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-6 py-3">
                                        Product
                                    </th>
                                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-6 py-3">
                                        Batch
                                    </th>
                                    <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider px-6 py-3">
                                        Created
                                    </th>
                                    <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-wider px-6 py-3">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition">
                                        <td className="px-6 py-4">
                                            <code className="text-sm font-mono text-slate-900">{item.serial_id}</code>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {(() => {
                                                const b = item.batch as { product?: { name?: string } | { name?: string }[] } | undefined
                                                const p = b?.product
                                                return (Array.isArray(p) ? p[0]?.name : p?.name) || '—'
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {(item.batch as { production_run_name?: string })?.production_run_name || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/verify/${item.serial_id}`}
                                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition"
                                            >
                                                View <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
