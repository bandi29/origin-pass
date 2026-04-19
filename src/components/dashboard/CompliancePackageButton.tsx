"use client"

import { useState } from "react"
import { Download, Loader2, FileArchive } from "lucide-react"

interface Props {
  batchId: string
}

function friendlyError(message: string): string {
  const t = message.toLowerCase()
  if (t.includes("unauthorized")) return "Your session has expired. Please sign in again."
  if (t.includes("no items")) return "Add at least one code to this batch before downloading the package."
  return "We couldn't build the compliance package. Please try again."
}

function filenameFromResponse(response: Response): string {
  const disposition = response.headers.get("Content-Disposition")
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/)
    if (match) return match[1]
  }
  return `originpass-compliance-package-${Date.now()}.zip`
}

async function downloadZip(url: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || "Export failed")
  }
  const blob = await response.blob()
  const filename = filenameFromResponse(response)
  await new Promise((r) => requestAnimationFrame(r))
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

export function CompliancePackageButton({ batchId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setLoading(true)
    setError(null)
    try {
      await downloadZip(`/api/batches/${batchId}/compliance-package`)
    } catch (e) {
      setError(e instanceof Error ? friendlyError(e.message) : friendlyError(""))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-emerald-900">
            <FileArchive className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <h3 className="text-lg font-semibold tracking-tight">
              Compliance package (July 2026 EU registry)
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            <strong className="font-semibold text-emerald-900">
              OriginPass: One-click compliance for the July 2026 EU Registry.
            </strong>{" "}
            Download a single .zip with machine-readable JSON-LD (customs-ready), a CSV of material
            components, and an originality certificate PDF for your customer.
          </p>
          <p className="text-xs text-slate-500">
            New EU rules expect structured data (JSON/XML)—a PDF alone is not enough for many registry
            submissions.
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          Compliance package (.zip)
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  )
}
