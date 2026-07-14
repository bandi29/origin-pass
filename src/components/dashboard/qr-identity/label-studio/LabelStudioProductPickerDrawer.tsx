"use client"

import { useRef } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { Search, X } from "lucide-react"
import type { ProductPrintCandidate } from "@/lib/label-print-studio-server-data"
import { LabelStudioProductThumb } from "@/components/dashboard/qr-identity/label-studio/LabelStudioProductThumb"
import { PassportStatusDot } from "@/components/dashboard/qr-identity/label-studio/PassportStatusDot"
import {
  productMetaLine,
  productPrimaryLabel,
} from "@/components/dashboard/qr-identity/label-studio/product-utils"

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "rounded-full border px-3 py-1 text-xs font-semibold transition",
        active
          ? "border-[#356B4E] bg-[#E7F0EA] text-[#27543D]"
          : "border-[#E7E2D7] bg-white text-[#6B7079] hover:border-[#C9C2B4] hover:text-[#15293E]",
      )}
    >
      {label}
    </button>
  )
}

function CatalogRow({
  product,
  selected,
  onToggle,
}: {
  product: ProductPrintCandidate
  selected: boolean
  onToggle: () => void
}) {
  const name = productPrimaryLabel(product)
  const meta = productMetaLine(product)

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-[#E7E2D7] hover:bg-white">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-[#D8D3C7] text-[#356B4E] focus:ring-[#356B4E]/30"
        aria-label={`Select ${name}`}
      />
      <LabelStudioProductThumb product={product} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-[#15293E]">{name}</span>
          <PassportStatusDot product={product} />
        </span>
        {meta ? (
          <span className="mt-0.5 block truncate font-mono text-[11px] text-[#9AA0A8]">{meta}</span>
        ) : null}
      </span>
    </label>
  )
}

export function LabelStudioProductPickerDrawer({
  open,
  onOpenChange,
  returnFocusRef,
  products,
  filteredProducts,
  productSearch,
  onProductSearchChange,
  verifiedOnly,
  onVerifiedOnlyChange,
  activeOnly,
  onActiveOnlyChange,
  batchOnly,
  onBatchOnlyChange,
  isSelected,
  onToggleProduct,
  selectionCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Element to restore focus when the drawer closes (Esc, overlay, Done). */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  products: ProductPrintCandidate[]
  filteredProducts: ProductPrintCandidate[]
  productSearch: string
  onProductSearchChange: (value: string) => void
  verifiedOnly: boolean
  onVerifiedOnlyChange: (value: boolean) => void
  activeOnly: boolean
  onActiveOnlyChange: (value: boolean) => void
  batchOnly: boolean
  onBatchOnlyChange: (value: boolean) => void
  isSelected: (id: string) => boolean
  onToggleProduct: (id: string) => void
  selectionCount: number
}) {
  const searchRef = useRef<HTMLInputElement>(null)

  const restoreTriggerFocus = (event: Event) => {
    const el = returnFocusRef?.current
    if (el?.isConnected) {
      event.preventDefault()
      el.focus()
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[260] bg-[#0E1B2A]/40 backdrop-blur-[2px] transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <Dialog.Content
          className={clsx(
            "fixed left-0 top-0 z-[270] flex h-full w-full max-w-[min(100%,420px)] flex-col border-r border-[#E7E2D7] bg-[#FCFBF8] shadow-2xl outline-none",
            "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0",
          )}
          aria-describedby="label-studio-picker-desc"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
          onCloseAutoFocus={restoreTriggerFocus}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E7E2D7] px-4 py-4">
            <div>
              <Dialog.Title className="font-serif text-lg font-semibold text-[#0E1B2A]">
                Select products
              </Dialog.Title>
              <Dialog.Description
                id="label-studio-picker-desc"
                className="mt-0.5 text-sm text-[#6B7079]"
              >
                {products.length} in catalog · toggle to add or remove from this print run
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rounded-lg p-2 text-[#6B7079] transition hover:bg-[#F1EEE7] hover:text-[#0E1B2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
              aria-label="Close product picker"
            >
              <X className="h-5 w-5" aria-hidden />
            </Dialog.Close>
          </div>

          <div className="shrink-0 space-y-3 border-b border-[#E7E2D7] px-4 py-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA0A8]"
                aria-hidden
              />
              <input
                ref={searchRef}
                type="search"
                value={productSearch}
                onChange={(e) => onProductSearchChange(e.target.value)}
                placeholder="Search name, SKU, category…"
                className="w-full rounded-xl border border-[#E7E2D7] bg-white py-2.5 pl-9 pr-3 text-sm text-[#15293E] placeholder:text-[#9AA0A8] focus:border-[#356B4E]/50 focus:outline-none focus:ring-2 focus:ring-[#356B4E]/15"
                aria-label="Search products"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Product filters">
              <FilterChip
                label="Verified"
                active={verifiedOnly}
                onClick={() => onVerifiedOnlyChange(!verifiedOnly)}
              />
              <FilterChip
                label="Active"
                active={activeOnly}
                onClick={() => onActiveOnlyChange(!activeOnly)}
              />
              <FilterChip
                label="Batch"
                active={batchOnly}
                onClick={() => onBatchOnlyChange(!batchOnly)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {filteredProducts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-[#6B7079]">
                No products match your search or filters.
              </p>
            ) : (
              <ul className="space-y-0.5" aria-label="Product catalog">
                {filteredProducts.map((p) => (
                  <li key={p.id}>
                    <CatalogRow
                      product={p}
                      selected={isSelected(p.id)}
                      onToggle={() => onToggleProduct(p.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E7E2D7] bg-white px-4 py-3">
            <p className="text-sm text-[#6B7079]">
              <span className="font-semibold tabular-nums text-[#15293E]">{selectionCount}</span>{" "}
              selected
            </p>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-xl bg-[#0E1B2A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15293E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#356B4E]"
              >
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
