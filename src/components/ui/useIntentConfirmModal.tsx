"use client"

import { useCallback, useState, type ReactNode } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import clsx from "clsx"
import { Modal } from "@/components/ui/Modal"

export type IntentConfirmOptions = {
  title: string
  description: string
  confirmText: string
  cancelText?: string
  intent?: "danger" | "default"
  onConfirm: () => void | Promise<void>
}

type OpenModal = (options: IntentConfirmOptions) => void

export function useIntentConfirmModal(): {
  openModal: OpenModal
  confirmModal: ReactNode
} {
  const [options, setOptions] = useState<IntentConfirmOptions | null>(null)
  const [pending, setPending] = useState(false)

  const openModal = useCallback((next: IntentConfirmOptions) => {
    setOptions(next)
  }, [])

  const closeModal = useCallback(() => {
    if (pending) return
    setOptions(null)
  }, [pending])

  const handleConfirm = useCallback(async () => {
    if (!options) return
    setPending(true)
    try {
      await options.onConfirm()
      setOptions(null)
    } finally {
      setPending(false)
    }
  }, [options])

  const intent = options?.intent ?? "default"

  const confirmModal = options ? (
    <Modal
      open
      onClose={closeModal}
      title={options.title}
      description={options.description}
      size="sm"
    >
      {intent === "danger" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />
          <p>This action is completely irreversible.</p>
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={closeModal}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.cancelText ?? "Cancel"}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={pending}
          className={clsx(
            "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50",
            intent === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800",
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {options.confirmText}
        </button>
      </div>
    </Modal>
  ) : null

  return { openModal, confirmModal }
}
