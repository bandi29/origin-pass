"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Package2, X } from "lucide-react"
import clsx from "clsx"
import { normalizeFilterProductId, productDisplayLabel } from "@/lib/product-display-label"

export type ProductPickerRow = {
  productId: string
  productName: string | null | undefined
  imageUrl?: string | null
  meta?: string | null
  /** When true, the row shows an "Incomplete" badge and cannot be selected. */
  incomplete?: boolean
}

const listScrollClass = clsx(
  "max-h-60 overflow-y-auto py-1",
  "[&::-webkit-scrollbar]:w-1",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:rounded-full",
  "[&::-webkit-scrollbar-thumb]:bg-slate-200/60",
  "dark:[&::-webkit-scrollbar-thumb]:bg-slate-800/80",
)

const optionBaseClass = clsx(
  "relative flex w-full cursor-pointer select-none items-center gap-2 px-3 py-2 text-left text-xs font-medium",
  "text-slate-700 transition-colors dark:text-slate-300",
  "hover:bg-slate-50 hover:text-slate-950 dark:hover:bg-slate-800/60 dark:hover:text-white",
)

function RowThumb({
  imageUrl,
  productId,
  productName,
}: {
  imageUrl: string | null | undefined
  productId: string
  productName: string | null | undefined
}) {
  const label = productDisplayLabel(productId, productName)
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-md object-cover ring-1 ring-slate-200/90"
        width={16}
        height={16}
      />
    )
  }
  const initial = label.trim().slice(0, 1).toUpperCase() || "·"
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[9px] font-semibold text-slate-500 ring-1 ring-slate-200/90"
      aria-hidden
    >
      {initial}
    </span>
  )
}

export function ProductPickerCombobox({
  items,
  value,
  onChange,
  allowAll = true,
  allLabel = "All Products",
  placeholder = "Filter by Product Name...",
  disabled: disabledProp,
  className,
  /** When true, the dropdown search field receives focus on open (default). Set false to avoid stealing focus from primary actions (e.g. print studio). */
  autoFocusMenu = true,
}: {
  items: ProductPickerRow[]
  value: string | null
  onChange: (productId: string | null) => void
  allowAll?: boolean
  allLabel?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  autoFocusMenu?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [menuQuery, setMenuQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const disabled = disabledProp || items.length === 0

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) setMenuQuery("")
  }, [open])

  const effectiveValue = normalizeFilterProductId(value)

  const selectedRow = effectiveValue
    ? (items.find((p) => p.productId === effectiveValue) ?? {
        productId: effectiveValue,
        productName: null as string | null,
        imageUrl: null as string | null,
        meta: null as string | null,
      })
    : null

  const filteredItems = useMemo(() => {
    const q = menuQuery.trim().toLowerCase()
    const base = [...items].sort((a, b) =>
      productDisplayLabel(a.productId, a.productName).localeCompare(
        productDisplayLabel(b.productId, b.productName),
        undefined,
        { sensitivity: "base" },
      ),
    )
    if (!q) return base
    return base.filter((p) => {
      const label = productDisplayLabel(p.productId, p.productName).toLowerCase()
      const meta = (p.meta ?? "").toLowerCase()
      const id = p.productId.toLowerCase()
      return label.includes(q) || meta.includes(q) || id.includes(q)
    })
  }, [items, menuQuery])

  /** Closed trigger always shows a human label — never a raw UUID. */
  const displayValue = selectedRow
    ? productDisplayLabel(selectedRow.productId, selectedRow.productName)
    : allowAll
      ? allLabel
      : placeholder

  return (
    <div ref={rootRef} className={clsx("relative w-full min-w-0 max-w-md", className)}>
      <div
        className={clsx(
          "flex w-full max-w-full items-stretch overflow-hidden rounded-xl border bg-white ring-1 transition-all duration-200 ease-out",
          disabled
            ? "cursor-not-allowed border-slate-100 ring-slate-100"
            : "border-slate-200 ring-slate-200/90 shadow-sm",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={clsx(
            "flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-medium transition-colors duration-200 ease-out",
            disabled ? "cursor-not-allowed text-slate-400" : "text-slate-900 hover:bg-slate-50",
          )}
        >
          {selectedRow ? (
            <RowThumb
              imageUrl={selectedRow.imageUrl}
              productId={selectedRow.productId}
              productName={selectedRow.productName}
            />
          ) : null}
          <Package2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
          <span
            className={clsx(
              "block min-w-0 flex-1 truncate text-left",
              allowAll && !selectedRow && "font-medium text-slate-700",
              !allowAll && !selectedRow && "text-slate-500",
            )}
          >
            {displayValue}
          </span>
          <ChevronDown
            className={clsx("h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {effectiveValue && allowAll && !disabled ? (
          <button
            type="button"
            className="shrink-0 border-l border-slate-200 px-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={() => onChange(null)}
            aria-label="Clear product filter"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && !disabled ? (
        <div className="absolute left-0 right-0 z-[9999] mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-200/70 dark:border-slate-700 dark:bg-slate-900">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            <input
              {...(autoFocusMenu ? { autoFocus: true } : {})}
              type="text"
              value={menuQuery}
              onChange={(e) => setMenuQuery(e.target.value)}
              placeholder="Search products..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded border-0 bg-slate-50 px-2 py-1.5 text-xs outline-none placeholder:text-slate-400 focus:ring-1 focus:ring-slate-200 dark:bg-slate-950 dark:focus:ring-slate-700"
            />
          </div>
          <div id={listId} role="listbox" className={listScrollClass}>
            {allowAll ? (
              <button
                type="button"
                role="option"
                aria-selected={effectiveValue === null}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className={clsx(
                  optionBaseClass,
                  effectiveValue === null &&
                    "bg-slate-900 font-semibold text-white hover:bg-slate-900 hover:text-white dark:hover:bg-slate-900 dark:hover:text-white",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Package2
                    className={clsx(
                      "h-3.5 w-3.5 shrink-0",
                      effectiveValue === null ? "text-white/80" : "text-slate-400",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{allLabel}</span>
                </span>
                {effectiveValue === null ? <Check className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden /> : null}
              </button>
            ) : null}
            {filteredItems.map((p) => {
              const isOn = effectiveValue === p.productId
              const label = productDisplayLabel(p.productId, p.productName)
              const meta = p.meta?.trim() || null
              const blocked = Boolean(p.incomplete)
              return (
                <button
                  key={p.productId}
                  type="button"
                  role="option"
                  aria-selected={isOn}
                  aria-disabled={blocked || undefined}
                  disabled={blocked}
                  title={blocked ? "Add Origin and a product image before issuing a passport." : undefined}
                  onClick={() => {
                    if (blocked) return
                    onChange(p.productId)
                    setOpen(false)
                  }}
                  className={clsx(
                    optionBaseClass,
                    blocked && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-slate-700",
                    isOn &&
                      "bg-slate-900 font-semibold text-white hover:bg-slate-900 hover:text-white dark:hover:bg-slate-900 dark:hover:text-white",
                  )}
                >
                  <RowThumb imageUrl={p.imageUrl} productId={p.productId} productName={p.productName} />
                  <Package2
                    className={clsx("h-3.5 w-3.5 shrink-0", isOn ? "text-white/80" : "text-slate-400")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="block truncate">{label}</span>
                    {meta ? (
                      <span
                        className={clsx(
                          "mt-0.5 block truncate font-normal",
                          isOn ? "text-white/70" : "text-slate-400",
                        )}
                      >
                        {meta}
                      </span>
                    ) : null}
                  </span>
                  {blocked ? (
                    <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Incomplete
                    </span>
                  ) : isOn ? (
                    <Check className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                  ) : null}
                </button>
              )
            })}
            {filteredItems.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No matching products.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
