import { UploadCloud } from "lucide-react"

export function ConflictResolutionPanel({
  fieldLabel,
  onAttach,
  onRevert,
}: {
  fieldLabel: string
  onAttach: () => void
  onRevert: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-950">Resolve this unverified claim</p>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
        This product&apos;s {fieldLabel} differs from your brand default. Attach product-specific evidence, or revert
        to inherit the verified brand default on this passport.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAttach}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#303030] px-3 py-2 text-xs font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] transition hover:bg-[#1a1a1a]"
        >
          <UploadCloud className="h-3.5 w-3.5" aria-hidden />
          Attach verifying document
        </button>
        <button
          type="button"
          onClick={onRevert}
          className="inline-flex items-center rounded-lg border border-[#c9cccf] bg-white px-3 py-2 text-xs font-semibold text-[#202223] transition hover:bg-[#f6f6f7]"
        >
          Revert to brand default
        </button>
      </div>
    </div>
  )
}
