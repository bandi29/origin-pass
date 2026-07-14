"use client"

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import { ChevronDown, QrCode } from "lucide-react"
import clsx from "clsx"
import { STUDIO_LABEL } from "@/components/dashboard/qr-identity/print-labels/constants"
import type { QrStyleId } from "@/components/dashboard/qr-identity/print-labels/types"

/**
 * Presentational helpers shared by the Inspector tab bodies. Extracted verbatim
 * from PrintLabelsStudioClient so the new tab files can reuse them without
 * prop-drilling or circular imports. No behaviour change.
 */

export function qrStyleTileClasses(id: QrStyleId, selected: boolean) {
  const base = "flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition duration-200"
  if (selected) {
    return clsx(
      base,
      "border-brand bg-white shadow-[0_0_0_3px_rgba(11,31,77,0.12)] shadow-md scale-[1.02]",
    )
  }
  return clsx(base, "border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:shadow-sm")
}

export function MiniQrPreview({ styleId }: { styleId: QrStyleId }) {
  const inner = clsx(
    "flex h-14 w-14 items-center justify-center",
    styleId === "dot" && "rounded-2xl border-2 border-dashed border-slate-400 bg-white",
    styleId === "shield" && "rounded-lg bg-slate-900 text-white",
    styleId === "minimal" && "rounded-md border border-slate-300 bg-white",
    styleId === "luxury" && "rounded-lg border border-amber-200/80 bg-gradient-to-br from-slate-50 to-amber-50/40 shadow-inner",
    styleId === "classic" && "rounded-md border-2 border-slate-800 bg-white",
  )
  return (
    <div className={inner}>
      <QrCode className={clsx("h-8 w-8", styleId === "shield" ? "text-white" : "text-slate-800")} aria-hidden />
    </div>
  )
}

const STUDIO_POPOVER_TRIGGER =
  "relative w-full min-w-0 cursor-pointer rounded-lg border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

export function StudioValuePopover({
  icon: Icon,
  label,
  valueDisplay,
  children,
  alignPopover = "full",
  variant = "full",
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  valueDisplay: string
  children: ReactNode
  /** Widen popover for long controls */
  alignPopover?: "full" | "left"
  /** Icon + value only (tooltips via title / aria-label) */
  variant?: "full" | "iconOnly"
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  return (
    <div className={clsx("relative min-w-0", alignPopover === "left" && "z-[55]")} ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        title={label}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          STUDIO_POPOVER_TRIGGER,
          variant === "full"
            ? "flex h-10 min-h-10 items-center gap-2 px-4 py-0 pr-10 leading-normal"
            : "flex h-10 min-h-10 items-center justify-center gap-1.5 px-2 py-0 leading-normal",
          open && "border-blue-500 ring-2 ring-blue-500/20",
        )}
      >
        <Icon
          className={clsx("shrink-0 text-slate-500", variant === "iconOnly" ? "h-4 w-4" : "h-3.5 w-3.5")}
          aria-hidden
        />
        {variant === "full" ? (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            <p className={clsx(STUDIO_LABEL, "leading-none")}>{label}</p>
            <p className="truncate text-sm font-semibold tabular-nums tracking-tight text-slate-900 leading-normal">
              {valueDisplay}
            </p>
          </div>
        ) : (
          <span className="truncate text-xs font-semibold tabular-nums leading-normal text-slate-900">
            {valueDisplay}
          </span>
        )}
        {variant === "full" ? (
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        ) : null}
      </button>
      {open ? (
        <div
          className={clsx(
            "absolute top-[calc(100%+6px)] z-[60] rounded-sm border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-slate-900/5",
            alignPopover === "full" ? "left-0 right-0" : "left-0 w-[min(18rem,calc(100vw-2rem))]",
          )}
          role="dialog"
          aria-label={`Adjust ${label}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
