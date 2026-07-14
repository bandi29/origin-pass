"use client"

import { useEffect, useState } from "react"
import { FileText, ShieldCheck } from "lucide-react"
import { VERIFICATION_FIELD_KEYS } from "@/lib/verification-field-keys"
import type { PublicFieldEvidence } from "@/lib/public-verification-evidence"
import type { DataProvenance } from "@/lib/evidence-scope"
import { DataProvenanceBadge } from "@/components/verification/DataProvenanceBadge"
import { EvidenceScopeBadge } from "@/components/verification/EvidenceScopeBadge"
import { VerificationStatusPill } from "@/components/verification/VerificationStatusPill"

export type LuxuryPassportData = {
  productTitle: string | null
  imageUrl: string | null
  brandName: string | null
  productionLocation: string | null
  careInstructions: string | null
  story: string | null
  /** Plain-text materials fallback when no structured composition exists. */
  materials: string | null
  /** Structured composition for the animated bars, e.g. {"Organic cotton": 80, "Recycled polyester": 20}. */
  materialComposition: Record<string, number> | null
  carbonFootprint: number | null
  /** Source of the resolved compliance data — surfaced subtly for trust. */
  dataLevel?: "variant" | "product" | "store"
  /** Whether this passport includes record-level values beyond brand defaults. */
  dataProvenance?: DataProvenance
  /** Verification evidence rows (signed URLs minted server-side). */
  evidence?: PublicFieldEvidence[]
}

/** Always render readable copy, never an empty void. */
const text = (raw: string | null | undefined, fallback = "Not provided") =>
  raw && raw.trim() ? raw.trim() : fallback

const BAR_TONES = ["bg-neutral-900", "bg-stone-500", "bg-amber-700/80", "bg-emerald-700/80", "bg-neutral-400"]

/**
 * Consumer-facing luxury passport. Pure presentation + local UI state; every
 * field degrades gracefully so partial records can't break the layout.
 */
export function LuxuryTemplateView({ data }: { data: LuxuryPassportData }) {
  const title = text(data.productTitle, "Product passport")
  const initial = title.trim().slice(0, 1).toUpperCase() || "·"

  // Animate the composition bars from 0 → their value on mount.
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const composition = Object.entries(data.materialComposition ?? {})
    .filter(([, v]) => Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1])

  const evidenceByKey = Object.fromEntries((data.evidence ?? []).map((row) => [row.fieldKey, row]))
  const productionEvidence = evidenceByKey[VERIFICATION_FIELD_KEYS.PRODUCTION_LOCATION]
  const careEvidence = evidenceByKey[VERIFICATION_FIELD_KEYS.CARE_INSTRUCTIONS]
  const passportProvenance = data.dataProvenance ?? "fallback"

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 font-sans text-neutral-900 sm:py-14">
      <p className="text-center text-[11px] font-medium uppercase tracking-[0.28em] text-neutral-400">
        {text(data.brandName, "OriginPass")} · Digital Passport
      </p>

      <div className="mt-4 flex justify-center">
        <DataProvenanceBadge provenance={passportProvenance} variant="public" />
      </div>

      {/* Hero: hi-res image + title + compliance badge */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_24px_70px_-32px_rgba(0,0,0,0.45)]">
        <div className="relative aspect-[4/3] w-full bg-neutral-100">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900">
              <span className="font-serif text-5xl font-semibold text-white/80">{initial}</span>
            </div>
          )}
          <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" stroke="currentColor" strokeWidth="1.6" />
              <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Verified EU DPP Compliant
          </span>
        </div>

        <div className="px-6 pb-6 pt-5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-neutral-500">{text(data.productionLocation, "Origin on file")}</p>
            {productionEvidence ? (
              <DataProvenanceBadge provenance={productionEvidence.dataProvenance} variant="public" />
            ) : null}
            {productionEvidence ? (
              <VerificationStatusPill
                variant="public"
                hasDocument={productionEvidence.hasDocument}
                status={productionEvidence.verificationStatus}
                evidenceScope={productionEvidence.evidenceScope}
                scopeMismatch={productionEvidence.scopeMismatch}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Verification & evidence — consumer differentiator */}
      {(data.evidence?.length ?? 0) > 0 ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Verification &amp; evidence
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Each claim shows whether documentation is on file, how it was attested, and whether evidence is
                brand-wide or specific to this product.
              </p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {data.evidence!.map((row) => (
              <li
                key={row.fieldKey}
                className={`rounded-xl border px-4 py-3 ${
                  row.hasDocument
                    ? row.evidenceScope === "product"
                      ? "border-emerald-100 bg-emerald-50/40"
                      : row.scopeMismatch
                        ? "border-amber-200 bg-amber-50/50"
                        : "border-amber-100 bg-amber-50/30"
                    : "border-neutral-200 bg-neutral-50/80"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-neutral-900">{row.label}</p>
                      <DataProvenanceBadge provenance={row.dataProvenance} variant="public" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <VerificationStatusPill
                        variant="public"
                        hasDocument={row.hasDocument}
                        status={row.verificationStatus}
                        evidenceScope={row.evidenceScope}
                        scopeMismatch={row.scopeMismatch}
                      />
                      {row.hasDocument ? (
                        <EvidenceScopeBadge
                          scope={row.evidenceScope}
                          dataProvenance={row.dataProvenance}
                          variant="public"
                        />
                      ) : null}
                    </div>
                    {row.scopeMismatch ? (
                      <p className="text-xs leading-relaxed text-amber-900/90">
                        Brand-level evidence does not verify this product&apos;s own record for this claim.
                      </p>
                    ) : null}
                  </div>
                  {row.hasDocument && row.viewUrl ? (
                    <a
                      href={row.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 transition hover:bg-neutral-50"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      View certificate
                    </a>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-500">
                      No document attached
                    </span>
                  )}
                </div>
                {row.hasDocument && row.documentName ? (
                  <p className="mt-2 truncate text-xs text-neutral-500" title={row.documentName}>
                    {row.documentName}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Material composition — animated glassmorphism card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Material composition</h2>
          {data.carbonFootprint != null ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              {data.carbonFootprint} kg CO₂e
            </span>
          ) : null}
        </div>

        {composition.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {composition.map(([name, pct], i) => (
              <li key={name}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-neutral-800">{name}</span>
                  <span className="tabular-nums text-neutral-500">{pct}%</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200/70">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-out ${BAR_TONES[i % BAR_TONES.length]}`}
                    style={{ width: grown ? `${Math.min(100, pct)}%` : "0%" }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-neutral-700">{text(data.materials)}</p>
        )}
      </div>

      {/* Regulatory disclosures — accordion */}
      <div className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <Disclosure title="Traceability Matrix" body={text(data.story, "Provenance recorded against the brand's verified supply chain.")} defaultOpen />
        <Disclosure
          title="Recycling Guide"
          body={text(
            composition.length > 0 ? `Separate components for recycling: ${composition.map(([n]) => n).join(", ")}.` : data.materials,
            "Follow local textile recycling guidance.",
          )}
        />
        <Disclosure
          title="Care Instructions"
          body={text(data.careInstructions)}
          evidence={careEvidence}
        />
      </div>

      <p className="mt-6 text-center text-[11px] text-neutral-400">
        Powered by OriginPass
        {data.dataLevel && passportProvenance === "record" ? ` · ${data.dataLevel}-level data` : null}
      </p>
    </div>
  )
}

function Disclosure({
  title,
  body,
  defaultOpen = false,
  evidence,
}: {
  title: string
  body: string
  defaultOpen?: boolean
  evidence?: PublicFieldEvidence
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">{title}</span>
          {evidence ? (
            <VerificationStatusPill
              variant="public"
              hasDocument={evidence.hasDocument}
              status={evidence.verificationStatus}
              evidenceScope={evidence.evidenceScope}
              scopeMismatch={evidence.scopeMismatch}
            />
          ) : null}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          fill="none"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 px-5 pb-5">
            {evidence ? (
              <div className="flex flex-wrap items-center gap-2">
                <EvidenceScopeBadge
                  scope={evidence.evidenceScope}
                  dataProvenance={evidence.dataProvenance}
                  variant="public"
                />
                <DataProvenanceBadge provenance={evidence.dataProvenance} variant="public" />
              </div>
            ) : null}
            <p className="text-sm leading-relaxed text-neutral-600">{body}</p>
            {evidence?.scopeMismatch ? (
              <p className="text-xs leading-relaxed text-amber-900/90">
                Brand-level evidence does not verify this product&apos;s own record for this claim.
              </p>
            ) : null}
            {evidence?.hasDocument && evidence.viewUrl ? (
              <a
                href={evidence.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
              >
                <FileText className="h-4 w-4" aria-hidden />
                View supporting certificate
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
