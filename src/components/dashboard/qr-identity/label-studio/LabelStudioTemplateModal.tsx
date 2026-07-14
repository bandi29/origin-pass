"use client"

import { useEffect, useState } from "react"
import clsx from "clsx"
import { Loader2, MoreVertical, Pencil, RefreshCw, Trash2, X } from "lucide-react"
import * as Dialog from "@radix-ui/react-dialog"
import type { VisualTemplate } from "@/components/dashboard/qr-identity/print-labels/types"
import { LABEL_TEMPLATE_NAME_MAX } from "@/lib/labels/layout-template-types"

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void | Promise<void>
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[310] bg-[#0E1B2A]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[320] w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7E2D7] bg-white p-5 shadow-2xl outline-none">
          <Dialog.Title className="font-serif text-lg font-semibold text-[#0E1B2A]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-[#6B7079]">{description}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" disabled={pending} className="rounded-xl border border-[#E7E2D7] px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={pending}
              onClick={() => void onConfirm()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0E1B2A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RenameDialog({
  open,
  initialName,
  pending,
  onSave,
  onOpenChange,
}: {
  open: boolean
  initialName: string
  pending: boolean
  onSave: (name: string) => Promise<boolean>
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setError(null)
    }
  }, [open, initialName])

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[310] bg-[#0E1B2A]/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[320] w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#E7E2D7] bg-white p-5 shadow-2xl outline-none">
          <Dialog.Title className="font-serif text-lg font-semibold text-[#0E1B2A]">Rename template</Dialog.Title>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = name.trim()
              if (!trimmed) {
                setError("Name is required.")
                return
              }
              if (trimmed.length > LABEL_TEMPLATE_NAME_MAX) {
                setError(`Name must be ${LABEL_TEMPLATE_NAME_MAX} characters or fewer.`)
                return
              }
              void onSave(trimmed).then((ok) => {
                if (ok) onOpenChange(false)
              })
            }}
          >
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              disabled={pending}
              maxLength={LABEL_TEMPLATE_NAME_MAX}
              className="w-full rounded-xl border border-[#E7E2D7] px-3 py-2.5 text-sm"
              autoFocus
            />
            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" disabled={pending} className="rounded-xl border px-4 py-2 text-sm font-semibold">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0E1B2A] px-4 py-2 text-sm font-semibold text-white"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CustomTemplateTile({
  tpl,
  selected,
  pending,
  onSelect,
  onRename,
  onUpdate,
  onDelete,
}: {
  tpl: VisualTemplate
  selected: boolean
  pending: boolean
  onSelect: () => void
  onRename: () => void
  onUpdate: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={clsx(
          "w-full rounded-2xl border p-3 text-left transition duration-200",
          selected
            ? "border-[#356B4E] bg-[#E7F0EA]/40 shadow-md"
            : "border-[#E7E2D7] bg-white hover:border-[#15293E]",
        )}
      >
        <div
          className="mb-2 grid gap-1 rounded-xl border border-[#E7E2D7] bg-[#F7F4EE] p-2"
          style={{ gridTemplateColumns: `repeat(${tpl.cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: Math.min(12, tpl.cols * tpl.rows) }).map((_, i) => (
            <span key={i} className="aspect-square rounded border border-[#E7E2D7] bg-white" />
          ))}
        </div>
        <p className="truncate text-sm font-semibold text-[#0E1B2A]">{tpl.name}</p>
        <p className="text-xs text-[#6B7079]">{tpl.dimensions}</p>
        {tpl.description ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-[#9AA0A8]">{tpl.description}</p>
        ) : null}
      </button>
      <div className="absolute right-2 top-2">
        <button
          type="button"
          aria-label={`Manage ${tpl.name}`}
          disabled={pending}
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg bg-white/95 p-1.5 text-[#6B7079] shadow-sm ring-1 ring-[#E7E2D7] opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[285]"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-[286] mt-1 w-44 rounded-xl border border-[#E7E2D7] bg-white py-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F4EE]"
                onClick={() => {
                  setMenuOpen(false)
                  onRename()
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F7F4EE]"
                onClick={() => {
                  setMenuOpen(false)
                  onUpdate()
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Update layout
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function LabelStudioTemplateModal({
  open,
  onClose,
  templates,
  selectedTemplateId,
  onSelect,
  customLoading,
  customError,
  mutationPending,
  onRenameTemplate,
  onUpdateTemplateLayout,
  onDeleteTemplate,
}: {
  open: boolean
  onClose: () => void
  templates: VisualTemplate[]
  selectedTemplateId: string
  onSelect: (id: string) => void
  customLoading: boolean
  customError: string | null
  mutationPending: boolean
  onRenameTemplate: (id: string, name: string) => Promise<boolean>
  onUpdateTemplateLayout: (id: string) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<boolean>
}) {
  const [renameTarget, setRenameTarget] = useState<VisualTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VisualTemplate | null>(null)
  const [updateTarget, setUpdateTarget] = useState<VisualTemplate | null>(null)

  if (!open) return null

  const custom = templates.filter((t) => t.isCustom)
  const system = templates.filter((t) => !t.isCustom)

  const renderSystemTile = (tpl: VisualTemplate) => (
    <button
      key={tpl.id}
      type="button"
      onClick={() => {
        onSelect(tpl.id)
        onClose()
      }}
      className={clsx(
        "rounded-2xl border p-3 text-left transition duration-200",
        selectedTemplateId === tpl.id
          ? "border-[#356B4E] bg-[#E7F0EA]/40 shadow-md"
          : "border-[#E7E2D7] bg-white hover:border-[#15293E]",
      )}
    >
      <div
        className="mb-2 grid gap-1 rounded-xl border border-[#E7E2D7] bg-[#F7F4EE] p-2"
        style={{ gridTemplateColumns: `repeat(${tpl.cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: Math.min(12, tpl.cols * tpl.rows) }).map((_, i) => (
          <span key={i} className="aspect-square rounded border border-[#E7E2D7] bg-white" />
        ))}
      </div>
      <p className="text-sm font-semibold text-[#0E1B2A]">{tpl.name}</p>
      <p className="text-xs text-[#6B7079]">{tpl.dimensions}</p>
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-[280] flex items-center justify-center bg-[#0E1B2A]/40 p-4 backdrop-blur-md">
        <div className="w-full max-w-5xl rounded-3xl border border-[#E7E2D7] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E7E2D7] px-5 py-4">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#0E1B2A]">Select label template</h3>
              <p className="text-xs text-[#6B7079]">Choose a layout preset for production.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[#6B7079] hover:bg-[#F1EEE7] hover:text-[#0E1B2A]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9AA0A8]">
                Your templates
              </p>
              {customLoading ? (
                <p className="flex items-center gap-2 text-sm text-[#6B7079]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading saved templates…
                </p>
              ) : custom.length === 0 && customError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {customError}
                </p>
              ) : custom.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E7E2D7] bg-[#FCFBF8] px-4 py-6 text-center text-sm text-[#6B7079]">
                  No saved layouts yet. Use <strong>Save layout as template</strong> in the Layout tab.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {custom.map((tpl) => (
                    <CustomTemplateTile
                      key={tpl.id}
                      tpl={tpl}
                      selected={selectedTemplateId === tpl.id}
                      pending={mutationPending}
                      onSelect={() => {
                        onSelect(tpl.id)
                        onClose()
                      }}
                      onRename={() => setRenameTarget(tpl)}
                      onUpdate={() => setUpdateTarget(tpl)}
                      onDelete={() => setDeleteTarget(tpl)}
                    />
                  ))}
                </div>
              )}
            </section>
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9AA0A8]">
                System templates
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">{system.map(renderSystemTile)}</div>
            </section>
          </div>
        </div>
      </div>

      <RenameDialog
        open={Boolean(renameTarget)}
        initialName={renameTarget?.name ?? ""}
        pending={mutationPending}
        onOpenChange={(next) => !next && setRenameTarget(null)}
        onSave={async (name) => {
          if (!renameTarget) return false
          return onRenameTemplate(renameTarget.id, name)
        }}
      />

      <ConfirmDialog
        open={Boolean(updateTarget)}
        title="Update template layout?"
        description={`Replace "${updateTarget?.name}" with your current margins, cell size, branding, and output settings.`}
        confirmLabel="Update"
        pending={mutationPending}
        onOpenChange={(next) => !next && setUpdateTarget(null)}
        onConfirm={async () => {
          if (!updateTarget) return
          await onUpdateTemplateLayout(updateTarget.id)
          setUpdateTarget(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete template?"
        description={`"${deleteTarget?.name}" will be permanently removed from your account.`}
        confirmLabel="Delete"
        pending={mutationPending}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          const ok = await onDeleteTemplate(deleteTarget.id)
          if (ok) setDeleteTarget(null)
        }}
      />
    </>
  )
}
