import clsx from "clsx"
import { evidenceScopeForField, type DataProvenance, type EvidenceScope } from "@/lib/evidence-scope"

type Variant = "merchant" | "public"

const toneClass: Record<EvidenceScope, { merchant: string; public: string }> = {
  product: {
    merchant: "border-emerald-200 bg-emerald-50 text-emerald-800",
    public: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  brand: {
    merchant: "border-amber-200 bg-amber-50 text-amber-900",
    public: "border-amber-200 bg-amber-50 text-amber-950",
  },
  none: {
    merchant: "border-[#e3e3e3] bg-[#f6f6f7] text-[#6d7175]",
    public: "border-neutral-200 bg-neutral-100 text-neutral-600",
  },
}

export function EvidenceScopeBadge({
  scope,
  dataProvenance = "fallback",
  variant = "public",
  className,
  title,
}: {
  scope: EvidenceScope
  dataProvenance?: DataProvenance
  variant?: Variant
  className?: string
  title?: string
}) {
  const model = evidenceScopeForField({
    productCertPresent: scope === "product",
    brandCertPresent: scope === "brand",
    dataProvenance,
  })
  const isPublic = variant === "public"
  return (
    <span
      title={title ?? model.helper}
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        // Sentence case for shoppers; merchant surfaces keep the dense all-caps ops style.
        isPublic ? "tracking-normal" : "uppercase tracking-wide",
        toneClass[scope][variant],
        model.mismatchedWithData && scope === "brand" ? "ring-1 ring-amber-300/80" : null,
        className,
      )}
    >
      {isPublic ? model.publicLabel : model.label}
    </span>
  )
}
