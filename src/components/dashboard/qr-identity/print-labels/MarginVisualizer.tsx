"use client"

import clsx from "clsx"
import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { formatLengthFromMm } from "@/components/dashboard/qr-identity/print-labels/layout-utils"

/** Pill toggle that matches the mockup's switch. */
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={clsx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-[#356B4E]" : "bg-[#D8D3C7]",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(14,27,42,0.2)] transition-all duration-200",
          on ? "left-[18px]" : "left-0.5",
        )}
      />
    </button>
  )
}

function Stepper({ onDec, onInc }: { onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label="Decrease"
        onClick={onDec}
        className="grid h-[22px] w-[22px] place-items-center rounded-md border border-[#E7E2D7] bg-white text-[#6B7079] transition hover:border-[#15293E] hover:text-[#0E1B2A]"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Increase"
        onClick={onInc}
        className="grid h-[22px] w-[22px] place-items-center rounded-md border border-[#E7E2D7] bg-white text-[#6B7079] transition hover:border-[#15293E] hover:text-[#0E1B2A]"
      >
        +
      </button>
    </div>
  )
}

/**
 * Page-margin editor. Presents the four values around a labelled rectangle (T/R/B/L)
 * with a "link all sides" toggle and steppers, binding to the same margin state as
 * before via context.
 */
export function MarginVisualizer() {
  const {
    layoutUnit,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    setMarginTop,
    setMarginRight,
    setMarginBottom,
    setMarginLeft,
    marginsLinked,
    setMarginsLinked,
    setAllMargins,
  } = useInspector()

  const clamp = (v: number) => Math.max(0, Math.min(20, v))
  const stepAll = (delta: number) => setAllMargins(clamp(marginTop + delta))

  const sideRows: { key: string; label: string; value: number; set: (v: number) => void }[] = [
    { key: "top", label: "Top", value: marginTop, set: setMarginTop },
    { key: "right", label: "Right", value: marginRight, set: setMarginRight },
    { key: "bottom", label: "Bottom", value: marginBottom, set: setMarginBottom },
    { key: "left", label: "Left", value: marginLeft, set: setMarginLeft },
  ]

  return (
    <div className="flex items-start gap-3.5">
      {/* Hatched box with corner tags */}
      <div
        className="relative grid h-24 w-32 shrink-0 place-items-center rounded-xl border-[1.5px] border-dashed border-[#E7E2D7]"
        style={{
          background:
            "repeating-linear-gradient(45deg,#FAF8F3,#FAF8F3 6px,#fff 6px,#fff 12px)",
        }}
        aria-hidden
      >
        <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 rounded-md border border-[#E7E2D7] bg-white px-1.5 py-px text-[10.5px] font-bold tabular-nums text-[#15293E]">
          {marginTop}
        </span>
        <span className="absolute -right-[15px] top-1/2 -translate-y-1/2 rounded-md border border-[#E7E2D7] bg-white px-1.5 py-px text-[10.5px] font-bold tabular-nums text-[#15293E]">
          {marginRight}
        </span>
        <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 rounded-md border border-[#E7E2D7] bg-white px-1.5 py-px text-[10.5px] font-bold tabular-nums text-[#15293E]">
          {marginBottom}
        </span>
        <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 rounded-md border border-[#E7E2D7] bg-white px-1.5 py-px text-[10.5px] font-bold tabular-nums text-[#15293E]">
          {marginLeft}
        </span>
        <div className="h-[54%] w-[58%] rounded-md border-[1.5px] border-[#356B4E] bg-[#E7F0EA]" />
      </div>

      {/* Controls */}
      <div className="min-w-0 flex-1">
        <div className="mb-2.5 flex items-center gap-2 text-xs text-[#6B7079]">
          <Switch on={marginsLinked} onClick={() => setMarginsLinked(!marginsLinked)} label="Link all sides" />
          Link all sides
        </div>

        {marginsLinked ? (
          <div className="flex items-center justify-between rounded-[10px] border border-[#E7E2D7] bg-white px-3 py-2">
            <span className="text-[11.5px] font-semibold tracking-[0.02em] text-[#6B7079]">All sides</span>
            <div className="flex items-center gap-2">
              <Stepper onDec={() => stepAll(-1)} onInc={() => stepAll(1)} />
              <span className="text-sm font-semibold tabular-nums text-[#0E1B2A]">
                {formatLengthFromMm(marginTop, layoutUnit)}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {sideRows.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-[10px] border border-[#E7E2D7] bg-white px-3 py-1.5"
              >
                <span className="text-[11.5px] font-semibold tracking-[0.02em] text-[#6B7079]">{s.label}</span>
                <div className="flex items-center gap-2">
                  <Stepper onDec={() => s.set(clamp(s.value - 1))} onInc={() => s.set(clamp(s.value + 1))} />
                  <span className="w-14 text-right text-sm font-semibold tabular-nums text-[#0E1B2A]">
                    {formatLengthFromMm(s.value, layoutUnit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
