"use client"

import { useState } from "react"
import clsx from "clsx"
import { FileDown, Share2 } from "lucide-react"

export function VerifyPassportActions({
  shareUrl,
  serialId,
  compact = false,
  className,
}: {
  shareUrl: string
  serialId: string
  compact?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function sharePassport() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `OriginPass Passport ${serialId}`,
          text: "Verify this digital product passport.",
          url: shareUrl,
        })
        return
      } catch {
        // User dismissed share sheet or unsupported payload.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard errors.
    }
  }

  return (
    <div
      className={clsx(
        compact ? "flex items-center gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => window.print()}
        className={clsx(
          "inline-flex items-center justify-center gap-2 text-sm font-medium transition",
          compact
            ? "rounded-lg border border-slate-300/90 bg-transparent px-3 py-1.5 text-slate-700 hover:border-slate-400 hover:shadow-sm"
            : "rounded-xl bg-slate-900 px-4 py-2.5 text-white hover:bg-slate-800",
        )}
      >
        <FileDown className="h-4 w-4" aria-hidden />
        <span className={compact ? "hidden sm:inline" : ""}>{compact ? "Download" : "Download PDF Certificate"}</span>
      </button>
      <button
        type="button"
        onClick={() => void sharePassport()}
        className={clsx(
          "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 transition",
          compact
            ? "rounded-lg border-slate-300/90 bg-transparent px-3 py-1.5 text-slate-700 hover:border-slate-400 hover:shadow-sm"
            : "bg-white px-4 py-2.5 hover:bg-slate-50",
        )}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        <span className={compact ? "hidden sm:inline" : ""}>
          {copied ? "Link copied" : compact ? "Share" : "Share Passport"}
        </span>
      </button>
    </div>
  )
}
