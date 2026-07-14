"use client"

import { QrCode, Type } from "lucide-react"
import { useInspector } from "@/components/dashboard/qr-identity/print-labels/inspector-context"
import {
  MiniQrPreview,
  qrStyleTileClasses,
  StudioValuePopover,
} from "@/components/dashboard/qr-identity/print-labels/inspector-shared"
import { StudioNativeSelect } from "@/components/ui/StudioNativeSelect"
import { STUDIO_LABEL, INSPECTOR_CONTROL } from "@/components/dashboard/qr-identity/print-labels/constants"
import type { QrStyleId } from "@/components/dashboard/qr-identity/print-labels/types"
import { prepareLogoForTemplateSnapshot } from "@/lib/labels/logo-snapshot-utils"
import { useToast } from "@/components/ui/Toast"

const QR_STYLES: { id: QrStyleId; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "dot", label: "Dot" },
  { id: "shield", label: "Shield" },
  { id: "minimal", label: "Minimal" },
  { id: "luxury", label: "Luxury" },
]

const ACCENT_SWATCHES = ["#0E1B2A", "#356B4E", "#7A4B2B", "#B9722B", "#5B6470"]

/** Labeled pill-switch row matching the mockup's "Show on label" toggles. */
function SwitchRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-[#EFEBE2] py-2.5 last:border-b-0">
      <span className="text-[13.5px] font-medium text-[#15293E]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-[#356B4E]" : "bg-[#D8D3C7]"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(14,27,42,0.2)] transition-all duration-200 ${on ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}

export function BrandingTab() {
  const toast = useToast()
  const {
    studioFieldId,
    footerTextInputId,
    qrStyle,
    setQrStyle,
    showQrCode,
    setShowQrCode,
    showProductName,
    setShowProductName,
    showLogo,
    setShowLogo,
    qrSizeInches,
    setQrSizeInches,
    labelTextPt,
    setLabelTextPt,
    brandColor,
    setBrandColor,
    borderStyle,
    setBorderStyle,
    typographyStyle,
    setTypographyStyle,
    footerText,
    setFooterText,
    logoDataUrl,
    setLogoDataUrl,
  } = useInspector()

  return (
    <div className="space-y-4">
      {/* Encode style */}
      <div>
        <p className={`${STUDIO_LABEL} mb-2`}>Encode style</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {QR_STYLES.map((s) => (
            <button key={s.id} type="button" onClick={() => setQrStyle(s.id)} className={qrStyleTileClasses(s.id, qrStyle === s.id)}>
              <MiniQrPreview styleId={s.id} />
              <span className="text-[10px] font-medium tracking-wide text-slate-700">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Show on label */}
      <div className="border-t border-[#EFEBE2] pt-3">
        <p className={`${STUDIO_LABEL} mb-1`}>Show on label</p>
        <SwitchRow label="QR code" on={showQrCode} onToggle={() => setShowQrCode((v) => !v)} />
        <SwitchRow label="Brand logo" on={showLogo} onToggle={() => setShowLogo((v) => !v)} />
        <SwitchRow label="Product name & SKU" on={showProductName} onToggle={() => setShowProductName((v) => !v)} />
      </div>

      {/* QR size + text size */}
      <div className="border-t border-[#EFEBE2] pt-3">
        <div className="grid grid-cols-2 gap-2">
          <StudioValuePopover variant="iconOnly" icon={QrCode} label="QR module size" valueDisplay={`${qrSizeInches.toFixed(2)} in`}>
            <input
              type="range"
              min={60}
              max={175}
              step={5}
              value={Math.round(qrSizeInches * 100)}
              onChange={(e) => setQrSizeInches(Number(e.target.value) / 100)}
              className="w-full accent-brand"
            />
            <p className="mt-2 text-center text-[10px] tabular-nums text-slate-500">{qrSizeInches.toFixed(2)} in</p>
          </StudioValuePopover>
          <StudioValuePopover variant="iconOnly" icon={Type} label="Product line type size" valueDisplay={`${labelTextPt} pt`}>
            <input
              type="range"
              min={7}
              max={14}
              step={1}
              value={labelTextPt}
              onChange={(e) => setLabelTextPt(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <p className="mt-2 text-center text-[10px] tabular-nums text-slate-500">{labelTextPt} pt</p>
          </StudioValuePopover>
        </div>
      </div>

      {/* Accent color */}
      <div className="border-t border-[#EFEBE2] pt-3">
        <p className={`${STUDIO_LABEL} mb-2`}>Accent color</p>
        <div className="flex items-center gap-2.5">
          {ACCENT_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              aria-pressed={brandColor.toLowerCase() === c.toLowerCase()}
              onClick={() => setBrandColor(c)}
              className={`h-[34px] w-[34px] rounded-[9px] border-2 transition ${
                brandColor.toLowerCase() === c.toLowerCase()
                  ? "border-[#0E1B2A] shadow-[inset_0_0_0_2px_#fff]"
                  : "border-transparent"
              }`}
              style={{ background: c }}
            />
          ))}
          <label className="ml-auto inline-flex items-center gap-2">
            <span className="sr-only">Custom accent color</span>
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className={`${INSPECTOR_CONTROL} h-9 w-11 cursor-pointer p-0`} />
          </label>
        </div>
      </div>

      {/* Border + typeface */}
      <div className="grid grid-cols-2 gap-2 border-t border-[#EFEBE2] pt-3">
        <div>
          <label htmlFor={`${studioFieldId}-border`} className={STUDIO_LABEL}>
            Border
          </label>
          <StudioNativeSelect wrapClassName="mt-1" id={`${studioFieldId}-border`} value={borderStyle} onChange={(e) => setBorderStyle(e.target.value as "none" | "thin" | "premium")}>
            <option value="none">None</option>
            <option value="thin">Hairline</option>
            <option value="premium">Premium</option>
          </StudioNativeSelect>
        </div>
        <div className="col-span-2">
          <label htmlFor={`${studioFieldId}-typography`} className={`${STUDIO_LABEL} flex items-center gap-1`}>
            <Type className="h-3 w-3" aria-hidden />
            Typeface
          </label>
          <StudioNativeSelect wrapClassName="mt-1" id={`${studioFieldId}-typography`} value={typographyStyle} onChange={(e) => setTypographyStyle(e.target.value as "serif" | "sans" | "luxury")}>
            <option value="serif">Editorial serif</option>
            <option value="sans">Modern sans</option>
            <option value="luxury">Luxury display</option>
          </StudioNativeSelect>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#EFEBE2] pt-3">
        <label htmlFor={footerTextInputId} className={STUDIO_LABEL}>
          Label footer text
        </label>
        <input id={footerTextInputId} value={footerText} onChange={(e) => setFooterText(e.target.value)} className={`${INSPECTOR_CONTROL} mt-1 h-9 w-full`} placeholder="Footer on label" />
      </div>

      {/* Logo */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#EFEBE2] pt-3">
        <label className={`${INSPECTOR_CONTROL} inline-flex cursor-pointer px-3 py-1.5 text-xs font-medium text-slate-700`}>
          Upload logo
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const r = new FileReader()
              r.onload = () => {
                void (async () => {
                  const raw = typeof r.result === "string" ? r.result : null
                  if (!raw) return
                  const prepared = await prepareLogoForTemplateSnapshot(raw)
                  if (!prepared) {
                    toast.error("Logo must be an image under 100KB after compression.")
                    return
                  }
                  setLogoDataUrl(prepared)
                })()
              }
              r.readAsDataURL(f)
              e.target.value = ""
            }}
          />
        </label>
        {logoDataUrl ? (
          <button type="button" className="text-xs font-medium text-rose-700" onClick={() => setLogoDataUrl(null)}>
            Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}
