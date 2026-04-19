import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import CategoryAwareProductForm from "@/components/dashboard/CategoryAwareProductForm"
import ProductForm from "@/components/dashboard/ProductForm"
import { Package, ChevronDown } from "lucide-react"
import { Link } from "@/i18n/navigation"

/** Stable across SSR + browser (avoids locale/timezone hydration mismatches). */
function formatProductDate(iso: string | null) {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
    })
}

export default async function ProductsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let products: { id: string; name: string; origin?: string | null; materials?: string | null; created_at: string | null }[] = []

    try {
        const { data } = await supabase
            .from('products')
            .select('id, name, origin, materials, created_at')
            .eq('brand_id', user.id)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
        products = data ?? []
    } catch (error) {
        console.error('Products fetch error:', error)
    }

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Products</h1>
                <p className="text-slate-500 mt-2">Manage your product catalog with EU DPP-aligned fields</p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Package className="w-5 h-5 text-slate-400" />
                    Add New Product
                </h2>
                <CategoryAwareProductForm />
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    <Link href="/dashboard/products/passport-wizard" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Product passport wizard</Link>
                    <Link href="/dashboard/products/import-products" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Import Products</Link>
                </div>
                <details className="mt-8 rounded-xl border border-slate-200/80 bg-slate-50/40">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
                        <span>Details</span>
                        <span className="text-xs font-normal text-slate-400">Legacy materials &amp; lifecycle form</span>
                    </summary>
                    <div className="border-t border-slate-100 px-4 pb-4 pt-2">
                        <p className="text-xs text-slate-500 mb-4">
                            Original step-by-step creator (non–category-strategy). Prefer the category form above for compliance JSONB mapping.
                        </p>
                        <ProductForm />
                    </div>
                </details>
            </div>

            {/* Divider + lighter visual weight for product list */}
            <div className="border-t border-slate-200 pt-8">
                <details className="group">
                    <summary className="cursor-pointer list-none flex items-center justify-between py-2 text-slate-600 hover:text-slate-900 transition [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-medium flex items-center gap-2">
                            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
                            Your Products
                        </span>
                        <span className="text-xs text-slate-400">{products.length} product{products.length !== 1 ? 's' : ''}</span>
                    </summary>
                    <p className="mt-2 text-xs text-slate-500">
                        Tip: each product includes 4 detail views — Product Info, Passport Template, QR Codes, and Scan History.
                    </p>
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 overflow-hidden">
                        {products.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-sm">
                                No products yet. Add your first product above.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {products.map((product) => (
                                    <div key={product.id} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-white/60 transition">
                                        <div>
                                            <Link href={`/dashboard/products/${product.id}/product-info`} className="text-sm font-medium text-slate-700 hover:text-slate-900">
                                                {product.name}
                                            </Link>
                                            <div className="text-xs text-slate-500">
                                                {[product.origin, product.materials].filter(Boolean).join(' • ') || 'No details'}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <Link href={`/dashboard/products/${product.id}/product-info`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
                                                    Product Info
                                                </Link>
                                                <Link href={`/dashboard/products/${product.id}/passport-template`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
                                                    Passport Template
                                                </Link>
                                                <Link href={`/dashboard/products/${product.id}/qr-codes`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
                                                    QR Codes
                                                </Link>
                                                <Link href={`/dashboard/products/${product.id}/scan-history`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-100">
                                                    Scan History
                                                </Link>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {formatProductDate(product.created_at)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    )
}
