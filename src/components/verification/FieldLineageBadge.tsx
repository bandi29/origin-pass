import clsx from "clsx"
import { fieldLineageChip, type FieldLineageState } from "@/lib/field-lineage"

const toneClass = {
  inherited: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "inherited-muted": "border-[#e3e3e3] bg-[#f6f6f7] text-[#6d7175]",
  overridden: "border-sky-200 bg-sky-50 text-sky-900",
  conflict: "border-amber-200 bg-amber-50 text-amber-950",
} as const

export function FieldLineageBadge({
  state,
  brandCertPresent,
  className,
}: {
  state: FieldLineageState
  brandCertPresent: boolean
  className?: string
}) {
  const chip = fieldLineageChip(state, brandCertPresent)
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide",
        toneClass[chip.tone],
        className,
      )}
    >
      {chip.label}
    </span>
  )
}
