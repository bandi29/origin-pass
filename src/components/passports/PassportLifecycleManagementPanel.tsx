"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { AlertTriangle, Loader2, ShieldAlert, X } from "lucide-react"
import { updatePassportLifecycleStatus } from "@/actions/update-passport-lifecycle-status"
import {
  PASSPORT_LIFECYCLE_ACTION_LABELS,
  PASSPORT_LIFECYCLE_CONFIRM_KEYWORDS,
  PASSPORT_LIFECYCLE_REASONS,
  passportLifecycleActionBlocked,
  type PassportLifecycleAction,
} from "@/lib/passport-lifecycle-management"

type PassportLifecycleManagementPanelProps = {
  passportId: string
  currentStatus: string
  onStatusChange: (status: string, lifecycleAction: PassportLifecycleAction) => void
}

type LifecycleRow = {
  action: PassportLifecycleAction
  title: string
  description: string
  buttonLabel: string
  buttonClassName: string
}

const LIFECYCLE_ROWS: LifecycleRow[] = [
  {
    action: "deactivate",
    title: "Deactivate",
    description: "Temporarily remove the public verification view without permanently revoking the passport.",
    buttonLabel: "Deactivate passport",
    buttonClassName:
      "border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100 focus-visible:ring-orange-400",
  },
  {
    action: "flag",
    title: "Flag as Under Investigation",
    description: "Mark this passport for suspected counterfeit monitoring while your team investigates.",
    buttonLabel: "Flag for investigation",
    buttonClassName:
      "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 focus-visible:ring-amber-400",
  },
  {
    action: "revoke",
    title: "Revoke Passport Permanent",
    description: "Permanently invalidate this passport after verified fraud, loss, or irreversible compromise.",
    buttonLabel: "Revoke permanently",
    buttonClassName:
      "border-rose-700 bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500",
  },
]

export function PassportLifecycleManagementPanel({
  passportId,
  currentStatus,
  onStatusChange,
}: PassportLifecycleManagementPanelProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<PassportLifecycleAction | null>(null)
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [confirmKeyword, setConfirmKeyword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeRow = useMemo(
    () => LIFECYCLE_ROWS.find((row) => row.action === pendingAction) ?? null,
    [pendingAction],
  )

  const requiredKeyword = pendingAction
    ? PASSPORT_LIFECYCLE_CONFIRM_KEYWORDS[pendingAction]
    : ""

  const canSubmit =
    Boolean(pendingAction) &&
    Boolean(reason) &&
    confirmKeyword.trim() === requiredKeyword &&
    !isPending

  function openModal(action: PassportLifecycleAction) {
    const blocked = passportLifecycleActionBlocked(action, currentStatus)
    if (blocked) {
      setError(blocked)
      return
    }
    setError(null)
    setReason("")
    setNote("")
    setConfirmKeyword("")
    setPendingAction(action)
  }

  function closeModal() {
    if (isPending) return
    setPendingAction(null)
    setReason("")
    setNote("")
    setConfirmKeyword("")
    setError(null)
  }

  function handleSubmit() {
    if (!pendingAction || !canSubmit) return

    startTransition(async () => {
      setError(null)
      const result = await updatePassportLifecycleStatus({
        passportId,
        action: pendingAction,
        reason,
        note,
        confirmKeyword,
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      onStatusChange(result.status, result.lifecycleAction)
      closeModal()
      router.refresh()
    })
  }

  return (
    <>
      <section className="space-y-5">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-rose-200 bg-white p-2 text-rose-700">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                Passport Lifecycle Management
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                High-impact actions are audited, require explicit confirmation, and immediately affect
                consumer-facing verification behavior.
              </p>
            </div>
          </div>

          <div className="mt-6 divide-y divide-rose-100 rounded-xl border border-rose-100 bg-white">
            {LIFECYCLE_ROWS.map((row) => {
              const blockedMessage = passportLifecycleActionBlocked(row.action, currentStatus)
              return (
                <div
                  key={row.action}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                    <p className="text-sm leading-relaxed text-slate-600">{row.description}</p>
                    {blockedMessage ? (
                      <p className="text-xs font-medium text-slate-500">{blockedMessage}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(blockedMessage) || isPending}
                    onClick={() => openModal(row.action)}
                    className={clsx(
                      "inline-flex shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                      row.buttonClassName,
                    )}
                  >
                    {row.buttonLabel}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {error && !pendingAction ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </section>

      <Dialog.Root open={pendingAction !== null} onOpenChange={(open) => !open && closeModal()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[320] bg-slate-900/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[330] w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  Confirm lifecycle action
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-600">
                  {activeRow
                    ? PASSPORT_LIFECYCLE_ACTION_LABELS[activeRow.action]
                    : "Review the action before continuing."}
                </Dialog.Description>
              </div>
              <Dialog.Close
                disabled={isPending}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Close confirmation dialog"
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  This action is logged with your user profile and cannot be undone from this screen.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  Reason <span className="text-rose-600">*</span>
                </span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Select a reason</option>
                  {PASSPORT_LIFECYCLE_REASONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">Additional note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isPending}
                  rows={3}
                  placeholder="Optional context for the audit trail"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  Type{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                    {requiredKeyword}
                  </code>{" "}
                  to confirm <span className="text-rose-600">*</span>
                </span>
                <input
                  value={confirmKeyword}
                  onChange={(event) => setConfirmKeyword(event.target.value)}
                  disabled={isPending}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={clsx(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50",
                  pendingAction === "revoke"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : pendingAction === "flag"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-orange-600 hover:bg-orange-700",
                )}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isPending ? "Applying…" : "Confirm action"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
