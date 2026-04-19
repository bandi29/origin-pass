"use client"

import { useRef, useState } from "react"
import { Loader2, Sparkles, Camera } from "lucide-react"
import type { ComplianceIngestionResult } from "@/lib/ai-photo-passport"
import { complianceIngestionToLegacyProductFormDraft } from "@/lib/photo-passport-merge"
import type { ProductFormDraft } from "@/lib/product-form-draft"

type Props = {
  getCurrentDraft: () => ProductFormDraft
  onApplyDraft: (draft: ProductFormDraft) => void
}

/**
 * Legacy ProductForm accordion: document image → flat draft fields.
 * Compliance “Add product” flow uses inline AI upload in CategoryAwareProductForm.
 */
export function PhotoToPassportCard({ getCurrentDraft, onApplyDraft }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastMeta, setLastMeta] = useState<ComplianceIngestionResult | null>(null)
  const [lastProvider, setLastProvider] = useState<string | null>(null)
  const [lastFileCount, setLastFileCount] = useState(0)

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const files = Array.from(fileList)
    setLoading(true)
    setError(null)
    setLastMeta(null)
    setLastProvider(null)
    setLastFileCount(files.length)
    try {
      const fd = new FormData()
      for (const f of files) {
        fd.append("file", f)
      }
      const res = await fetch("/api/ai/photo-to-passport", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        extraction?: ComplianceIngestionResult
        provider?: "gemini" | "openai"
        filesProcessed?: number
      }
      if (!res.ok) {
        throw new Error(data.error || "Request failed")
      }
      if (!data.extraction) {
        throw new Error("Invalid response")
      }

      const base = getCurrentDraft()
      const merged = complianceIngestionToLegacyProductFormDraft(data.extraction, base)
      onApplyDraft(merged)

      setLastMeta(data.extraction)
      setLastProvider(data.provider ?? null)
      setLastFileCount(data.filesProcessed ?? files.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 text-violet-900">
            <Sparkles className="h-5 w-5 shrink-0 text-violet-600" aria-hidden />
            <h3 className="text-base font-semibold tracking-tight">Photo → passport (AI)</h3>
          </div>
          <p className="text-sm text-slate-700">
            Upload invoices, certificates, or labels — vision AI fills a{" "}
            <strong className="font-semibold text-violet-900">draft</strong> you can edit.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <input
            ref={inputRef}
            data-testid="photo-to-passport-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
            {loading ? "Analyzing document for DPP compliance…" : "Import from file"}
          </button>
          <span className="text-center text-[10px] text-slate-400 sm:text-right">
            Images max 4&nbsp;MB · PDF max 8&nbsp;MB · up to 8 files
          </span>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {lastMeta ? (
        <p className="mt-3 text-xs text-slate-600">
          {lastProvider ? (
            <>
              Engine: <span className="font-medium capitalize text-slate-800">{lastProvider}</span>
              {" · "}
            </>
          ) : null}
          {lastFileCount > 1 ? (
            <>
              Files: <span className="font-medium text-slate-800">{lastFileCount}</span>
              {" · "}
            </>
          ) : null}
          Category:{" "}
          <span className="font-medium text-emerald-900">{lastMeta.complianceCategory}</span>
          {" · "}
          Confidence:{" "}
          <span className="font-medium text-slate-800">{lastMeta.confidence ?? "—"}</span>
        </p>
      ) : null}
    </div>
  )
}
