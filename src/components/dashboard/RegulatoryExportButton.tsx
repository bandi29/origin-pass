"use client"

import { useState } from "react"
import { Download, Loader2, Info } from "lucide-react"
import JSZip from "jszip"
import { mapToRegulatoryJsonLd, REGULATORY_README } from "@/lib/regulatory-export"
import type { RegulatoryExportBatchData } from "@/lib/regulatory-export"

function sanitizeForFilename(value: string): string {
  if (!value || typeof value !== "string") return "item"
  return value.replace(/[/\\:*?"<>|]/g, "_").slice(0, 64) || "item"
}

interface RegulatoryExportButtonProps {
  batchId: string
  batchName?: string
}

function toFriendlyExportError(message: string): string {
  const text = message.toLowerCase()
  if (text.includes("unauthorized")) return "Your session has expired. Please sign in again."
  if (text.includes("network")) return "Network issue detected. Check your connection and retry."
  return "We couldn't download the export right now. Please try again."
}

export default function RegulatoryExportButton({
  batchId,
  batchName,
}: RegulatoryExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/batches/${batchId}/regulatory-export-data`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Export failed")
      }

      const data: RegulatoryExportBatchData = await res.json()

      // Client-side ZIP generation (saves server costs)
      const zip = new JSZip()

      // Add README.txt
      zip.file("README.txt", REGULATORY_README)

      // Add one .jsonld file per item
      for (const item of data.items) {
        const jsonLd = mapToRegulatoryJsonLd(item, data)
        zip.file(
          `${sanitizeForFilename(item.serial_id)}.jsonld`,
          JSON.stringify(jsonLd, null, 2)
        )
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const safeName = (batchName ?? batchId.slice(0, 8))
        .replace(/[^\w\s-]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 50)
      const filename = `originpass-regulatory-export-${safeName}.zip`

      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.style.display = "none"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? toFriendlyExportError(e.message) : "We couldn't download the export right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          title="OriginPass ensures your data is interoperable. Download this anytime to move to another platform or for official EU audits."
          className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Download Regulatory Export (.zip)
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 cursor-help"
          title="OriginPass ensures your data is interoperable. Download this anytime to move to another platform or for official EU audits."
        >
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="hidden sm:inline">Interoperable • EU audit-ready</span>
        </span>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <p className="text-xs text-slate-400">
        GS1 JSON-LD • One file per item + README for customs
      </p>
    </div>
  )
}
