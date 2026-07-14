"use client"

import clsx from "clsx"
import {
  ArrowLeftRight,
  Box,
  Columns2,
  Hash,
  LayoutGrid,
  Link2,
  Rows2,
  Smartphone,
  Tag,
  Unlink2,
} from "lucide-react"
import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import { StudioValuePopover } from "@/components/dashboard/qr-identity/print-labels/inspector-shared"
import { MarginVisualizer } from "@/components/dashboard/qr-identity/print-labels/MarginVisualizer"
import { formatLengthFromMm } from "@/components/dashboard/qr-identity/print-labels/layout-utils"
import { STUDIO_LABEL, INSPECTOR_CONTROL } from "@/components/dashboard/qr-identity/print-labels/constants"
import type { PreviewMode } from "@/components/dashboard/qr-identity/print-labels/types"

const STRUCTURES: { id: PreviewMode; label: string; Icon: typeof Smartphone }[] = [
  { id: "single", label: "Single", Icon: Smartphone },
  { id: "sheet", label: "Sheet", Icon: LayoutGrid },
  { id: "hangtag", label: "Tag", Icon: Tag },
  { id: "packaging", label: "Box", Icon: Box },
]

export function LayoutTab() {
  const {
    layoutUnit,
    setLayoutUnit,
    previewMode,
    setPreviewMode,
    selectedTemplate,
    setTemplateModalOpen,
    duplicateCurrentTemplate,
    openSaveTemplateDialog,
    saveTemplateBlockedReason,
    templateMutationPending,
    cellWidthMm,
    setCellWidthMm,
    cellHeightMm,
    setCellHeightMm,
    dimensionsLinked,
    setDimensionsLinked,
    aspectRatioRef,
    labelGapPx,
    setLabelGapPx,
    quantity,
    setQuantity,
    quantityInputId,
    selectedProducts,
    batchId,
  } = useInspector()

  return (
    <div className="space-y-5">
      {/* Units */}
      <div className="flex items-center justify-between">
        <span className={STUDIO_LABEL}>Units</span>
        <div className="flex gap-0.5 rounded-[10px] bg-[#F1EEE7] p-[3px]" role="group" aria-label="Measurement unit">
          {(["mm", "in", "px"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setLayoutUnit(u)}
              className={clsx(
                "rounded-lg px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide transition",
                layoutUnit === u
                  ? "bg-white text-[#0E1B2A] shadow-[0_1px_2px_rgba(14,27,42,0.05)]"
                  : "text-[#6B7079] hover:text-[#15293E]",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Layout structure */}
      <div>
        <p className={`${STUDIO_LABEL} mb-2.5`}>Layout structure</p>
        <div className="grid grid-cols-4 gap-2">
          {STRUCTURES.map(({ id, label, Icon }) => {
            const on = previewMode === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewMode(id)}
                aria-pressed={on}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-1 pb-2 pt-3 transition duration-150",
                  on
                    ? "border-[#0E1B2A] bg-[#0E1B2A] text-white shadow-[0_6px_24px_-8px_rgba(14,27,42,0.18)]"
                    : "border-[#E7E2D7] bg-white text-[#6B7079] hover:border-[#15293E] hover:text-[#15293E]",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[11.5px] font-semibold">{label}</span>
              </button>
            )
          })}
        </div>
        <p className={`${STUDIO_LABEL} mt-3 leading-relaxed`}>
          Batch #{batchId ?? "—"} · {selectedProducts.length || "—"} selected · {quantity} qty/SKU
        </p>
      </div>

      {/* Template card */}
      <div className="rounded-2xl border border-[#E7E2D7] bg-gradient-to-b from-white to-[#FBFAF6] p-3.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#9AA0A8]">Current template</p>
        <p className="mt-0.5 font-serif text-[17px] font-semibold text-[#0E1B2A]">{selectedTemplate?.name ?? "—"}</p>
        <p className="text-[12.5px] text-[#6B7079]">{selectedTemplate?.dimensions ?? "—"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTemplateModalOpen(true)}
            className="rounded-[9px] bg-[#0E1B2A] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#15293E]"
          >
            Change
          </button>
          <button
            type="button"
            onClick={() => void duplicateCurrentTemplate()}
            disabled={templateMutationPending}
            className="rounded-[9px] border border-[#E7E2D7] bg-white px-4 py-2 text-[13px] font-semibold text-[#15293E] transition hover:border-[#15293E] disabled:opacity-40"
          >
            Duplicate
          </button>
        </div>
      </div>

      {/* Margins */}
      <div className="border-t border-[#EFEBE2] pt-4">
        <p className={`${STUDIO_LABEL} mb-2.5`}>Page margins</p>
        <MarginVisualizer />
      </div>

      {/* Cell size */}
      <div className="border-t border-[#EFEBE2] pt-4">
        <p className={`${STUDIO_LABEL} mb-2`}>Cell size</p>
        <div className="flex items-stretch gap-1.5">
          <div className="min-w-0 flex-1">
            <StudioValuePopover variant="iconOnly" icon={Columns2} label="Label cell width" valueDisplay={formatLengthFromMm(cellWidthMm, layoutUnit)}>
              <input
                type="range"
                min={40}
                max={110}
                step={0.5}
                value={cellWidthMm}
                onChange={(e) => {
                  const w = Number(e.target.value)
                  setCellWidthMm(w)
                  if (dimensionsLinked) setCellHeightMm(w / aspectRatioRef.current)
                }}
                className="w-full accent-brand"
              />
              <p className="mt-2 text-center text-[10px] text-slate-500">{formatLengthFromMm(cellWidthMm, layoutUnit)}</p>
            </StudioValuePopover>
          </div>
          <button
            type="button"
            title={dimensionsLinked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            aria-label={dimensionsLinked ? "Unlock aspect ratio" : "Lock aspect ratio"}
            aria-pressed={dimensionsLinked}
            onClick={() =>
              setDimensionsLinked((prev) => {
                if (!prev) aspectRatioRef.current = cellWidthMm / Math.max(cellHeightMm, 0.001)
                return !prev
              })
            }
            className={clsx(INSPECTOR_CONTROL, "flex h-auto min-w-[2.5rem] shrink-0 items-center justify-center px-0 py-0")}
          >
            {dimensionsLinked ? <Link2 className="h-4 w-4 text-brand" aria-hidden /> : <Unlink2 className="h-4 w-4 text-slate-400" aria-hidden />}
          </button>
          <div className="min-w-0 flex-1">
            <StudioValuePopover variant="iconOnly" icon={Rows2} label="Label cell height" valueDisplay={formatLengthFromMm(cellHeightMm, layoutUnit)}>
              <input
                type="range"
                min={15}
                max={55}
                step={0.5}
                value={cellHeightMm}
                onChange={(e) => {
                  const h = Number(e.target.value)
                  setCellHeightMm(h)
                  if (dimensionsLinked) setCellWidthMm(h * aspectRatioRef.current)
                }}
                className="w-full accent-brand"
              />
              <p className="mt-2 text-center text-[10px] text-slate-500">{formatLengthFromMm(cellHeightMm, layoutUnit)}</p>
            </StudioValuePopover>
          </div>
        </div>
      </div>

      {/* Gap + quantity */}
      <div className="border-t border-[#EFEBE2] pt-4">
        <div className="grid grid-cols-2 gap-2">
          <StudioValuePopover variant="iconOnly" icon={ArrowLeftRight} label="Horizontal spacing between labels" valueDisplay={`${labelGapPx}px`}>
            <input
              type="range"
              min={4}
              max={24}
              step={2}
              value={labelGapPx}
              onChange={(e) => setLabelGapPx(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <p className="mt-2 text-center text-[10px] text-slate-500">{labelGapPx}px gap</p>
          </StudioValuePopover>
          <StudioValuePopover variant="iconOnly" icon={Hash} label="Quantity per SKU" valueDisplay={String(quantity)}>
            <label htmlFor={quantityInputId} className="sr-only">
              Quantity per SKU
            </label>
            <input
              id={quantityInputId}
              type="number"
              min={1}
              max={9999}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className={`${INSPECTOR_CONTROL} h-10 w-full font-semibold tabular-nums`}
            />
          </StudioValuePopover>
        </div>
      </div>

      <button
        type="button"
        onClick={openSaveTemplateDialog}
        disabled={Boolean(saveTemplateBlockedReason) || templateMutationPending}
        title={saveTemplateBlockedReason ?? undefined}
        className="w-full rounded-[13px] border-[1.5px] border-dashed border-[#E7E2D7] bg-white py-3 text-[13px] font-semibold text-[#6B7079] transition hover:border-[#356B4E] hover:text-[#356B4E] disabled:cursor-not-allowed disabled:opacity-40"
      >
        ＋ Save layout as template…
      </button>
    </div>
  )
}
