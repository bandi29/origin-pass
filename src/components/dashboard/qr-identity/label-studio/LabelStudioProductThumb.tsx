"use client"

import clsx from "clsx"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { productDisplayLabel } from "@/lib/product-display-label"

export function LabelStudioProductThumb({
  product,
  size = "md",
}: {
  product: Pick<ProductPrintCandidate, "id" | "name" | "imageUrl">
  size?: "sm" | "md"
}) {
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8"
  const textSize = size === "md" ? "text-xs" : "text-[10px]"

  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        className={clsx("shrink-0 rounded-lg object-cover ring-1 ring-[#E7E2D7]", dim)}
        width={size === "md" ? 40 : 32}
        height={size === "md" ? 40 : 32}
      />
    )
  }

  const initial =
    productDisplayLabel(product.id, product.name).trim().slice(0, 1).toUpperCase() || "·"

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-lg bg-[#F1EEE7] font-semibold text-[#6B7079] ring-1 ring-[#E7E2D7]",
        dim,
        textSize,
      )}
      aria-hidden
    >
      {initial}
    </span>
  )
}
