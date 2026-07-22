import clsx from "clsx"
import { dataProvenanceForPassport, type DataProvenance } from "@/lib/evidence-scope"

type Variant = "merchant" | "public"

const toneClass: Record<DataProvenance, { merchant: string; public: string }> = {
  record: {
    merchant: "border-emerald-200 bg-emerald-50 text-emerald-800",
    public: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  fallback: {
    merchant: "border-amber-200 bg-amber-50 text-amber-900",
    public: "border-amber-200 bg-amber-50 text-amber-950",
  },
}

export function DataProvenanceBadge({
  provenance,
  variant = "merchant",
  className,
  title,
}: {
  provenance: DataProvenance
  variant?: Variant
  className?: string
  title?: string
}) {
  const model = dataProvenanceForPassport({ hasRecordLevelData: provenance === "record" })
  const isPublic = variant === "public"
  return (
    <span
      title={title ?? (isPublic ? model.publicHelper : model.helper)}
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        // Sentence case for shoppers; merchant surfaces keep the dense all-caps ops style.
        isPublic ? "tracking-normal" : "uppercase tracking-wide",
        toneClass[provenance][variant],
        className,
      )}
    >
      {isPublic ? model.publicLabel : model.label}
    </span>
  )
}
