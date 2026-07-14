"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { Loader2, X } from "lucide-react"
import { LABEL_TEMPLATE_DESCRIPTION_MAX, LABEL_TEMPLATE_NAME_MAX } from "@/lib/labels/layout-template-types"

export function SaveLayoutTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  blockedReason,
  isSaving,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName: string
  blockedReason: string | null
  isSaving: boolean
  onSave: (name: string, description: string | null) => Promise<boolean>
}) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      setDescription("")
      setNameError(null)
    }
  }, [open, defaultName])

  const validate = (): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return "Template name is required."
    if (trimmed.length > LABEL_TEMPLATE_NAME_MAX) {
      return `Name must be ${LABEL_TEMPLATE_NAME_MAX} characters or fewer.`
    }
    if (description.trim().length > LABEL_TEMPLATE_DESCRIPTION_MAX) {
      return `Description must be ${LABEL_TEMPLATE_DESCRIPTION_MAX} characters or fewer.`
    }
    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (blockedReason) return
    const err = validate()
    if (err) {
      setNameError(err)
      return
    }
    setNameError(null)
    const ok = await onSave(name.trim(), description.trim() || null)
    if (!ok) {
      const postErr = validate()
      if (postErr) setNameError(postErr)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[290] bg-[#0E1B2A]/40 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[300] w-[min(100%-2rem,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7E2D7] bg-white p-5 shadow-2xl outline-none"
          aria-describedby="save-layout-template-desc"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-serif text-lg font-semibold text-[#0E1B2A]">
                Save layout as template
              </Dialog.Title>
              <Dialog.Description id="save-layout-template-desc" className="mt-1 text-sm text-[#6B7079]">
                Saves margins, cell size, structure, branding, and output settings to your account.
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={isSaving}
              className="rounded-lg p-2 text-[#6B7079] hover:bg-[#F1EEE7] disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          {blockedReason ? (
            <p className="mt-4 rounded-xl border border-[#B9722B]/30 bg-[#FBEEDD] px-3 py-2 text-sm text-[#B9722B]">
              {blockedReason}
            </p>
          ) : null}

          <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <label htmlFor="save-layout-template-name" className="text-xs font-semibold uppercase tracking-wide text-[#9AA0A8]">
                Name
              </label>
              <input
                id="save-layout-template-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameError(null)
                }}
                disabled={isSaving || Boolean(blockedReason)}
                maxLength={LABEL_TEMPLATE_NAME_MAX}
                className="mt-1.5 w-full rounded-xl border border-[#E7E2D7] px-3 py-2.5 text-sm text-[#15293E] focus:border-[#356B4E]/50 focus:outline-none focus:ring-2 focus:ring-[#356B4E]/15 disabled:opacity-50"
                autoFocus
              />
              {(nameError ?? validate()) && !blockedReason ? (
                <p className="mt-1.5 text-xs font-medium text-rose-700" role="alert">
                  {nameError ?? validate()}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="save-layout-template-desc-field" className="text-xs font-semibold uppercase tracking-wide text-[#9AA0A8]">
                Description <span className="font-normal normal-case text-[#9AA0A8]">(optional)</span>
              </label>
              <textarea
                id="save-layout-template-desc-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSaving || Boolean(blockedReason)}
                maxLength={LABEL_TEMPLATE_DESCRIPTION_MAX}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-[#E7E2D7] px-3 py-2.5 text-sm text-[#15293E] focus:border-[#356B4E]/50 focus:outline-none focus:ring-2 focus:ring-[#356B4E]/15 disabled:opacity-50"
                placeholder="Optional notes for your team"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isSaving}
                  className="rounded-xl border border-[#E7E2D7] px-4 py-2 text-sm font-semibold text-[#15293E] disabled:opacity-40"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSaving || Boolean(blockedReason)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-xl bg-[#0E1B2A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#15293E] disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save template
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
