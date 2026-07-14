"use client"

import { X } from "lucide-react"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { LabelStudioProductThumb } from "@/components/dashboard/qr-identity/label-studio/LabelStudioProductThumb"
import { PassportStatusDot } from "@/components/dashboard/qr-identity/label-studio/PassportStatusDot"
import {
  productMetaLine,
  productPrimaryLabel,
} from "@/components/dashboard/qr-identity/label-studio/product-utils"

export function LabelStudioSelectedProductCard({
  product,
  onRemove,
}: {
  product: ProductPrintCandidate
  onRemove: () => void
}) {
  const meta = productMetaLine(product)
  const name = productPrimaryLabel(product)

  return (
    <li className="group relative">
      <div className="flex items-start gap-2 rounded-xl border border-[#EFEBE2] bg-white px-2 py-2 pr-8 shadow-sm transition hover:border-[#E7E2D7]">
        <LabelStudioProductThumb product={product} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-xs font-semibold text-[#15293E]">{name}</p>
            <PassportStatusDot product={product} className="mt-0.5 shrink-0" />
          </div>
          {meta ? (
            <p className="mt-0.5 truncate font-mono text-[10px] text-[#9AA0A8]">{meta}</p>
          ) : (
            <p className="mt-0.5 text-[10px] text-[#9AA0A8]">No SKU</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-[#9AA0A8] opacity-0 transition hover:bg-[#FBEEDD] hover:text-[#B9722B] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#356B4E] group-hover:opacity-100"
        aria-label={`Remove ${name} from selection`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  )
}
