"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Link2, Loader2, Mail, MessageCircle } from "lucide-react"
import clsx from "clsx"
import { useOptionalToast } from "@/components/ui/Toast"

type Channel = "whatsapp" | "email" | "direct"

const DEBOUNCE_MS = 800

/** Placeholder URL for template preview / sandbox (no real share tracking). */
const PREVIEW_SHARE_URL = "https://originpass.com/p/mock-passport-123"

const btnTactile = "transition-transform active:scale-95"

type Props = {
  passportId: string
  productName: string
  /** Preview inside dashboard modal: sandbox share actions + mock copy URL. */
  mode?: "live" | "preview"
}

export function PassportSharePanel({ passportId, productName, mode = "live" }: Props) {
  const isPreview = mode === "preview"
  const optionalToast = useOptionalToast()

  const [busy, setBusy] = useState<Channel | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copiedResetRef = useRef<number | null>(null)

  const lastActionAt = useRef(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }, [])

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current)
    }
  }, [])

  const createTrackedUrl = useCallback(
    async (channel: Channel): Promise<string | null> => {
      const res = await fetch("/api/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportId, channel }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error || "Could not create link")
        return null
      }
      return typeof data.url === "string" ? data.url : null
    },
    [passportId, showToast],
  )

  const guardDebounce = useCallback(() => {
    const now = Date.now()
    if (now - lastActionAt.current < DEBOUNCE_MS) return false
    lastActionAt.current = now
    return true
  }, [])

  const showWhatsAppPreviewToast = useCallback(() => {
    const title = "WhatsApp Integration Preview"
    const description =
      "In live production, this shares a pre-formatted message showcasing your product's craftsmanship details directly to the customer's chats."
    if (optionalToast) {
      optionalToast.info(title, description)
    } else {
      showToast(`${title} — ${description}`)
    }
  }, [optionalToast, showToast])

  const showEmailPreviewToast = useCallback(() => {
    const title = "Email Sharing Preview"
    const description =
      "In live production, this launches the customer's native email app with a beautifully drafted message containing your passport's URL."
    if (optionalToast) {
      optionalToast.info(title, description)
    } else {
      showToast(`${title} — ${description}`)
    }
  }, [optionalToast, showToast])

  const handleWhatsApp = async () => {
    if (!guardDebounce()) return
    if (isPreview) {
      showWhatsAppPreviewToast()
      return
    }
    setBusy("whatsapp")
    try {
      const url = await createTrackedUrl("whatsapp")
      if (url) {
        const text = `Check out this product passport: ${url}`
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")
      }
    } finally {
      setBusy(null)
    }
  }

  const handleEmail = async () => {
    if (!guardDebounce()) return
    if (isPreview) {
      showEmailPreviewToast()
      return
    }
    setBusy("email")
    try {
      const url = await createTrackedUrl("email")
      if (url) {
        const subject = encodeURIComponent(`Product passport: ${productName}`)
        const body = encodeURIComponent(`Check this out:\n\n${url}`)
        window.location.href = `mailto:?subject=${subject}&body=${body}`
      }
    } finally {
      setBusy(null)
    }
  }

  const handleCopy = async () => {
    if (!guardDebounce()) return
    if (isPreview) {
      try {
        await navigator.clipboard.writeText(PREVIEW_SHARE_URL)
        setCopied(true)
        if (copiedResetRef.current) window.clearTimeout(copiedResetRef.current)
        copiedResetRef.current = window.setTimeout(() => setCopied(false), 2000)
      } catch {
        showToast("Could not copy")
      }
      return
    }
    setBusy("direct")
    try {
      const url = await createTrackedUrl("direct")
      if (url) {
        await navigator.clipboard.writeText(url)
        showToast("Link copied")
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Share this passport</h2>
      <p className="mt-1 text-xs text-slate-500">
        {isPreview
          ? "Preview: actions below simulate the live experience without leaving the dashboard."
          : "Tracked links help you see which channel drives visits."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleWhatsApp()}
          disabled={!isPreview && busy !== null}
          className={clsx(
            btnTactile,
            "inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white",
            "bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-60",
          )}
        >
          {busy === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void handleEmail()}
          disabled={!isPreview && busy !== null}
          className={clsx(
            btnTactile,
            "inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-200 disabled:opacity-60",
          )}
        >
          {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={!isPreview && busy !== null}
          className={clsx(
            btnTactile,
            "inline-flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
          )}
        >
          {isPreview && copied ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : busy === "direct" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Link2 className="h-4 w-4" />
          )}
          {isPreview && copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
