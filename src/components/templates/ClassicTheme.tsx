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

/**
 * Classic passport public theme.
 *
 * Design-system alignment (polish sweep):
 *   - All info-card shells now use the same surface tokens:
 *     `rounded-3xl border border-ds-border bg-white shadow-sm` — one border
 *     colour, one shadow, one radius. The hero verification card keeps
 *     `border-emerald-100` as an intentional brand differentiator.
 *   - Section label typography unified to `text-[11px] font-semibold uppercase
 *     tracking-[0.2em] text-ds-text-muted` — consistent across all panels.
 *   - Ownership registry secondary CTAs use a shared `actionBtn` constant
 *     instead of a 90-char inline string repeated 3×.
 *   - Trust footer gets a soft-tinted surface to lift it visually from the
 *     plain page background.
 *   - Empty embed placeholder uses `border-ds-border bg-canvas` tokens.
 */

/** Shared surface for secondary ownership-registry action links. */
const actionBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-ds-border bg-white px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-ds-text shadow-sm transition hover:bg-canvas dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"

/** Unified info-card shell: same radius + border + shadow everywhere. */
const infoCard = "space-y-3 rounded-3xl border border-ds-border bg-white p-5 shadow-sm"

/** Section label: one style, used in every info panel. */
const sectionLabel = "text-[11px] font-semibold uppercase tracking-[0.2em] text-ds-text-muted"

export function ClassicTheme({
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
  initialLang = "en",
}: PassportThemeComponentProps) {
  const stackClass = embed ? "space-y-3" : spacing.stackDense

  const inner = (
    <>
      {!embed ? (
        <PassportConsumerHomeNav
          adminPreview={adminPreview}
          publicHomeHref={publicHomeHref}
          className="inline-flex items-center text-xs text-slate-400 transition-colors hover:text-slate-600"
        />
      ) : null}

      {/* ── Hero verification card ─────────────────────────────────────── */}
      {/* Keeps `border-emerald-100` as a deliberate brand differentiator —
          the green border signals "verified" without a text label. */}
      <div className={`space-y-4 rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg ${embed ? "shadow-md" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Authenticity confirmed
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-ds-border bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-600">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
            Verified by OriginPass
          </div>
        </div>

        <div className="aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-slate-200/80 dark:ring-slate-800">
          {productData?.image_url ? (
            <img src={productData.image_url} alt={productData.name} className="h-full w-full object-cover" />
          ) : (
            <PassportImagePlaceholder variant="classic" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {productData?.name ?? "Product"}
          </h1>
          <PassportBrandLabel brandName={brandName} variant="classic" />
          {productData?.category ? (
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{productData.category}</p>
          ) : null}
        </div>
      </div>

      {/* ── About ─────────────────────────────────────────────────────── */}
      {productData?.description ? (
        <div className={infoCard}>
          <h2 className={sectionLabel}>About</h2>
          <p className="text-sm leading-relaxed text-slate-600">{productData.description}</p>
        </div>
      ) : null}

      {/* ── Product details ────────────────────────────────────────────── */}
      <div className={infoCard}>
        <h2 className={sectionLabel}>Product details</h2>
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Batch</dt>
            <dd className="font-medium text-slate-900">{batchData?.production_run_name ?? "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Passport ID</dt>
            <dd className="font-mono text-xs text-slate-900">{displayId}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <dt className="text-slate-500">Crafted by</dt>
            <dd className="ml-auto font-medium text-slate-900">{batchData?.artisan_name ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <dt className="text-slate-500">Made in</dt>
            <dd className="ml-auto font-medium text-slate-900">{batchData?.location ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <dt className="text-slate-500">Produced on</dt>
            <dd className="ml-auto font-medium text-slate-900">
              {batchData?.produced_at ? new Date(batchData.produced_at).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Story, materials, origin, care, timeline (translated) ──────── */}
      <PassportPublicI18n
        passportId={passportId}
        productName={productData?.name ?? "Product"}
        brandName={brandName}
        initialStory={storyText}
        fallbackStory={`${brandName} publishes digital product records so customers can verify authenticity in one scan.`}
        initialOrigin={productData?.origin?.trim() || batchData?.location || null}
        initialCare={productData?.lifecycle?.trim() || null}
        structuredMaterials={structuredMaterials ?? null}
        legacyMaterialsText={productData?.materials ?? null}
        timelineSteps={timelineSteps ?? null}
        sharePreview={sharePreview}
        themeVariant="classic"
        initialLang={initialLang}
      />

      {/* ── Ownership registry ─────────────────────────────────────────── */}
      {!embed ? (
        <div className="space-y-4 border-y border-ds-border py-8">
          <div>
            <h2 className={`${sectionLabel} text-slate-500 dark:text-slate-400`}>
              Ownership registry
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Activate secure ownership to preserve provenance, unlock support, and keep a
              trusted authenticity record.
            </p>
          </div>
          <div className="grid gap-2">
            {/* Primary CTA keeps its own style from passport-luxury-primitives. */}
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href={`/claim/${encodeURIComponent(qrToken)}`}
              className={passportOwnershipPrimaryClass}
            >
              <UserRoundCheck className="h-4 w-4" />
              {PASSPORT_OWNERSHIP_PRIMARY_LABEL}
            </PassportNavLink>
            {/* Secondary CTAs share the `actionBtn` constant — one class string,
                three links, zero duplication. */}
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href={`/passport/${displayId}`}
              className={actionBtn}
            >
              <BadgeCheck className="h-4 w-4" />
              View full passport
            </PassportNavLink>
            <PassportNavLink
              passportPublicScan={passportPublicScan}
              href="/support"
              className={actionBtn}
            >
              <FileBadge2 className="h-4 w-4" />
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
        /* Embed placeholder — uses canvas token instead of bg-slate-50/80. */
        <div className="rounded-2xl border border-dashed border-ds-border bg-canvas p-4 text-center text-xs text-ds-text-muted">
          Warranty & ownership actions appear on the live scan page.
        </div>
      )}

      {/* ── Trust footer ──────────────────────────────────────────────── */}
      {!embed ? (
        /* Soft-tinted emerald surface echoes the hero card's verification
           colour — visually bookends the page and reinforces trust. */
        <div className="rounded-3xl border border-emerald-100/80 bg-emerald-50/40 p-4 text-xs text-slate-600">
          <p className="flex items-center gap-2 font-medium text-slate-700">
            <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            Why this page is trustworthy
          </p>
          <ul className="mt-2 space-y-1.5 leading-relaxed text-slate-500">
            <li>Unique passport token validated at scan time</li>
            <li>Brand-issued product details and production metadata</li>
            <li>Revoked or invalid passports are clearly flagged</li>
          </ul>
        </div>
      ) : null}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      {!embed ? (
        <footer className="text-center text-xs text-slate-400">
          <p>Powered by OriginPass</p>
          <p className="mt-1">Digital trust passports for small brands.</p>
        </footer>
      ) : null}
    </>
  )

  if (embed) {
    return <div className={`bg-slate-50 text-slate-900 ${stackClass}`}>{inner}</div>
  }

  return (
    <>
      {passportPublicScan ? <ConsumerScanTopBar brandHomeUrl={brandHomeUrl} /> : null}
      <main className={`min-h-screen bg-slate-50 text-slate-900 ${spacing.main}`}>
        <NarrowContainer>
          <div className={`mx-auto w-full max-w-md ${stackClass}`}>{inner}</div>
        </NarrowContainer>
      </main>
    </>
  )
}
