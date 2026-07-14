"use client"

import clsx from "clsx"
import {
  passportLinkStatus,
  passportStatusLabel,
  type PassportLinkStatus,
} from "@/components/dashboard/qr-identity/label-studio/product-utils"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"

export function PassportStatusDot({
  product,
  status: statusProp,
  className,
}: {
  product?: ProductPrintCandidate
  status?: PassportLinkStatus
  className?: string
}) {
  const status = statusProp ?? (product ? passportLinkStatus(product) : "awaiting")
  const label = passportStatusLabel(status)
  const linked = status === "linked"

  return (
    <span
      className={clsx("inline-flex items-center gap-1.5", className)}
      title={label}
    >
      <span className="relative inline-flex h-2 w-2 shrink-0">
        {!linked ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B9722B]/50 motion-reduce:animate-none" />
        ) : null}
        <span
          className={clsx(
            "relative inline-flex h-2 w-2 rounded-full",
            linked ? "bg-[#356B4E]" : "bg-[#B9722B]",
          )}
          aria-hidden
        />
      </span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
