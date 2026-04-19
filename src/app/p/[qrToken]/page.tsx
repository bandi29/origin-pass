import { createAdminClient } from "@/lib/supabase/admin"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { processScan } from "@/backend/modules/scans/process-scan"
import { verifyScanRedirectToken } from "@/lib/scan-redirect-token"
import { PassportPublicI18n } from "@/components/passports/PassportPublicI18n"
import {
  ShieldCheck,
  XCircle,
  MapPin,
  Calendar,
  Hammer,
  ArrowLeft,
  BadgeCheck,
  FileBadge2,
  UserRoundCheck,
} from "lucide-react"
import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { NarrowContainer } from "@/components/layout/Containers"

export const revalidate = 60

type ProductRow = {
  name: string
  description: string | null
  category: string | null
  story: string | null
  materials: string | null
  origin: string | null
  image_url: string | null
  brand_id: string | null
  metadata: Record<string, unknown> | null
}

type WizardMeta = {
  story?: string
  materials?: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
  timeline?: Array<{ stepName?: string; location?: string; date?: string }>
}

type BatchRow = {
  production_run_name: string | null
  artisan_name: string | null
  location: string | null
  produced_at: string | null
}

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>
  searchParams: Promise<{ sk?: string; skt?: string }>
}) {
  const { qrToken } = await params
  const { sk, skt } = await searchParams

  const passportRow = await findPassportByTokenOrSerial(qrToken)
  if (!passportRow) {
    return notFoundScan()
  }

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status, serial_number, product_id, metadata")
    .eq("id", passportRow.id)
    .single()

  if (!passport) {
    return notFoundScan()
  }

  if (passport.status === "revoked" || passport.status === "expired") {
    return revokedScan(passport.status)
  }

  const skipProcessScan = verifyScanRedirectToken(passportRow.id, sk, skt)
  if (!skipProcessScan) {
    const ctx = await buildRequestContext()
    await processScan({
      serialId: qrToken,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      city: ctx.city,
      country: ctx.country,
    })
  }

  const { data: product } = await admin
    .from("products")
    .select("name, description, category, story, materials, origin, image_url, brand_id, metadata")
    .eq("id", passport.product_id)
    .single()

  const productData = product as ProductRow | null

  let brandName = "Brand"
  if (productData?.brand_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("brand_name")
      .eq("id", productData.brand_id)
      .maybeSingle()
    brandName = profile?.brand_name ?? brandName
  }

  const { data: batch } = await admin
    .from("batches")
    .select("production_run_name, artisan_name, location, produced_at")
    .eq("product_id", passport.product_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const batchData = batch as BatchRow | null

  const displayId = passport.serial_number ?? passport.id

  const passportMeta = passport.metadata as { wizard?: WizardMeta } | null | undefined
  const wizard = passportMeta?.wizard
  const storyText =
    (wizard?.story && wizard.story.trim()) || productData?.story || null
  const structuredMaterials = wizard?.materials?.filter((m) => m?.name || m?.source)
  const timelineSteps = wizard?.timeline?.filter((t) => t?.stepName || t?.location || t?.date)

  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer>
        <div className={`mx-auto w-full max-w-md ${spacing.stackDense}`}>
          <Link
            href="/"
            className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Home
          </Link>

          <div className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Authenticity confirmed
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                Verified by OriginPass
              </div>
            </div>

            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
              {productData?.image_url ? (
                <img
                  src={productData.image_url}
                  alt={productData.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest text-slate-300">
                  Product Image
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-slate-900">{productData?.name ?? "Product"}</h1>
              <p className="text-sm text-slate-500">{brandName}</p>
              {productData?.category ? (
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  {productData.category}
                </p>
              ) : null}
            </div>
          </div>

          {productData?.description ? (
            <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">About</h2>
              <p>{productData.description}</p>
            </div>
          ) : null}

          <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Product details</h2>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Batch:</span>
              <span className="font-medium text-slate-900">
                {batchData?.production_run_name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Passport ID:</span>
              <span className="font-mono text-xs text-slate-900">{displayId}</span>
            </div>
            <div className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-amber-600" />
              <span className="text-slate-500">Crafted by:</span>
              <span className="font-medium text-slate-900">{batchData?.artisan_name ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              <span className="text-slate-500">Made in:</span>
              <span className="font-medium text-slate-900">{batchData?.location ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600" />
              <span className="text-slate-500">Produced on:</span>
              <span className="font-medium text-slate-900">
                {batchData?.produced_at
                  ? new Date(batchData.produced_at).toLocaleDateString()
                  : "—"}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Origin</h2>
            <p>
              <span className="font-medium text-slate-900">
                {productData?.origin?.trim() || batchData?.location || "—"}
              </span>
            </p>
          </div>

          <PassportPublicI18n
            passportId={passport.id}
            productName={productData?.name ?? "Product"}
            brandName={brandName}
            initialStory={storyText}
            fallbackStory={`${brandName} publishes digital product records so customers can verify authenticity in one scan.`}
            structuredMaterials={structuredMaterials ?? null}
            legacyMaterialsText={productData?.materials ?? null}
            timelineSteps={timelineSteps ?? null}
          />

          <div className="space-y-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Warranty & ownership
            </h2>
            <p className="text-sm text-emerald-900">
              Register ownership to activate support and keep a trusted proof-of-authenticity record.
            </p>
            <div className="grid gap-3">
              <Link
                href={`/claim/${encodeURIComponent(qrToken)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                <UserRoundCheck className="h-4 w-4" />
                Claim ownership
              </Link>
              <Link
                href={`/passport/${displayId}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                <BadgeCheck className="h-4 w-4" />
                View full passport
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                <FileBadge2 className="h-4 w-4" />
                Warranty support
              </Link>
              <Link
                href="/support/contact-support"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
              >
                Report issue
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-4 text-xs text-slate-500">
            <p className="flex items-center gap-2 font-medium text-slate-700">
              <BadgeCheck className="h-4 w-4 text-emerald-600" /> Why this page is trustworthy
            </p>
            <ul className="mt-2 space-y-1">
              <li>Unique passport token validated at scan time</li>
              <li>Brand-issued product details and production metadata</li>
              <li>Revoked or invalid passports are clearly flagged</li>
            </ul>
          </div>

          <footer className="text-center text-xs text-slate-400">
            <p>Powered by OriginPass</p>
            <p className="mt-1">Digital trust passports for small brands.</p>
          </footer>
        </div>
      </NarrowContainer>
    </main>
  )
}

function notFoundScan() {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer>
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Home
          </Link>
          <div className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                <XCircle className="h-6 w-6 text-rose-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-rose-600">Scan result</p>
                <h1 className="text-xl font-semibold text-rose-900">Passport not found</h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-rose-700">
              This QR code does not match any registered passport.
            </p>
          </div>
        </div>
      </NarrowContainer>
    </main>
  )
}

function revokedScan(status: string) {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer>
        <div className="mx-auto w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
          >
            <ArrowLeft className="mr-1 h-3 w-3" /> Home
          </Link>
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <XCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-600">Scan result</p>
                <h1 className="text-xl font-semibold text-amber-900">
                  {status === "expired" ? "Passport expired" : "Passport revoked"}
                </h1>
              </div>
            </div>
            <p className="mt-3 text-sm text-amber-700">
              This passport is no longer valid. Contact the brand if you need help.
            </p>
          </div>
        </div>
      </NarrowContainer>
    </main>
  )
}
