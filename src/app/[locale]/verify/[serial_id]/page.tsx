import { createClient } from "@/lib/supabase/server"
import { getTranslations } from "next-intl/server"
import { Link } from '@/i18n/navigation';
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { CheckCircle2, Factory, MapPin, Calendar, Hammer, ShieldCheck, XCircle, AlertTriangle } from "lucide-react"
import { isValidSerialId, isSafeImageUrl } from "@/lib/security"
import { isValidVerifyToken } from "@/lib/verify-token"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { processScan } from "@/backend/modules/scans/process-scan"
import { getTotalScanCount, getFirstScanDate } from "@/backend/modules/analytics/repository"

type VerificationItem = {
    serial_id: string
    created_at: string | null
    batch: {
        production_run_name: string | null
        artisan_name: string | null
        location: string | null
        produced_at: string | null
    }
    product: {
        name: string
        story: string | null
        materials: string | null
        origin: string | null
        lifecycle: string | null
        image_url: string | null
    }
    brand: {
        brand_name: string | null
    }
}

type PublicItemScanRow = {
    serial_id: string
    production_run_name: string | null
    story: string | null
    image_url: string | null
    product_name: string | null
    brand_name: string | null
}

// Enable ISR
export const revalidate = 3600 // Cache for 1 hour

export default async function VerifyPage({ params }: { params: Promise<{ serial_id: string, locale: string }> }) {
    const { serial_id, locale } = await params
    const t = await getTranslations({ locale, namespace: 'Verification' });

    if (!isValidVerifyToken(serial_id) && !isValidSerialId(serial_id)) {
        return (
            <main className="min-h-screen bg-slate-50 text-slate-900">
                <NarrowContainer className="py-6">
                    <div className="mx-auto w-full max-w-md">
                        <SimplePageBreadcrumbs
                            items={[
                                { label: t('home'), href: '/' },
                                { label: t('breadcrumbVerify') },
                            ]}
                        />
                        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                                    <XCircle className="h-6 w-6 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-rose-600">{t('scanResult')}</p>
                                    <h1 className="text-xl font-semibold text-rose-900">{t('notVerifiedTitle')}</h1>
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-rose-700">{t('notVerifiedBody')}</p>
                        </div>
                    </div>
                </NarrowContainer>
            </main>
        )
    }

    const supabase = await createClient()

    // Fetch safe public fields only
    const { data: item, error } = await supabase
        .from('public_item_scan')
        .select('*')
        .eq('serial_id', serial_id)
        .single()

    const isMissing = Boolean(error || !item)
    const isDemo = !item && process.env.NODE_ENV !== 'production'

    if (error) {
        console.error("Verification error:", error.message || error.details || error.hint || JSON.stringify(error))
    }

    // MOCK DATA for preview in non-production environments
    const demoItem: VerificationItem = {
        serial_id: serial_id,
        created_at: new Date().toISOString(),
        batch: {
            production_run_name: "Autumn 2025 Run",
            artisan_name: "Elena Rossi",
            location: "Florence, Italy",
            produced_at: "2025-10-15"
        },
        product: {
            name: "Handstitched Leather Satchel",
            story: "Crafted from ethically sourced Tuscan leather, this satchel represents 40 hours of meticulous hand-stitching using traditional techniques passed down through three generations.",
            materials: "Full-grain Tuscan Vegetable Tanned Leather, Solid Brass Hardware",
            origin: "Florence, Italy",
            lifecycle: "Handcrafted to last 20+ years. Repairable hardware. Recyclable packaging.",
            image_url: null
        },
        brand: {
            brand_name: "Aurum Leatherworks"
        }
    }

    const scannedItem = item as PublicItemScanRow | null
    const displayItem: VerificationItem | null = isDemo
        ? demoItem
        : (scannedItem
            ? ({
                serial_id: scannedItem.serial_id,
                created_at: null,
                batch: {
                    production_run_name: scannedItem.production_run_name ?? null,
                    artisan_name: null,
                    location: null,
                    produced_at: null,
                },
                product: {
                    name: scannedItem.product_name ?? 'Product',
                    story: scannedItem.story ?? null,
                    materials: null,
                    origin: null,
                    lifecycle: null,
                    image_url: scannedItem.image_url ?? null,
                },
                brand: {
                    brand_name: scannedItem.brand_name ?? null,
                },
            } as VerificationItem)
            : null)

    const formatDate = (value?: string | null) => {
        if (!value) return t('unknown')
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return t('unknown')
        return date.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const ctx = await buildRequestContext()

    if (!displayItem) {
        await processScan({
            serialId: serial_id,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            city: ctx.city,
            country: ctx.country,
        })
        return (
            <main className="min-h-screen bg-slate-50 text-slate-900">
                <NarrowContainer className="py-6">
                    <div className="mx-auto w-full max-w-md">
                        <SimplePageBreadcrumbs
                            items={[
                                { label: t('home'), href: '/' },
                                { label: t('breadcrumbVerify') },
                            ]}
                        />
                        <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                                    <XCircle className="h-6 w-6 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-rose-600">{t('scanResult')}</p>
                                    <h1 className="text-xl font-semibold text-rose-900">{t('notVerifiedTitle')}</h1>
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-rose-700">{t('notVerifiedBody')}</p>
                            <p className="mt-3 text-xs text-rose-600">{t('notVerifiedHelp')}</p>
                            <div className="mt-5 rounded-xl bg-white/70 px-3 py-2 text-xs text-rose-700">
                                {t('passportIdLabel')}: <span className="font-mono">{serial_id}</span>
                            </div>
                        </div>
                    </div>
                </NarrowContainer>
            </main>
        )
    }

    const scanResult = await processScan({
        serialId: serial_id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        city: ctx.city,
        country: ctx.country,
    })

    const status = scanResult.verdict === "fraud" ? "fraud" : scanResult.verdict === "suspicious" ? "suspicious" : "valid"
    const statusConfig = {
        valid: { border: "border-emerald-100", bg: "bg-white", iconBg: "bg-emerald-50", icon: CheckCircle2, iconColor: "text-emerald-600", labelColor: "text-emerald-600", title: t('verifiedTitle'), subtitle: t('verifiedSubtitle'), message: "Authenticity confirmed against brand-issued passport data." },
        suspicious: { border: "border-amber-200", bg: "bg-amber-50/30", iconBg: "bg-amber-100", icon: AlertTriangle, iconColor: "text-amber-600", labelColor: "text-amber-600", title: "Suspicious Activity", subtitle: "Unusual scan pattern detected.", message: "Please verify product authenticity. Contact the brand if concerned." },
        fraud: { border: "border-rose-200", bg: "bg-rose-50/30", iconBg: "bg-rose-100", icon: XCircle, iconColor: "text-rose-600", labelColor: "text-rose-600", title: "Potential Fraud", subtitle: "High-risk scan pattern detected.", message: "This product may be counterfeit. Report to the brand immediately." },
    }
    const config = statusConfig[status] ?? statusConfig.valid
    const StatusIcon = config.icon

    const [scanCount, firstScanDate] = scanResult.passportId
      ? await Promise.all([
          getTotalScanCount(scanResult.passportId),
          getFirstScanDate(scanResult.passportId),
        ])
      : [0, null]

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900">
            <NarrowContainer className="py-6">
                <div className="mx-auto w-full max-w-md">
                    <SimplePageBreadcrumbs
                        items={[
                            { label: t('home'), href: '/' },
                            { label: t('breadcrumbVerify') },
                        ]}
                    />

                    <div className={`mt-6 rounded-3xl border ${config.border} ${config.bg} p-6 shadow-lg`}>
                    <div className="flex items-start gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.iconBg}`}>
                            <StatusIcon className={`h-6 w-6 ${config.iconColor}`} />
                        </div>
                        <div className="flex-1">
                            <p className={`text-xs uppercase tracking-[0.2em] ${config.labelColor}`}>{t('scanResult')}</p>
                            <h1 className="text-2xl font-semibold text-slate-900">{config.title}</h1>
                            <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
                            <p className={`mt-1 text-xs ${config.labelColor}`}>{config.message}</p>
                        </div>
                        {isDemo && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                                {t('demoLabel')}
                            </span>
                        )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
                            <span>{t('brandLabel')}</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                {t('verifiedBadge')}
                            </span>
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{displayItem.brand.brand_name}</div>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <span>{t('passportIdLabel')}</span>
                            <span className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] text-slate-700 shadow-sm">
                                {displayItem.serial_id}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                            <p className="uppercase tracking-widest">{t('issuedLabel')}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatDate(displayItem.created_at)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                            <p className="uppercase tracking-widest">{t('productionDate')}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {formatDate(displayItem.batch.produced_at)}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                            <p className="uppercase tracking-widest">Scan count</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{scanCount}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                            <p className="uppercase tracking-widest">First scanned</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {firstScanDate ? formatDate(firstScanDate) : "—"}
                            </p>
                        </div>
                    </div>
                    </div>

                <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('productLabel')}</div>
                    <div className="mt-2 text-xl font-semibold text-slate-900">{displayItem.product.name}</div>
                    <div className="mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
                        {isSafeImageUrl(displayItem.product.image_url) ? (
                            <img src={displayItem.product.image_url!} alt={displayItem.product.name} className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-slate-300">
                                {t('productImage')}
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">
                        {displayItem.product.story}
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="text-amber-600"><Hammer className="h-5 w-5" /></div>
                        <div className="mt-3 text-xs uppercase tracking-widest text-slate-400">{t('artisan')}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{displayItem.batch.artisan_name}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="text-amber-600"><MapPin className="h-5 w-5" /></div>
                        <div className="mt-3 text-xs uppercase tracking-widest text-slate-400">{t('location')}</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{displayItem.batch.location}</div>
                    </div>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        <Factory className="h-4 w-4" />
                        {t('materials')}
                    </h2>
                    <p className="mt-3 text-sm text-slate-600">{displayItem.product.materials}</p>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {t('euDppAlignedFields')}
                    </h2>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-start justify-between gap-4">
                            <span className="text-xs uppercase tracking-widest text-slate-400">{t('origin')}</span>
                            <span className="text-right font-medium text-slate-900">
                                {displayItem.product.origin || displayItem.batch.location || t('unknown')}
                            </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                            <span className="text-xs uppercase tracking-widest text-slate-400">{t('lifecycle')}</span>
                            <span className="text-right text-slate-700">
                                {displayItem.product.lifecycle || t('unknown')}
                            </span>
                        </div>
                    </div>
                    <p className="mt-4 text-[11px] text-slate-400">
                        {t('dppDisclaimer')}
                    </p>
                </div>

                <div className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{t('trustTitle')}</h2>
                    <ul className="mt-3 space-y-2 text-sm text-emerald-900">
                        <li className="flex gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-700" />
                            <span>{t('trustItem1')}</span>
                        </li>
                        <li className="flex gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            <span>{t('trustItem2')}</span>
                        </li>
                        <li className="flex gap-2">
                            <Calendar className="h-4 w-4 text-emerald-700" />
                            <span>{t('trustItem3')}</span>
                        </li>
                    </ul>
                </div>

                <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Warranty and ownership</h2>
                    <p className="mt-3 text-sm text-slate-600">
                        Register ownership to activate support and keep a trusted proof-of-purchase record tied to this passport ID.
                    </p>
                    <div className="mt-4 grid gap-3">
                        <Link
                            href={`/claim/${displayItem.serial_id}`}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition"
                        >
                            Claim ownership
                        </Link>
                        <Link
                            href="/support"
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition"
                        >
                            Claim warranty support
                        </Link>
                        <Link
                            href={`/passport/${displayItem.serial_id}`}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition"
                        >
                            View full passport
                        </Link>
                        <Link
                            href="/support/contact-support"
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
                        >
                            Report issue
                        </Link>
                    </div>
                </div>

                <div className="mt-10 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white p-6 text-center shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                        Powered by OriginPass
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                        Create your own verifiable digital passport — origin, ownership, and authenticity in one scan.
                    </p>
                    <Link
                        href="/signup"
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition"
                    >
                        Create your passport
                    </Link>
                </div>

                <footer className="mt-10 text-center text-xs text-slate-400">
                    <p>{t('footer.poweredBy')}</p>
                    <p className="mt-1 opacity-60">{t('footer.tagline')}</p>
                    <p className="mt-4 text-[10px] text-slate-300 leading-normal">
                        {t('footer.disclaimer')}
                    </p>
                    {!isMissing && (
                        <p className="mt-3 text-[10px] text-slate-400">{t('scanTip')}</p>
                    )}
                </footer>
                </div>
            </NarrowContainer>
        </main>
    )
}
