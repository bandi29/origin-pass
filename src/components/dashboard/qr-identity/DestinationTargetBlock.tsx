"use client"

import { ExternalLink, Globe } from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import clsx from "clsx"

export const SECURE_PASSPORT_DESTINATION_LABEL = "Destination: Secure Digital Passport"

type DestinationTargetBlockProps = {
  /** Full URL encoded in the QR (e.g. https://example.com/scan/{passportId}) */
  previewUrl: string | null
  className?: string
  /** When false, omit the copy control (e.g. read-only contexts) */
  showCopy?: boolean
  /** Muted placeholder styling when no product is selected for preview */
  inactive?: boolean
}

export function DestinationTargetBlock({
  previewUrl,
  className,
  showCopy = true,
  inactive = false,
}: DestinationTargetBlockProps) {
  const toast = useToast()

  async function copyPreviewLink() {
    if (!previewUrl?.trim()) {
      toast.error("No preview link available yet. Ensure an active passport exists for this product.")
      return
    }
    try {
      await navigator.clipboard.writeText(previewUrl.trim())
      toast.success("Copied!")
    } catch {
      toast.error("Could not copy to clipboard.")
    }
  }

  const linkReady = Boolean(previewUrl?.trim()) && !inactive

  return (
    <div className={clsx("space-y-2", inactive && "opacity-90", className)}>
      <p
        className={clsx(
          "text-xs font-semibold uppercase tracking-wide",
          inactive ? "text-slate-400" : "text-slate-500",
        )}
      >
        Target destination
      </p>
      <div
        className={clsx(
          "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
          inactive
            ? "border-dashed border-slate-200 bg-slate-50/50"
            : "border-slate-200 bg-slate-50/90",
        )}
      >
        <span
          className={clsx(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md shadow-sm ring-1",
            inactive
              ? "bg-slate-50 text-slate-300 ring-slate-100"
              : "bg-white text-slate-600 ring-slate-200/80",
          )}
        >
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              "text-sm font-medium leading-snug",
              inactive ? "text-slate-400" : "text-slate-900",
            )}
          >
            {SECURE_PASSPORT_DESTINATION_LABEL}
          </p>
          <p className={clsx("mt-0.5 text-[11px]", inactive ? "text-slate-400" : "text-slate-500")}>
            Customer scans open your secure digital passport experience.
          </p>
        </div>
        <ExternalLink
          className={clsx("mt-1 h-4 w-4 shrink-0", inactive ? "text-slate-300" : "text-slate-400")}
          aria-hidden
        />
      </div>
      {showCopy ? (
        <button
          type="button"
          onClick={() => void copyPreviewLink()}
          disabled={!linkReady}
          className={clsx(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition",
            linkReady
              ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400",
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Copy preview link
        </button>
      ) : null}
      {linkReady && previewUrl ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition hover:bg-slate-50"
        >
          Open preview destination
        </a>
      ) : (
        <span
          aria-hidden
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
        >
          Open preview destination
        </span>
      )}
    </div>
  )
}
