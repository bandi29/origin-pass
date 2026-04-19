"use client"

import { useState } from "react"
import { Download, ShieldCheck, Loader2 } from "lucide-react"

interface ComplianceExportButtonProps {
  batchId: string
  batchName?: string
}

function toFriendlyExportError(message: string): string {
  const text = message.toLowerCase()
  if (text.includes("unauthorized")) return "Your session has expired. Please sign in again."
  if (text.includes("network")) return "Network issue detected. Check your connection and retry."
  return "We couldn't download the export right now. Please try again."
}

/**
 * Extracts filename from Content-Disposition header, or returns a default.
 */
function getFilenameFromResponse(response: Response): string {
  const disposition = response.headers.get("Content-Disposition")
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/)
    if (match) return match[1]
  }
  return `originpass-dpp-export-${Date.now()}.zip`
}

/**
 * Triggers a blob download without freezing the UI.
 * Uses requestAnimationFrame to yield to the browser during large downloads.
 */
async function downloadBlob(url: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Unauthorized" : "Export failed")
  }

  const blob = await response.blob()
  const filename = getFilenameFromResponse(response)

  // Yield to browser before creating object URL (helps with large files)
  await new Promise((resolve) => requestAnimationFrame(resolve))

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = objectUrl
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}

export default function ComplianceExportButton({
  batchId,
}: ComplianceExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/batches/${batchId}/compliance-export`
      await downloadBlob(url)
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
          className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Per-serial JSON-LD archive
        </button>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800"
          title="Your data is portable and follows open standards"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          One JSON file per serial + manifest
        </span>
      </div>
      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      <p className="text-xs text-slate-400">
        Prefer the Compliance package above for JSON-LD + CSV + PDF in one download.
      </p>
    </div>
  )
}
