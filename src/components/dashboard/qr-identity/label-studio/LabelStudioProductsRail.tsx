"use client"

import clsx from "clsx"
import { Package2, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { LabelStudioSelectedProductCard } from "@/components/dashboard/qr-identity/label-studio/LabelStudioSelectedProductCard"

export function LabelStudioProductsRail({
  collapsed,
  onToggleCollapse,
  onOpenPicker,
  selectedProducts,
  onRemoveProduct,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenPicker: (trigger?: HTMLElement | null) => void
  selectedProducts: ProductPrintCandidate[]
  onRemoveProduct: (id: string) => void
}) {
  const selectionCount = selectedProducts.length

  if (collapsed) {
    return (
      <aside
        className="flex h-full min-h-0 w-14 shrink-0 flex-col items-center overflow-hidden border-r border-[#E7E2D7] bg-[#FCFBF8] py-3"
        aria-label="Products"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-lg p-2 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
          aria-label="Expand products rail"
        >
          <PanelLeftOpen className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => onOpenPicker(e.currentTarget)}
          className="relative mt-4 flex flex-col items-center gap-1 rounded-lg p-2 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
          aria-label={`${selectionCount} products selected. Add or edit products`}
        >
          <Package2 className="h-5 w-5" aria-hidden />
          <span
            className={clsx(
              "min-w-[1.125rem] rounded-full px-1 text-center text-[10px] font-bold tabular-nums",
              selectionCount > 0 ? "bg-[#356B4E] text-white" : "bg-[#F1EEE7] text-[#6B7079]",
            )}
          >
            {selectionCount}
          </span>
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="flex h-full min-h-0 w-[224px] min-w-[224px] shrink-0 flex-col overflow-hidden border-r border-[#E7E2D7] bg-[#FCFBF8] lg:w-[248px] lg:min-w-[248px]"
      aria-label="Products rail"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#E7E2D7] px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-serif text-sm font-semibold text-[#0E1B2A]">Products</h2>
          <span
            className={clsx(
              "inline-flex min-w-[1.375rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
              selectionCount > 0
                ? "bg-[#E7F0EA] text-[#27543D] ring-1 ring-[#356B4E]/25"
                : "bg-[#F1EEE7] text-[#6B7079] ring-1 ring-[#E7E2D7]",
            )}
            aria-label={`${selectionCount} selected`}
          >
            {selectionCount}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="rounded-lg p-1.5 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
          aria-label="Collapse products rail"
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
        <button
          type="button"
          onClick={(e) => onOpenPicker(e.currentTarget)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#C9C2B4] bg-white/50 px-3 py-2.5 text-sm font-semibold text-[#356B4E] transition hover:border-[#356B4E]/50 hover:bg-[#E7F0EA]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add products
        </button>

        {selectionCount === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#E7E2D7] bg-white/40 px-3 py-8 text-center">
            <Package2 className="h-8 w-8 text-[#D8D3C7]" aria-hidden />
            <p className="mt-3 text-xs font-medium text-[#15293E]">No products selected</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#6B7079]">
              Add products to configure labels and export.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Selected products">
            {selectedProducts.map((p) => (
              <LabelStudioSelectedProductCard
                key={p.id}
                product={p}
                onRemove={() => onRemoveProduct(p.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
