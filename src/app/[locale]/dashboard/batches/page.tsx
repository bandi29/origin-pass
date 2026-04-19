import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import BatchForm from "@/components/dashboard/BatchForm"
import { Layers, ExternalLink } from "lucide-react"

export default async function BatchesPage({
    searchParams,
}: {
    searchParams: Promise<{ productId?: string }>
}) {
    const { productId: initialProductId } = await searchParams
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let products: { id: string; name: string; origin?: string | null; materials?: string | null }[] = []
    let batches: { id: string; production_run_name: string | null; produced_at: string | null; created_at: string | null; product?: unknown }[] = []

    try {
        const { data } = await supabase
            .from('products')
            .select('id, name, origin, materials')
            .eq('brand_id', user.id)
            .eq('is_archived', false)
        products = data ?? []
    } catch (error) {
        console.error('Products fetch error:', error)
    }

    try {
        const { data } = await supabase
            .from('batches')
            .select('id, production_run_name, produced_at, created_at, product:products(name)')
            .eq('brand_id', user.id)
            .order('created_at', { ascending: false })
        batches = (data ?? []) as { id: string; production_run_name: string | null; produced_at: string | null; created_at: string | null; product?: unknown }[]
    } catch (error) {
        console.error('Batches fetch error:', error)
    }

    const hasProducts = products.length > 0

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Batches</h1>
                <p className="text-slate-500 mt-2">Create production batches and generate digital product passports</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-slate-400" />
                    Create New Batch
                </h2>
                {!hasProducts ? (
                    <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                        Add at least one product to your brand before creating a batch. <Link href="/dashboard/products" className="underline font-medium">Go to Products →</Link>
                    </div>
                ) : (
                    <BatchForm products={products} initialProductId={initialProductId} />
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-semibold">All Batches</h2>
                    <p className="text-sm text-slate-500 mt-1">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</p>
                </div>
                {batches.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No batches yet. Create your first batch to generate scannable product passports.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {batches.map((batch) => (
                            <Link
                                key={batch.id}
                                href={`/dashboard/batches/${batch.id}`}
                                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-slate-50 transition group"
                            >
                                <div>
                                    <div className="text-sm font-medium text-slate-800">
                                        {batch.production_run_name || 'Production batch'}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {(Array.isArray(batch.product) ? (batch.product as { name?: string }[])[0]?.name : (batch.product as { name?: string })?.name) || 'Product'} • {batch.produced_at ? new Date(batch.produced_at).toLocaleDateString() : 'Date unknown'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs text-slate-400">
                                        {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : '—'}
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
