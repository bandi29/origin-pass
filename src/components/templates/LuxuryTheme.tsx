import {
  ShieldCheck,
  MapPin,
  Calendar,
  Hammer,
  BadgeCheck,
  FileBadge2,
  UserRoundCheck,
} from "lucide-react"
import { spacing } from "@/design-system/tokens"
import { PassportNavLink } from "@/components/templates/PassportNavLink"
import {
  PassportBrandLabel,
  PassportImagePlaceholder,
  PASSPORT_OWNERSHIP_PRIMARY_LABEL,
  passportOwnershipPrimaryClass,
} from "@/components/templates/passport-luxury-primitives"
import { NarrowContainer } from "@/components/layout/Containers"
import { PassportPublicI18n } from "@/components/passports/PassportPublicI18n"
import { ConsumerScanTopBar } from "@/components/passports/ConsumerScanTopBar"
import { PassportConsumerHomeNav } from "@/components/passports/PassportConsumerHomeNav"
import type { PassportThemeComponentProps } from "@/components/templates/passport-theme-types"

/** Shared secondary ownership-registry link — mirrors ClassicTheme's `actionBtn`.
 *  Uses the luxury amber palette and matches the radius of the primary CTA. */
const actionBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200/30 bg-slate-950/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-amber-50 shadow-sm transition hover:bg-slate-900/70"

/** Unified luxury info-card shell — all panels share one radius + border + bg. */
const infoCard = "space-y-3 rounded-3xl border border-amber-200/20 bg-slate-900/80 p-5 shadow-sm"

/** Section label for the luxury dark-mode palette. */
const sectionLabel = "text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90"

export function LuxuryTheme({
  embed,
  sharePreview = false,
  passportPublicScan = false,
  adminPreview = false,
  brandHomeUrl = null,
  publicHomeHref = "/",
  qrToken,
  displayId,
  passportId,
  productData,
  brandName,
  batchData,
  storyText,
  structuredMaterials,
  timelineSteps,
}: PassportThemeComponentProps) {
  const stackClass = embed ? "space-y-3" : spacing.stackDense

  const inner = (
    <>
      {!embed ? (
        <PassportConsumerHomeNav
          adminPreview={adminPreview}
          publicHomeHref={publicHomeHref}
          className="inline-flex items-center text-xs text-amber-200/80 transition-colors hover:text-amber-100"
        />
      ) : null}

      <div
        className={`space-y-4 rounded-3xl border border-amber-200/30 bg-slate-900/95 p-6 shadow-xl shadow-amber-950/20 ${embed ? "shadow-lg" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            Authenticity confirmed
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-slate-950/50 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-amber-100/90">
            <BadgeCheck className="h-3.5 w-3.5 text-amber-400" />
            Verified by OriginPass
          </div>
        </div>

        <div className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-amber-200/20">
          {productData?.image_url ? (
            <img src={productData.image_url} alt={productData.name} className="h-full w-full object-cover" />
          ) : (
            <PassportImagePlaceholder variant="luxury" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-amber-50">
            {productData?.name ?? "Product"}
          </h1>
          <PassportBrandLabel brandName={brandName} variant="luxury" />
          {productData?.category ? (
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-amber-400/80">{productData.category}</p>
          ) : null}
        </div>
      </div>

      {productData?.description ? (
        <div className={`${infoCard} text-sm leading-relaxed text-slate-300`}>
          <h2 className={sectionLabel}>About</h2>
          <p>{productData.description}</p>
        </div>
      ) : null}

      <div className={`${infoCard} text-sm text-slate-300`}>
        <h2 className={sectionLabel}>Product details</h2>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Batch</dt>
            <dd className="font-medium text-amber-50">{batchData?.production_run_name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Passport ID</dt>
            <dd className="font-mono text-xs text-amber-100">{displayId}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <dt className="text-slate-500">Crafted by</dt>
            <dd className="ml-auto font-medium text-amber-50">{batchData?.artisan_name ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <dt className="text-slate-500">Made in</dt>
            <dd className="ml-auto font-medium text-amber-50">{batchData?.location ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <dt className="text-slate-500">Produced on</dt>
            <dd className="ml-auto font-medium text-amber-50">
              {batchData?.produced_at ? new Date(batchData.produced_at).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className={`${infoCard} text-sm text-slate-300`}>
        <h2 className={sectionLabel}>Origin</h2>
        <p className="font-medium text-amber-50">
          {productData?.origin?.trim() || batchData?.location || "—"}
        </p>
      </div>

      <div className="rounded-3xl border border-amber-200/15 bg-slate-950/40 p-1">
        <PassportPublicI18n
          passportId={passportId}
          productName={productData?.name ?? "Product"}
          brandName={brandName}
          initialStory={storyText}
          fallbackStory={`${brandName} publishes digital product records so customers can verify authenticity in one scan.`}
          structuredMaterials={structuredMaterials ?? null}
          legacyMaterialsText={productData?.materials ?? null}
          timelineSteps={timelineSteps ?? null}
          sharePreview={sharePreview}
          themeVariant="luxury"
        />
      </div>

      {!embed ? (
        <div className="space-y-4 border-y border-amber-200/20 py-8">
          <div>
            <h2 className="tracking-widest text-xs font-semibold uppercase text-amber-200/70">
              Ownership registry
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-amber-100/75">
              Activate secure ownership to preserve provenance, unlock support, and keep a trusted authenticity record.
            </p>
          </div>
          <div className="grid gap-3">
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href={`/claim/${encodeURIComponent(qrToken)}`}
              className={passportOwnershipPrimaryClass}
            >
              <UserRoundCheck className="h-4 w-4" />
              {PASSPORT_OWNERSHIP_PRIMARY_LABEL}
            </PassportNavLink>
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href={`/passport/${displayId}`}
              className={actionBtn}
            >
              <BadgeCheck className="h-4 w-4 text-amber-400" />
              View full passport
            </PassportNavLink>
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href="/support"
              className={actionBtn}
            >
              <FileBadge2 className="h-4 w-4 text-amber-400" />
              Warranty support
            </PassportNavLink>
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href="/support/contact-support"
              className={actionBtn}
            >
              Report issue
            </PassportNavLink>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-200/30 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
          Warranty & ownership actions appear on the live scan page.
        </div>
      )}

      {!embed ? (
        <div className={`${infoCard} text-xs text-slate-400`}>
          <p className="flex items-center gap-2 font-medium text-amber-100">
            <BadgeCheck className="h-4 w-4 text-amber-400" aria-hidden /> Why this page is trustworthy
          </p>
          <ul className="mt-2 space-y-1.5 leading-relaxed">
            <li>Unique passport token validated at scan time</li>
            <li>Brand-issued product details and production metadata</li>
            <li>Revoked or invalid passports are clearly flagged</li>
          </ul>
        </div>
      ) : null}

      {!embed ? (
        <footer className="text-center text-xs text-slate-500">
          <p className="text-amber-200/60">Powered by OriginPass</p>
          <p className="mt-1">Digital trust passports for small brands.</p>
        </footer>
      ) : null}
    </>
  )

  if (embed) {
    return <div className={`bg-slate-950 text-slate-100 ${stackClass}`}>{inner}</div>
  }

  return (
    <>
      {passportPublicScan ? <ConsumerScanTopBar brandHomeUrl={brandHomeUrl} /> : null}
      <main className={`min-h-screen bg-slate-950 text-slate-100 ${spacing.main}`}>
        <NarrowContainer>
          <div className={`mx-auto w-full max-w-md ${stackClass}`}>{inner}</div>
        </NarrowContainer>
      </main>
    </>
  )
}
