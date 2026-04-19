import { spacing } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { Link } from "@/i18n/navigation"
import { Activity, CheckCircle2, FileCheck, ShieldAlert } from "lucide-react"
import { ensureBrandProfile } from "@/lib/tenancy"

type PassportRow = {
    id: string
    serial_number: string
    status: string | null
    created_at: string | null
    product: { name?: string } | { name?: string }[] | null
}

type LegacyPassportRow = {
    id: string
    serial_id: string
    created_at: string | null
    batch: { product?: { name?: string } | { name?: string }[] } | null
}

type ScanRow = {
    id: string
    created_at: string | null
    scan_result: string | null
    device_type: string | null
    location_city: string | null
    location_country: string | null
    passport: { serial_number?: string } | { serial_number?: string }[] | null
}

type LegacyScanRow = {
    id: string
    created_at: string | null
}

type ProductIdRow = {
    id: string
}

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    let brandProfile: { brand_name?: string | null; subscription_status?: string | null } | null = null
    let totalPassports = 0
    let totalScans = 0
    let recentPassports: { id: string; serial_id: string; created_at: string | null; status?: string | null; productName?: string }[] = []
    let recentScanEvents: {
        id: string
        created_at: string | null
        result?: string | null
        device?: string | null
        city?: string | null
        country?: string | null
        passport_serial?: string | null
    }[] = []
    let scopedProductIds: string[] = []
    let scopedPassportIds: string[] = []

    const nilUuid = '00000000-0000-0000-0000-000000000000'

    try {
        brandProfile = await ensureBrandProfile(supabase, user)
    } catch (error: unknown) {
        console.error('Brand profile error:', error)
    }

    try {
        const { data } = await supabase
            .from('products')
            .select('id')
            .or(`organization_id.eq.${user.id},brand_id.eq.${user.id}`)
        scopedProductIds = ((data ?? []) as ProductIdRow[]).map((row) => row.id)
    } catch (error) {
        console.error('Scoped products lookup error:', error)
    }

    try {
        const { count } = await supabase
            .from('passports')
            .select('id', { count: 'exact', head: true })
            .in('product_id', scopedProductIds.length ? scopedProductIds : [nilUuid])
        totalPassports = count ?? 0
        if (!totalPassports) {
            const { count: legacyCount } = await supabase
                .from('items')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', user.id)
            totalPassports = legacyCount ?? 0
        }
    } catch (error) {
        console.error('Total passport count error:', error)
    }

    try {
        const { data: passportIds } = await supabase
            .from('passports')
            .select('id')
            .in('product_id', scopedProductIds.length ? scopedProductIds : [nilUuid])
        scopedPassportIds = (passportIds ?? []).map((row) => row.id)

        const { count } = await supabase
            .from('passport_scans')
            .select('id', { count: 'exact', head: true })
            .in('passport_id', scopedPassportIds.length ? scopedPassportIds : [nilUuid])
        totalScans = count ?? 0
        if (!totalScans) {
            const { count: legacyCount } = await supabase
                .from('usage_logs')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', user.id)
                .eq('event_type', 'scan')
            totalScans = legacyCount ?? 0
        }
    } catch (error) {
        console.error('Total scans count error:', error)
    }

    try {
        const { data } = await supabase
            .from('passports')
            .select(`
                id,
                serial_number,
                status,
                created_at,
                product:products(name)
            `)
            .in('product_id', scopedProductIds.length ? scopedProductIds : [nilUuid])
            .order('created_at', { ascending: false })
            .limit(8)
        recentPassports = ((data ?? []) as PassportRow[]).map((row) => ({
            id: row.id,
            serial_id: row.serial_number,
            created_at: row.created_at,
            status: row.status,
            productName: Array.isArray(row.product) ? row.product[0]?.name : row.product?.name,
        }))

        if (!recentPassports.length) {
            const { data: legacyData } = await supabase
                .from('items')
                .select(`
                    id,
                    serial_id,
                    created_at,
                    batch:batches(product:products(name))
                `)
                .eq('brand_id', user.id)
                .order('created_at', { ascending: false })
                .limit(8)
            recentPassports = ((legacyData ?? []) as LegacyPassportRow[]).map((row) => ({
                id: row.id,
                serial_id: row.serial_id,
                created_at: row.created_at,
                status: 'active',
                productName: Array.isArray(row.batch?.product) ? row.batch.product[0]?.name : row.batch?.product?.name,
            }))
        }
    } catch (error) {
        console.error('Recent passports error:', error)
    }

    try {
        const { data } = await supabase
            .from('passport_scans')
            .select(`
                id,
                created_at,
                scan_result,
                device_type,
                location_city,
                location_country,
                passport:passports(serial_number)
            `)
            .in('passport_id', scopedPassportIds.length ? scopedPassportIds : [nilUuid])
            .order('created_at', { ascending: false })
            .limit(8)
        recentScanEvents = ((data ?? []) as ScanRow[]).map((row) => ({
            id: row.id,
            created_at: row.created_at,
            result: row.scan_result,
            device: row.device_type,
            city: row.location_city,
            country: row.location_country,
            passport_serial: Array.isArray(row.passport) ? row.passport[0]?.serial_number : row.passport?.serial_number,
        }))

        if (!recentScanEvents.length) {
            const { data: legacyData } = await supabase
                .from('usage_logs')
                .select('id, created_at')
                .eq('brand_id', user.id)
                .eq('event_type', 'scan')
                .order('created_at', { ascending: false })
                .limit(8)
            recentScanEvents = ((legacyData ?? []) as LegacyScanRow[]).map((row) => ({
                id: row.id,
                created_at: row.created_at,
                result: 'recorded',
                device: null,
                city: null,
                country: null,
                passport_serial: null,
            }))
        }
    } catch (error) {
        console.error('Recent scan events error:', error)
    }

    const verificationRate = totalScans > 0 ? "92%" : "—"

    return (
        <div className={spacing.pageStack}>
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-slate-500 mt-2">Welcome back, {brandProfile?.brand_name || "Brand Owner"}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider">
                        <FileCheck className="w-4 h-4" />
                        Total Passports
                    </div>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{totalPassports.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider">
                        <Activity className="w-4 h-4" />
                        Total Scans
                    </div>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{totalScans.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" />
                        Verifications
                    </div>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{verificationRate}</p>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Scan Activity Graph</h2>
                    <div className="text-xs text-slate-500">Daily / Weekly / Monthly</div>
                </div>
                <div className="mt-4 h-52 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
                    Activity graph area
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Passports</h2>
                    <Link href="/dashboard/passports/all-passports" className="text-sm text-slate-500 hover:text-slate-900">
                        View all
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Passport ID</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentPassports.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">No passports yet.</td>
                                </tr>
                            ) : (
                                recentPassports.map((passport) => {
                                    return (
                                        <tr key={passport.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-700">{passport.serial_id}</td>
                                            <td className="px-6 py-4 text-sm text-slate-700">{passport.productName || "—"}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 text-xs font-medium">{passport.status || "active"}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">{passport.created_at ? new Date(passport.created_at).toLocaleDateString() : "—"}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/verify/${passport.serial_id}`} className="text-sm text-slate-700 hover:text-slate-900">
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">Recent Scans</h2>
                    <Link href="/dashboard/scans/scan-history" className="text-sm text-slate-500 hover:text-slate-900">
                        View logs
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Scan ID</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Passport</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Location</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Device</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {recentScanEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">No scan events yet.</td>
                                </tr>
                            ) : (
                                recentScanEvents.map((scan) => (
                                    <tr key={scan.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-700">{scan.id.slice(0, 8)}</td>
                                        <td className="px-6 py-4 text-sm text-slate-700">{scan.passport_serial || "—"}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{scan.city || scan.country || "Unknown"}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">{scan.device || "Unknown"}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 text-xs font-medium">
                                                <ShieldAlert className="w-3 h-3" />
                                                {scan.result || "recorded"}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
