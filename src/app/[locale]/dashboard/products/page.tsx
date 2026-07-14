import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import AddProductWorkspace from "@/components/dashboard/AddProductWorkspace"
import { Package, ChevronDown } from "lucide-react"
import { Link } from "@/i18n/navigation"
import clsx from "clsx"

export const dynamic = "force-dynamic"

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

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ focusAi?: string; imported?: string; importLogId?: string }>
}) {
    const { focusAi, imported, importLogId } = await searchParams
    const autoTriggerAiUpload = focusAi === "1"
    const showImportedLanding = imported === "1"
    const highlightImportLogId = importLogId?.trim() || null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let products: {
        id: string
        name: string
        origin?: string | null
        materials?: string | null
        created_at: string | null
        updated_at?: string | null
        import_log_id?: string | null
    }[] = []

    try {
        const { data: membership } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", user.id)
            .maybeSingle()

        const orgId = membership?.organization_id as string | null | undefined
        const visibilityOr = [`brand_id.eq.${user.id}`]
        if (orgId) visibilityOr.push(`organization_id.eq.${orgId}`)

        const { data } = await supabase
            .from('products')
            .select('id, name, origin, materials, created_at, updated_at, import_log_id')
            .or(visibilityOr.join(","))
            .eq('is_archived', false)
            .order('updated_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
        products = data ?? []
    } catch (error) {
        console.error('Products fetch error:', error)
    }

    const importedFromLatestRun = highlightImportLogId
        ? products.filter((product) => product.import_log_id === highlightImportLogId)
        : []

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
                <AddProductWorkspace autoTriggerAiUpload={autoTriggerAiUpload} />
                <div className="mt-6 border-t border-slate-100 pt-6">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Bulk</p>
                    <Link
                        href="/dashboard/products/import-products"
                        className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white"
                    >
                        Import products (CSV)
                    </Link>
                </div>
            </div>

            {/* Divider + lighter visual weight for product list */}
            <div className="border-t border-slate-200 pt-8">
                <details className="group" open={showImportedLanding || undefined}>
                    <summary className="cursor-pointer list-none flex items-center justify-between py-2 text-slate-600 hover:text-slate-900 transition [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-medium flex items-center gap-2">
                            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" />
                            Your Products
                        </span>
                        <span className="text-xs text-slate-400">{products.length} product{products.length !== 1 ? 's' : ''}</span>
                    </summary>
                    {showImportedLanding ? (
                        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
                            {importedFromLatestRun.length > 0 ? (
                                <p>
                                    <span className="font-semibold text-emerald-900">
                                        {importedFromLatestRun.length} product
                                        {importedFromLatestRun.length === 1 ? "" : "s"}
                                    </span>{" "}
                                    from your latest import {importedFromLatestRun.length === 1 ? "is" : "are"} highlighted below.
                                    {importedFromLatestRun.length < products.length
                                        ? " Existing SKUs were updated in place rather than duplicated."
                                        : null}
                                </p>
                            ) : (
                                <p>
                                    Import finished. If rows matched existing SKUs, those catalog records were updated in place.
                                    Expand the list below or search by product name.
                                </p>
                            )}
                        </div>
                    ) : null}
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
                                {products.map((product) => {
                                    const isFromLatestImport =
                                        Boolean(highlightImportLogId) &&
                                        product.import_log_id === highlightImportLogId
                                    return (
                                    <div
                                        key={product.id}
                                        className={clsx(
                                            "p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition",
                                            isFromLatestImport
                                                ? "bg-emerald-50/80 hover:bg-emerald-50"
                                                : "hover:bg-white/60",
                                        )}
                                    >
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
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </details>
            </div>
        </div>
    )
}
