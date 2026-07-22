import clsx from "clsx"
import { verificationPillForField, type VerificationPillModel } from "@/lib/verification-status"

type Variant = "merchant" | "public"

const toneClass: Record<VerificationPillModel["tone"], { merchant: string; public: string }> = {
  muted: {
    merchant: "border-[#e3e3e3] bg-[#f6f6f7] text-[#6d7175]",
    public: "border-neutral-200 bg-neutral-100 text-neutral-600",
  },
  neutral: {
    merchant: "border-[#d9d9d9] bg-[#fafbfb] text-[#5c5f62]",
    public: "border-neutral-200 bg-neutral-50 text-neutral-700",
  },
  evidence: {
    merchant: "border-[#a6e8c4] bg-[#f0fbf4] text-[#0c5132]",
    public: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  verified: {
    merchant: "border-[#c4b5fd] bg-[#f5f3ff] text-[#5b21b6]",
    public: "border-violet-200 bg-violet-50 text-violet-900",
  },
}

export function VerificationStatusPill({
  hasDocument,
  status,
  evidenceScope,
  scopeMismatch,
  variant = "merchant",
  className,
}: {
  hasDocument: boolean
  status?: string | null
  evidenceScope?: "product" | "brand" | "none"
  scopeMismatch?: boolean
  variant?: Variant
  className?: string
}) {
  const pill = verificationPillForField({ hasDocument, status, evidenceScope, scopeMismatch })
  const isPublic = variant === "public"
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        // Shoppers get sentence case — all-caps compliance pills read as shouting and
        // are measurably slower to scan. Merchant surfaces keep the dense ops styling.
        isPublic ? "tracking-normal" : "uppercase tracking-wide",
        toneClass[pill.tone][variant],
        className,
      )}
    >
      {isPublic ? pill.publicLabel : pill.label}
    </span>
  )
}

export function VerificationFieldMeta({
  hasDocument,
  status,
  evidenceScope,
  scopeMismatch,
  variant = "public",
  className,
}: {
  hasDocument: boolean
  status?: string | null
  evidenceScope?: "product" | "brand" | "none"
  scopeMismatch?: boolean
  variant?: Variant
  className?: string
}) {
  const pill = verificationPillForField({ hasDocument, status, evidenceScope, scopeMismatch })
  return (
    <div className={clsx("space-y-1", className)}>
      <VerificationStatusPill
        hasDocument={hasDocument}
        status={status}
        evidenceScope={evidenceScope}
        scopeMismatch={scopeMismatch}
        variant={variant}
      />
      {variant === "public" ? (
        <p className="text-xs leading-relaxed text-neutral-500">{pill.publicHelper}</p>
      ) : pill.helper ? (
        <p className="text-xs leading-relaxed text-neutral-500">{pill.helper}</p>
      ) : null}
    </div>
  )
}
