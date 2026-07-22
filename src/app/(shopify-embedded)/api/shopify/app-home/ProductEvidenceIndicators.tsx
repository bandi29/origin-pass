import clsx from "clsx"
import {
  FIELD_LINEAGE_FIELD_LABELS,
  fieldLineageChip,
  type FieldLineageState,
} from "@/lib/merchant-field-evidence"

const toneClass = {
  inherited: "border-emerald-200 bg-emerald-50 text-emerald-800",
  // Dashed = "incomplete", readable without relying on the grey/green colour shift.
  // Deliberately not amber: that tone is reserved for `conflict` (an unverified
  // override), which is a worse state than simply awaiting evidence.
  "inherited-muted": "border-dashed border-[#c9cccf] bg-[#f6f6f7] text-[#6d7175]",
  overridden: "border-sky-200 bg-sky-50 text-sky-900",
  conflict: "border-amber-200 bg-amber-50 text-amber-950",
} as const

export function ProductEvidenceIndicators({
  evidence,
  brandCerts,
}: {
  evidence: {
    productionLocation: FieldLineageState
    careInstructions: FieldLineageState
  }
  brandCerts: {
    productionLocation: boolean
    careInstructions: boolean
  }
}) {
  const items = [
    {
      key: FIELD_LINEAGE_FIELD_LABELS.productionLocation,
      state: evidence.productionLocation,
      brandCert: brandCerts.productionLocation,
    },
    {
      key: FIELD_LINEAGE_FIELD_LABELS.careInstructions,
      state: evidence.careInstructions,
      brandCert: brandCerts.careInstructions,
    },
  ] as const

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ key, state, brandCert }) => {
        const chip = fieldLineageChip(state, brandCert)
        return (
          <span
            key={key}
            aria-label={`${key}: ${chip.label}`}
            className={clsx(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
              toneClass[chip.tone],
            )}
          >
            <span className="mr-1 text-[9px] font-bold uppercase text-current/70">{key}</span>
            {chip.label}
          </span>
        )
      })}
    </div>
  )
}
