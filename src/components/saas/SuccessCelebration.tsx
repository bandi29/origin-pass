"use client"

import { useState } from "react"
import { PartyPopper } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  shareUrl?: string
  viewHref?: string
}

export function SuccessCelebration({
  open,
  onClose,
  title = "Your passport is live!",
  description = "Share it with customers or scan the QR to preview the public page.",
  shareUrl,
  viewHref,
}: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!shareUrl || typeof navigator === "undefined") return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="flex flex-col items-center justify-center gap-2 pt-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
          <PartyPopper className="h-6 w-6 text-ds-secondary" aria-hidden />
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {shareUrl ? (
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? "Copied!" : "Copy link"}
            </Button>
          ) : null}
          {viewHref ? (
            <Button href={viewHref} variant="primary" size="sm">
              View
            </Button>
          ) : null}
          <Button href="/pricing" variant="ghost" size="sm">
            Upgrade
          </Button>
        </div>
      </div>
    </Modal>
  )
}
