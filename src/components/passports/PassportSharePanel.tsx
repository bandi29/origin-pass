"use client"

import { useCallback, useRef, useState } from "react"
import { Link2, Loader2, Mail, MessageCircle } from "lucide-react"
import clsx from "clsx"

type Channel = "whatsapp" | "email" | "direct"

const DEBOUNCE_MS = 800

type Props = {
  passportId: string
  productName: string
}

export function PassportSharePanel({ passportId, productName }: Props) {
  const [busy, setBusy] = useState<Channel | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const lastActionAt = useRef(0)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
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
    [passportId, showToast]
  )

  const guardDebounce = useCallback(() => {
    const now = Date.now()
    if (now - lastActionAt.current < DEBOUNCE_MS) return false
    lastActionAt.current = now
    return true
  }, [])

  const handleWhatsApp = async () => {
    if (!guardDebounce()) return
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
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Share this passport
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Tracked links help you see which channel drives visits.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleWhatsApp()}
          disabled={busy !== null}
          className={clsx(
            "inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition",
            "bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-60"
          )}
        >
          {busy === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void handleEmail()}
          disabled={busy !== null}
          className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-200 disabled:opacity-60"
        >
          {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Email
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          disabled={busy !== null}
          className="inline-flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "direct" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Copy link
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
