"use client"

import { useId, useState } from "react"
import { Download, Loader2, X } from "lucide-react"
import type { PrintLayoutType } from "@/components/pdf/PrintLayouts"

type ExportMode = "sheet-pdf" | "single-png" | "single-svg"

const MODE_OPTIONS: Array<{ value: ExportMode; label: string; hint: string }> = [
  {
    value: "single-png",
    label: "Single PNG (300 DPI)",
    hint: "High-res raster QR for Canva / factory artwork",
  },
  {
    value: "single-svg",
    label: "Single SVG (vector)",
    hint: "Scalable vector QR for hangtags and packaging",
  },
  {
    value: "sheet-pdf",
    label: "Printable label sheet (PDF)",
    hint: "Hangtag, Avery 5160, or thermal layouts",
  },
]

const LAYOUT_OPTIONS: Array<{ value: PrintLayoutType; label: string; hint: string }> = [
  {
    value: "hangtag-2x3",
    label: '2x3" Hangtag',
    hint: "Single apparel hangtag (2in x 3in)",
  },
  {
    value: "thermal-4x6",
    label: '4x6" Thermal Label',
    hint: "Shipping / packaging insert (4in x 6in)",
  },
  {
    value: "avery-5160",
    label: "Avery 5160 Sheet",
    hint: "US Letter - 30 stickers (3x10), 1in x 2.625in",
  },
]

type Props = {
  open: boolean
  onClose: () => void
  passportId: string
  /** Prefill variant / product GTIN for the GS1 Digital Link. */
  defaultVariantGtin?: string
  serialNumber: string
}

/**
 * Export modal: single PNG/SVG QR assets or print-ready PDF label sheets.
 */
export function ExportPdfModal({
  open,
  onClose,
  passportId,
  defaultVariantGtin = "",
  serialNumber,
}: Props) {
  const titleId = useId()
  const [mode, setMode] = useState<ExportMode>("sheet-pdf")
  const [layoutType, setLayoutType] = useState<PrintLayoutType>("hangtag-2x3")
  const [variantGtin, setVariantGtin] = useState(defaultVariantGtin)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function downloadBlob(res: Response, fallbackName: string) {
    const blob = await res.blob()
    const disposition = res.headers.get("Content-Disposition") ?? ""
    const match = /filename="([^"]+)"/i.exec(disposition)
    const filename = match?.[1] || fallbackName
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleDownload() {
    setBusy(true)
    setError(null)
    try {
      const gtin = variantGtin.trim()

      if (mode === "single-png" || mode === "single-svg") {
        const format = mode === "single-png" ? "png" : "svg"
        const params = new URLSearchParams({ format })
        if (gtin) params.set("variantGtin", gtin)
        const res = await fetch(
          `/api/admin/passports/${passportId}/export-qr?${params.toString()}`,
          { method: "GET", credentials: "same-origin" },
        )
        if (!res.ok) {
          let message = "Could not generate QR asset."
          try {
            const body = (await res.json()) as { error?: string }
            if (body.error) message = body.error
          } catch {
            /* ignore */
          }
          setError(message)
          return
        }
        await downloadBlob(res, `passport-${serialNumber}-qr.${format}`)
        onClose()
        return
      }

      const params = new URLSearchParams({ layoutType })
      if (gtin) params.set("variantGtin", gtin)

      const res = await fetch(`/api/admin/passports/${passportId}/export-pdf?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
      })

      if (!res.ok) {
        let message = "Could not generate PDF."
        try {
          const body = (await res.json()) as { error?: string }
          if (body.error) message = body.error
        } catch {
          /* ignore */
        }
        setError(message)
        return
      }

      await downloadBlob(res, `passport-${serialNumber}-${layoutType}.pdf`)
      onClose()
    } catch {
      setError("Network error while downloading.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Print &amp; Export QR
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Download a single high-res QR or a print-ready hangtag / Avery label sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium text-slate-700">Export type</legend>
          {MODE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                mode === opt.value
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="exportMode"
                value={opt.value}
                checked={mode === opt.value}
                onChange={() => setMode(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
                <span className="block text-xs text-slate-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "sheet-pdf" ? (
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-medium text-slate-700">Layout format</legend>
            {LAYOUT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                  layoutType === opt.value
                    ? "border-slate-900 bg-slate-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="layoutType"
                  value={opt.value}
                  checked={layoutType === opt.value}
                  onChange={() => setLayoutType(opt.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
                  <span className="block text-xs text-slate-500">{opt.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <label htmlFor="export-variant-gtin" className="text-sm font-medium text-slate-700">
            Target Variant GTIN <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="export-variant-gtin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={variantGtin}
            onChange={(e) => setVariantGtin(e.target.value)}
            placeholder="Defaults to product / variant GTIN on file"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {mode === "sheet-pdf" ? "Download PDF" : "Download"}
          </button>
        </div>
      </div>
    </div>
  )
}

/** @deprecated Prefer ExportPdfModal */
export { ExportPdfModal as ExportPrintPdfModal }
