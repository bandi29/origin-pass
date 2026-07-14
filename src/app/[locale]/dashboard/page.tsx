import { spacing, surfaces, typography } from "@/design-system/tokens"
import { createClient } from "@/lib/supabase/server"
import { Activity, CheckCircle2, FileCheck, QrCode, ShieldCheck } from "lucide-react"
import {
  VERIFICATION_NAV_FALLBACK_HREF,
  VERIFICATION_ROUTES,
  VERIFICATION_SUITE_NAV_VISIBLE,
} from "@/lib/verification-nav"
import { RecentPassportsTable } from "@/components/dashboard/RecentPassportsTable"
import { RecentScansTable } from "@/components/dashboard/RecentScansTable"
import { ensureBrandProfile } from "@/lib/tenancy"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { StatCard } from "@/components/ui/StatCard"
import { EmptyState } from "@/components/ui/EmptyState"
import {
  QR_IDENTITY_LEDGER_STATUS_FILTER,
  QR_IDENTITY_LOG_DIRECTORY_PATH,
} from "@/lib/qr-identity-nav"

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
    let totalProducts = 0
    let totalPassports = 0
    let totalScans = 0
    let totalActiveQr = 0
    let validScanCount = 0
    let totalVerifications = 0
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
        const [profileResult, productsResult] = await Promise.all([
            ensureBrandProfile(supabase, user).catch((error: unknown) => {
                console.error('Brand profile error:', error)
                return null
            }),
            supabase
                .from('products')
                .select('id')
                .or(`organization_id.eq.${user.id},brand_id.eq.${user.id}`),
        ])

        brandProfile = profileResult
        scopedProductIds = ((productsResult.data ?? []) as ProductIdRow[]).map((row) => row.id)
        totalProducts = scopedProductIds.length
        if (productsResult.error) {
            console.error('Scoped products lookup error:', productsResult.error)
        }
    } catch (error) {
        console.error('Dashboard bootstrap error:', error)
    }

    const productFilter = scopedProductIds.length ? scopedProductIds : [nilUuid]

    try {
        const [
            passportCountRes,
            passportIdsRes,
            activeQrRes,
            recentPassportsRes,
        ] = await Promise.all([
            supabase
                .from('passports')
                .select('id', { count: 'exact', head: true })
                .in('product_id', productFilter),
            supabase.from('passports').select('id').in('product_id', productFilter),
            supabase
                .from("qr_identities")
                .select("id", { count: "exact", head: true })
                .in("product_id", productFilter)
                .eq("activation_status", "active"),
            supabase
                .from('passports')
                .select(`
                id,
                serial_number,
                status,
                created_at,
                product:products(name)
            `)
                .in('product_id', productFilter)
                .order('created_at', { ascending: false })
                .limit(100),
        ])

        totalPassports = passportCountRes.count ?? 0
        if (!totalPassports) {
            const { count: legacyCount } = await supabase
                .from('items')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', user.id)
            totalPassports = legacyCount ?? 0
        }

        scopedPassportIds = (passportIdsRes.data ?? []).map((row) => row.id)
        totalActiveQr = activeQrRes.count ?? 0

        recentPassports = ((recentPassportsRes.data ?? []) as PassportRow[]).map((row) => ({
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
                .limit(100)
            recentPassports = ((legacyData ?? []) as LegacyPassportRow[]).map((row) => ({
                id: row.id,
                serial_id: row.serial_id,
                created_at: row.created_at,
                status: 'active',
                productName: Array.isArray(row.batch?.product) ? row.batch.product[0]?.name : row.batch?.product?.name,
            }))
        }
    } catch (error) {
        console.error('Passport and QR aggregation error:', error)
    }

    const passportFilter = scopedPassportIds.length ? scopedPassportIds : [nilUuid]

    try {
        const [scanCountRes, recentScansRes, verificationsRes, validScanRes] = await Promise.all([
            supabase
                .from('passport_scans')
                .select('id', { count: 'exact', head: true })
                .in('passport_id', passportFilter),
            supabase
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
                .in('passport_id', passportFilter)
                .order('created_at', { ascending: false })
                .limit(100),
            supabase
                .from('verifications')
                .select('id', { count: 'exact', head: true })
                .in('passport_id', passportFilter),
            supabase
                .from("passport_scans")
                .select("id", { count: "exact", head: true })
                .in("passport_id", passportFilter)
                .eq("scan_result", "valid"),
        ])

        totalScans = scanCountRes.count ?? 0
        if (!totalScans) {
            const { count: legacyCount } = await supabase
                .from('usage_logs')
                .select('id', { count: 'exact', head: true })
                .eq('brand_id', user.id)
                .eq('event_type', 'scan')
            totalScans = legacyCount ?? 0
        }

        recentScanEvents = ((recentScansRes.data ?? []) as ScanRow[]).map((row) => ({
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
                .limit(100)
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

        totalVerifications = verificationsRes.count ?? 0
        validScanCount = validScanRes.count ?? 0
    } catch (error) {
        console.error('Scan and verification aggregation error:', error)
    }

    const verificationRate =
        totalScans > 0 ? `${Math.round((validScanCount / totalScans) * 100)}%` : "—"

    const onboardingSteps = [
        "Create Product",
        "Generate Passport",
        "Generate QR",
        "Print Label",
        "Scan & Verify Product",
    ]

    return (
        <div className={spacing.pageStack}>
            {/* Hero — uses the heroDark surface token + Button onDark variants so
                every CTA has the same translucent treatment instead of 5 hand-rolled
                white/10 backgrounds with subtly-different border opacities. */}
            <section className={`${surfaces.heroDark} p-6 md:p-8`}>
                <h1 className={`${typography.pageTitle} text-white`}>Dashboard</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">
                    Welcome back, {brandProfile?.brand_name || "Brand Owner"}. Focus on the core trust workflow:
                    create product → passport → QR → print → verify.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                    <Button href="/dashboard/products" variant="onDarkPrimary" size="sm">
                        Create Product
                    </Button>
                    <Button href="/dashboard/product-passports/create" variant="onDark" size="sm">
                        Generate Passport
                    </Button>
                    <Button href={QR_IDENTITY_LOG_DIRECTORY_PATH} variant="onDark" size="sm">
                        View QR Identity
                    </Button>
                    <Button href="/dashboard/qr-identity/print" variant="onDark" size="sm">
                        Print Label
                    </Button>
                    <Button
                      href={
                        VERIFICATION_SUITE_NAV_VISIBLE
                          ? VERIFICATION_ROUTES.overview
                          : VERIFICATION_NAV_FALLBACK_HREF
                      }
                      variant="onDark"
                      size="sm"
                    >
                      Verify Product
                    </Button>
                </div>
            </section>

            {/* KPI grid — five StatCards with a single shared rhythm: same number
                weight, same icon-chip size, same hover-lift on the Card primitive. */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard
                    label="Products Created"
                    icon={<FileCheck />}
                    tone="indigo"
                    value={totalProducts.toLocaleString()}
                />
                <StatCard
                    label="Passports Generated"
                    icon={<ShieldCheck />}
                    tone="violet"
                    value={totalPassports.toLocaleString()}
                    href="/dashboard/product-passports"
                />
                <StatCard
                    label="QR Identities Active"
                    icon={<QrCode />}
                    tone="emerald"
                    value={totalActiveQr.toLocaleString()}
                    href={QR_IDENTITY_LEDGER_STATUS_FILTER.active}
                />
                <StatCard
                    label="Recent Scans"
                    icon={<Activity />}
                    tone="navy"
                    value={totalScans.toLocaleString()}
                    href={QR_IDENTITY_LOG_DIRECTORY_PATH}
                />
                <StatCard
                    label="Verification Success"
                    icon={<CheckCircle2 />}
                    tone="emerald"
                    value={verificationRate}
                />
            </div>

            <section className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Onboarding Checklist</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Complete these steps to launch your first trusted product flow.
                    </p>
                    <ol className="mt-4 space-y-2 text-sm">
                        {onboardingSteps.map((step, idx) => (
                            <li
                                key={step}
                                className="flex items-center gap-3 rounded-lg border border-ds-border bg-canvas px-3 py-2 text-slate-700"
                            >
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 ring-1 ring-ds-border">
                                    {idx + 1}
                                </span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </Card>
                <Card>
                    <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Latest passport and verification activity in your workspace.
                    </p>
                    {recentScanEvents.length === 0 ? (
                        <EmptyState
                            className="mt-4 py-10"
                            icon={<Activity className="h-6 w-6" aria-hidden />}
                            title="No activity yet"
                            description="Start with product creation to begin your trust workflow."
                            action={{ label: "Create your first product", href: "/dashboard/products" }}
                        />
                    ) : (
                        <div className="mt-4 space-y-2">
                            {recentScanEvents.slice(0, 5).map((scan) => (
                                <div
                                    key={scan.id}
                                    className="rounded-lg border border-ds-border bg-canvas px-3 py-2"
                                >
                                    <p className="text-sm text-slate-800">
                                        {scan.passport_serial
                                            ? `Scan on ${scan.passport_serial}`
                                            : "Scan activity recorded"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {scan.created_at ? new Date(scan.created_at).toLocaleString() : "—"}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </section>

            <details className="group rounded-2xl border border-ds-border bg-white p-6 shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-700">
                    <span>Advanced Insights (Enterprise)</span>
                    <span className="text-xs font-normal text-slate-400 group-open:hidden">Expand</span>
                </summary>
                <div className="mt-4 flex h-52 items-center justify-center rounded-xl border border-dashed border-ds-border bg-canvas text-sm text-slate-500">
                    Analytics panels and advanced monitoring remain available in Operations and Analytics.
                </div>
            </details>

            <RecentPassportsTable passports={recentPassports} />

            <RecentScansTable scans={recentScanEvents} />
        </div>
    )
}
