import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { redirect, notFound } from "next/navigation"
import { Link } from "@/i18n/navigation"
import { Package, Calendar, Download, ExternalLink, BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import BatchDeactivateToggle from "@/components/dashboard/BatchDeactivateToggle"
import BatchPrintSheet from "@/components/dashboard/BatchPrintSheet"
import ComplianceExportButton from "@/components/dashboard/ComplianceExportButton"
import { CompliancePackageButton } from "@/components/dashboard/CompliancePackageButton"
import RegulatoryExportButton from "@/components/dashboard/RegulatoryExportButton"

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: batch, error } = await supabase
        .from('batches')
        .select(`
            id,
            production_run_name,
            artisan_name,
            location,
            produced_at,
            created_at,
            is_active,
            product:products(name),
            items(id, serial_id, created_at)
        `)
        .eq('id', id)
        .eq('brand_id', user.id)
        .single()

    if (error) {
        console.error('Batch fetch error:', error)
        notFound()
    }

    if (!batch) {
        notFound()
    }

    const totalCodes = batch.items?.length ?? 0
    const items = batch.items ?? []
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const codes = items.map((i) => ({ serialId: i.serial_id }))

    const productName = ((batch.product as { name?: string } | null)?.name) || 'Product'

    return (
        <div className={spacing.pageStack}>
            <PageHeader
                title={batch.production_run_name || 'Production batch'}
                description={productName}
                contextBadge="Batch"
                actions={
                    <BatchDeactivateToggle batchId={batch.id} isActive={batch.is_active ?? true} />
                }
            />

            {/* Batch Stats */}
            <div className="grid gap-6 md:grid-cols-3">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Package className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{totalCodes}</div>
                            <div className="text-xs text-slate-500">Total Codes Generated</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">—</div>
                            <div className="text-xs text-slate-500">Total Scans (Coming Soon)</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Calendar className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-slate-900">
                                {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : '—'}
                            </div>
                            <div className="text-xs text-slate-500">Date Created</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Digital Assets */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                <h2 className="text-xl font-semibold mb-6">Digital Assets</h2>
                <div className="flex flex-col gap-6">
                    <CompliancePackageButton batchId={id} />
                    <div className="flex flex-col sm:flex-row gap-4">
                        <a
                            href={`/api/batches/${id}/qr-zip`}
                            download
                            className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition gap-2 shadow-lg"
                        >
                            <Download className="w-4 h-4" />
                            Download All QR Codes (ZIP)
                        </a>
                        <BatchPrintSheet codes={codes} baseUrl={baseUrl} />
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <ComplianceExportButton batchId={id} />
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <RegulatoryExportButton batchId={id} batchName={batch.production_run_name ?? undefined} />
                    </div>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                    Print sheet optimized for A4/Letter sticker paper (3 columns)
                </p>
            </div>

            {/* Individual Log */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-semibold">Individual Codes</h2>
                    <p className="text-sm text-slate-500 mt-1">{totalCodes} passport{totalCodes !== 1 ? 's' : ''} in this batch</p>
                </div>
                {items.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                        No codes found in this batch.
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
                                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/verify/${item.serial_id}`}
                                                className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition"
                                            >
                                                View Passport <ExternalLink className="w-3 h-3" />
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
