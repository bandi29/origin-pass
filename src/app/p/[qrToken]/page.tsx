import { after } from "next/server"
import { findPassportByTokenOrSerial } from "@/backend/modules/passports/repository"
import { buildRequestContext } from "@/backend/middleware/request-context"
import { processScan } from "@/backend/modules/scans/process-scan"
import { verifyScanRedirectToken } from "@/lib/scan-redirect-token"
import { resolvePassportTemplateKey } from "@/lib/passport-display-templates"
import { formatBrandDisplayName } from "@/lib/format-brand-display-name"
import { PassportPublicThemeView } from "@/components/templates/PassportPublicThemeView"
import { XCircle } from "lucide-react"
import { spacing } from "@/design-system/tokens"
import { NarrowContainer } from "@/components/layout/Containers"
import {
  extractBrandHomeUrlFromMetadata,
  isAdminPassportPreview,
  logScanTelemetryBypassIfDev,
  resolveConsumerHomeHref,
  shouldBypassScanTelemetry,
} from "@/lib/public-passport-consumer"
import { PassportConsumerHomeNav } from "@/components/passports/PassportConsumerHomeNav"
import { getCachedPassportSnapshot } from "@/lib/passport-public-cache"

/**
 * Architecture (post Month-1 refactor):
 *
 *   1. Dynamic token lookup (cannot be cached — the URL parameter is the cache key
 *      candidate but the verify_token → passport.id mapping changes on rotation).
 *   2. Tag-cached passport+product+profile+batch snapshot via getCachedPassportSnapshot,
 *      invalidated on writes via `revalidateTag(passport:${id})`.
 *   3. Scan recording offloaded to `after()` → enqueueScanPipeline → BullMQ worker.
 *
 * Result: warm-cache renders avoid 5 sequential Supabase round-trips. The response
 * is still per-request dynamic so we never leak across users (no shared HTML cache).
 */
export const dynamic = "force-dynamic"

type WizardMeta = {
  story?: string
  materials?: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
  timeline?: Array<{ stepName?: string; location?: string; date?: string }>
}

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>
  searchParams: Promise<{ sk?: string; skt?: string; preview?: string; admin?: string }>
}) {
  const { qrToken } = await params
  const query = await searchParams
  const { sk, skt, preview, admin } = query

  const passportRow = await findPassportByTokenOrSerial(qrToken)
  if (!passportRow) {
    return notFoundScan()
  }

  // Tag-cached snapshot. Subsequent scans of the same passport (or different
  // serials pointing at the same passport row) skip the 4 sequential DB reads.
  const snapshot = await getCachedPassportSnapshot(passportRow.id)
  const passport = snapshot.passport
  if (!passport) {
    return notFoundScan()
  }
  if (passport.status === "revoked" || passport.status === "expired") {
    return revokedScan(passport.status)
  }

  const bypassScanTelemetry = shouldBypassScanTelemetry({ preview, admin })
  const skipProcessScan = verifyScanRedirectToken(passportRow.id, sk, skt) || bypassScanTelemetry
  if (!skipProcessScan) {
    // Capture the request context synchronously, defer the scan write until after
    // the response is sent. The write itself enqueues to BullMQ (scan-pipeline).
    const ctx = await buildRequestContext()
    after(async () => {
      try {
        await processScan({
          serialId: qrToken,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          city: ctx.city,
          country: ctx.country,
        })
      } catch (err) {
        console.warn("[p/qrToken] deferred processScan failed:", err instanceof Error ? err.message : err)
      }
    })
  } else if (bypassScanTelemetry) {
    logScanTelemetryBypassIfDev()
  }

  const productData = snapshot.product
  const brandName = formatBrandDisplayName(snapshot.profile?.brand_name ?? "Brand")
  const brandPassportTemplate = snapshot.profile?.passport_template_key ?? null
  const templateKey = resolvePassportTemplateKey(
    productData?.passport_template_key,
    brandPassportTemplate,
  )
  const batchData = snapshot.batch

  const displayId = passport.serial_number ?? passport.id

  const passportMeta = passport.metadata as { wizard?: WizardMeta } | null | undefined
  const wizard = passportMeta?.wizard
  const storyText =
    (wizard?.story && wizard.story.trim()) || productData?.story || null
  const structuredMaterials = wizard?.materials?.filter((m) => m?.name || m?.source)
  const timelineSteps = wizard?.timeline?.filter((t) => t?.stepName || t?.location || t?.date)

  const brandHomeUrl = extractBrandHomeUrlFromMetadata(passport.metadata, productData?.metadata ?? null)
  const publicHomeHref = resolveConsumerHomeHref(brandHomeUrl)
  const adminPreview = isAdminPassportPreview({ preview, admin })

  return (
    <PassportPublicThemeView
      templateKey={templateKey}
      qrToken={qrToken}
      displayId={displayId}
      passportId={passport.id}
      productData={productData}
      brandName={brandName}
      batchData={batchData}
      storyText={storyText}
      structuredMaterials={structuredMaterials ?? null}
      timelineSteps={timelineSteps ?? null}
      publicHomeHref={publicHomeHref}
      brandHomeUrl={brandHomeUrl}
      adminPreview={adminPreview}
    />
  )
}

function notFoundScan() {
  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
      <NarrowContainer>
        <div className="mx-auto w-full max-w-md">
          <PassportConsumerHomeNav
            publicHomeHref="/"
            className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
          />
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
          <PassportConsumerHomeNav
            publicHomeHref="/"
            className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
          />
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
