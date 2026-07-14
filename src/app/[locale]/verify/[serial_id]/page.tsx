import { after } from "next/server"
import { fetchPublicItemScanBySerial } from "@/lib/public-item-scan-server"
import { getTranslations } from "next-intl/server"
import { Link } from '@/i18n/navigation';
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import {
    ChevronRight,
    CheckCircle2,
    MapPin,
    Calendar,
    Hammer,
    ShieldCheck,
    XCircle,
    AlertTriangle,
} from "lucide-react"
import { isValidSerialId, isSafeImageUrl } from "@/lib/security"
import { isValidVerifyToken } from "@/lib/verify-token"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { processScan } from "@/backend/modules/scans/process-scan"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import { getTotalScanCount, getFirstScanDate } from "@/backend/modules/analytics/repository"
import {
  logScanTelemetryBypassIfDev,
  shouldBypassScanTelemetry,
} from "@/lib/public-passport-consumer"
import { VerifyPassportActions } from "@/components/passports/VerifyPassportActions"

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

// Fully dynamic: the rendered verdict depends on a synchronous scan-recording call.
// Static parts (story, product image) will be moved into a separately-cached child
// server component when a passport-tag invalidation hook is in place.
export const dynamic = "force-dynamic"

type JourneyCoordinates = {
    lat: number
    lng: number
    label: string
}

function resolveJourneyCoordinates(location: string | null | undefined): JourneyCoordinates | null {
    const normalized = (location || "").toLowerCase()
    if (!normalized) return null
    if (normalized.includes("florence")) return { lat: 43.7696, lng: 11.2558, label: "Florence, Italy" }
    if (normalized.includes("tuscany")) return { lat: 43.7711, lng: 11.2486, label: "Tuscany, Italy" }
    if (normalized.includes("milan")) return { lat: 45.4642, lng: 9.19, label: "Milan, Italy" }
    if (normalized.includes("rome")) return { lat: 41.9028, lng: 12.4964, label: "Rome, Italy" }
    return null
}

function formatSegmentLabel(value: string) {
    return value
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase())
}

function verifyPageBreadcrumbs(productName?: string | null, assetToken?: string | null) {
    const formattedProductName = productName?.trim()
        ? formatSegmentLabel(productName.trim())
        : "Product"
    const tokenLabel = assetToken?.trim() || "Passport"

    return [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Product Passports", href: "/dashboard/product-passports" },
        { label: formattedProductName },
        { label: tokenLabel },
    ]
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{ serial_id: string; locale: string }>
  searchParams: Promise<{ preview?: string; admin?: string }>
}) {
    const { serial_id, locale } = await params
    const sp = await searchParams
    const bypassScanTelemetry = shouldBypassScanTelemetry(sp)
    const t = await getTranslations({ locale, namespace: 'Verification' });

    if (!isValidVerifyToken(serial_id) && !isValidSerialId(serial_id)) {
        return (
            <main className="min-h-screen bg-slate-50 text-slate-900">
                <NarrowContainer className="py-6">
                    <div className="mx-auto w-full max-w-md">
                        <SimplePageBreadcrumbs items={verifyPageBreadcrumbs()} />
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

    const item = await fetchPublicItemScanBySerial(serial_id)

    const isMissing = !item
    const isDemo = !item && process.env.NODE_ENV !== 'production'

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
        if (!bypassScanTelemetry) {
            // Bot / not-found scans: defer the write so the 404-style response is fast
            // and doesn't block on writes whose result we discard anyway.
            after(async () => {
                try {
                    await processScan({
                        serialId: serial_id,
                        ipAddress: ctx.ipAddress,
                        userAgent: ctx.userAgent,
                        city: ctx.city,
                        country: ctx.country,
                    })
                } catch (err) {
                    console.warn("[verify] deferred processScan (not-found) failed:", err instanceof Error ? err.message : err)
                }
            })
        } else {
            logScanTelemetryBypassIfDev()
        }
        return (
            <main className="min-h-screen bg-slate-50 text-slate-900">
                <NarrowContainer className="py-6">
                    <div className="mx-auto w-full max-w-md">
                        <SimplePageBreadcrumbs items={verifyPageBreadcrumbs()} />
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

    let scanResult: Awaited<ReturnType<typeof processScan>>

    if (bypassScanTelemetry) {
        logScanTelemetryBypassIfDev()
        const passport = await findPassportByTokenOrSerial(serial_id)
        scanResult = {
            verdict: "verified",
            riskScore: 0,
            reason: "Admin preview mode — scan telemetry bypassed.",
            status: "valid",
            passportId: passport?.id,
        }
    } else {
        scanResult = await processScan({
            serialId: serial_id,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            city: ctx.city,
            country: ctx.country,
        })
    }

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

    const journeyCoords = resolveJourneyCoordinates(displayItem.product.origin || displayItem.batch.location)
    const mapEmbedUrl = journeyCoords
        ? `https://www.openstreetmap.org/export/embed.html?layer=mapnik&marker=${journeyCoords.lat}%2C${journeyCoords.lng}`
        : null
    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/${locale}/verify/${displayItem.serial_id}`
    const specsRows = [
        { label: "EUDR reference", value: displayItem.batch.production_run_name || `EUDR-${displayItem.serial_id.slice(0, 8).toUpperCase()}` },
        { label: "Material composition", value: displayItem.product.materials || t('unknown') },
        { label: "Repairability index", value: "8.6 / 10" },
        { label: t('origin'), value: displayItem.product.origin || displayItem.batch.location || t('unknown') },
        { label: t('productionDate'), value: formatDate(displayItem.batch.produced_at) },
        { label: "First scanned", value: firstScanDate ? formatDate(firstScanDate) : "—" },
    ]
    const useCormorantTitle = (displayItem.product.name || "").toLowerCase().includes("hand craft leather")
    const productInitials = (displayItem.product.name || displayItem.brand.brand_name || "OriginPass")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("") || "OP"
    const headerCrumbs = verifyPageBreadcrumbs(displayItem.product.name, displayItem.serial_id)

    return (
        <main className="min-h-screen bg-[#F9F8F6] text-slate-900">
            <div className="fixed inset-x-0 top-0 z-40 h-16 border-b border-slate-200 bg-white">
                <NarrowContainer className="h-full">
                    <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="w-44 shrink-0">
                                <Link
                                    href="/dashboard"
                                    className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900">
                                        <ShieldCheck className="h-3.5 w-3.5 text-white" aria-hidden />
                                    </span>
                                    <span className="hidden sm:inline">OriginPass</span>
                                </Link>
                            </div>
                            <div className="h-6 w-px shrink-0 bg-slate-300/80" aria-hidden />
                            <nav aria-label="Passport breadcrumbs" className="shrink-0">
                                <ol className="flex items-center gap-1 whitespace-nowrap text-xs md:text-sm">
                                    {headerCrumbs.map((item, index) => {
                                        const isLast = index === headerCrumbs.length - 1
                                        return (
                                            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                                                {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden /> : null}
                                                {item.href && !isLast ? (
                                                    <Link href={item.href} className="text-slate-500 transition hover:text-slate-700">
                                                        {item.label}
                                                    </Link>
                                                ) : (
                                                    <span className={isLast ? "font-semibold text-slate-800" : "text-slate-500"}>
                                                        {item.label}
                                                    </span>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ol>
                            </nav>
                        </div>
                        <VerifyPassportActions shareUrl={shareUrl} serialId={displayItem.serial_id} compact className="shrink-0 self-center" />
                    </div>
                </NarrowContainer>
            </div>

            <NarrowContainer className="py-5 pt-20 sm:py-8 sm:pt-24">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <section className={status === "valid" ? "relative flex min-h-[76px] w-full items-center overflow-hidden rounded-[30px] border border-emerald-800/15 bg-[#064e3b] px-4 py-3 shadow-sm" : `flex min-h-[76px] w-full items-center rounded-3xl border ${config.border} ${config.bg} p-4 shadow-sm`}>
                        {status === "valid" ? (
                            <>
                                <ShieldCheck className="pointer-events-none absolute -right-4 -top-5 h-24 w-24 text-white/10" aria-hidden />
                                <div className="flex items-center gap-2 text-emerald-50">
                                    <span
                                        className="inline-flex items-center gap-2 rounded-full bg-emerald-900/60 px-3 py-1 text-xs font-semibold tracking-[0.08em]"
                                        style={{ fontFamily: '"Cormorant Garamond", "Playfair Display", ui-serif, Georgia, serif' }}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                                        Verified Authentic
                                    </span>
                                    <span className="text-xs text-emerald-100/90">{displayItem.brand.brand_name || "OriginPass"} certificate</span>
                                </div>
                                <p className="mt-2 text-xs text-emerald-100/90">
                                    Issued by trusted registry · Tamper-evident verification · Forest-grade authenticity seal
                                </p>
                            </>
                        ) : (
                            <div className="flex items-start gap-3">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${config.iconBg}`}>
                                    <StatusIcon className={`h-5 w-5 ${config.iconColor}`} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-[11px] uppercase tracking-[0.2em] ${config.labelColor}`}>{t('scanResult')}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{config.title}</p>
                                    <p className={`mt-1 text-xs ${config.labelColor}`}>{config.message}</p>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
                        <div className="group relative h-72 w-full overflow-hidden bg-slate-100 sm:h-[22rem]">
                            {isSafeImageUrl(displayItem.product.image_url) ? (
                                <img
                                    src={displayItem.product.image_url!}
                                    alt={displayItem.product.name}
                                    className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.045]"
                                />
                            ) : (
                                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0E1B2A] via-[#16433A] to-[#0B2B22]">
                                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(255,255,255,0.12),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(53,107,78,0.32),transparent_52%)]" />
                                    {/* Refined certificate seal instead of an empty void */}
                                    <div className="relative flex flex-col items-center">
                                        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-white/15 bg-white/[0.06] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm sm:h-28 sm:w-28">
                                            <div className="absolute inset-1.5 rounded-full border border-dashed border-white/15" aria-hidden />
                                            <span
                                                className="text-3xl font-semibold tracking-tight text-white/90 sm:text-4xl"
                                                style={{ fontFamily: '"Cormorant Garamond", "Playfair Display", ui-serif, Georgia, serif' }}
                                            >
                                                {productInitials}
                                            </span>
                                        </div>
                                        <p className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">
                                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                                            Digital Passport
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                            <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/20 bg-white/[0.14] p-3 backdrop-blur-md sm:inset-x-5 sm:bottom-5 sm:p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1
                                        className="text-xl font-semibold text-white sm:text-2xl"
                                        style={{
                                            fontFamily: useCormorantTitle
                                                ? '"Cormorant Garamond", "Playfair Display", ui-serif, Georgia, serif'
                                                : '"Playfair Display", ui-serif, Georgia, serif',
                                        }}
                                    >
                                        {displayItem.product.name || "Heritage Leather Tote"}
                                    </h1>
                                    {status === "valid" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/95 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Verified Authentic
                                        </span>
                                    ) : status === "suspicious" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/95 px-2.5 py-1 text-xs font-semibold text-amber-800">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Authenticity under review
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/95 px-2.5 py-1 text-xs font-semibold text-rose-800">
                                            <XCircle className="h-3.5 w-3.5" />
                                            Flagged — verify with brand
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-white/90">
                                    {displayItem.brand.brand_name || "OriginPass Verified"} · {scanCount} scans recorded
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2
                            className="text-xl text-slate-900"
                            style={{ fontFamily: '"Playfair Display", ui-serif, Georgia, serif' }}
                        >
                            The Journey
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">Traceability origin for leather source and production locality.</p>
                        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            {mapEmbedUrl ? (
                                <iframe
                                    title="Journey map"
                                    src={mapEmbedUrl}
                                    className="h-44 w-full"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                                    Source coordinates unavailable for this passport.
                                </div>
                            )}
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-slate-500">Coordinates</p>
                                <p className="mt-1 font-medium">
                                    {journeyCoords ? `${journeyCoords.lat.toFixed(4)}, ${journeyCoords.lng.toFixed(4)}` : "—"}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                <p className="text-xs uppercase tracking-wide text-slate-500">{t('location')}</p>
                                <p className="mt-1 font-medium">{journeyCoords?.label || displayItem.batch.location || t('unknown')}</p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2
                            className="text-xl text-slate-900"
                            style={{ fontFamily: '"Playfair Display", ui-serif, Georgia, serif' }}
                        >
                            The Craft
                        </h2>
                        <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
                            <p>
                                <span className="font-medium text-slate-900">Artisan Story: </span>
                                {displayItem.product.story || "This piece is produced in limited runs with hand-finished details and quality-controlled materials."}
                            </p>
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                    <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                                        <Hammer className="h-3.5 w-3.5" />
                                        {t('artisan')}
                                    </p>
                                    <p className="mt-1 font-medium text-slate-900">{displayItem.batch.artisan_name || t('unknown')}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                    <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {t('productionDate')}
                                    </p>
                                    <p className="mt-1 font-medium text-slate-900">{formatDate(displayItem.batch.produced_at)}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <details>
                            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-medium text-slate-900">
                                Compliance & Transparency
                                <span className="text-xs text-slate-500">Tap to expand</span>
                            </summary>
                            <div className="mt-4 space-y-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {specsRows.map((row) => (
                                        <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">{row.label}</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900">{row.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">Scan count</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{scanCount}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">First scanned</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{firstScanDate ? formatDate(firstScanDate) : "—"}</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">{t('productionDate')}</p>
                                        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(displayItem.batch.produced_at)}</p>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">{t('dppDisclaimer')}</p>
                            </div>
                        </details>
                    </section>

                    <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
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
                                <MapPin className="h-4 w-4 text-emerald-700" />
                                <span>{displayItem.product.origin || displayItem.batch.location || t('unknown')}</span>
                            </li>
                        </ul>
                    </section>

                    <div className="grid gap-3">
                        <Link
                            href={`/claim/${displayItem.serial_id}`}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition"
                        >
                            Claim ownership
                        </Link>
                        <Link
                            href="/support/contact-support"
                            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 transition"
                        >
                            Report issue
                        </Link>
                    </div>

                    <footer className="pb-2 text-center text-xs text-slate-500">
                        <p>{t('footer.poweredBy')}</p>
                        <p className="mt-1 opacity-70">{t('footer.tagline')}</p>
                        {!isMissing ? <p className="mt-2 text-[10px] text-slate-400">{t('scanTip')}</p> : null}
                    </footer>
                </div>
            </NarrowContainer>
        </main>
    )
}
