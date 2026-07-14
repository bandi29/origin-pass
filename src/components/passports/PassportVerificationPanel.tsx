"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import * as Dialog from "@radix-ui/react-dialog"
import clsx from "clsx"
import { ClipboardList, Info, Loader2, ShieldCheck, X } from "lucide-react"
import { overridePassportVerificationStatus } from "@/actions/override-passport-verification-status"
import { PassportVerificationStatusBadge } from "./PassportVerificationStatusBadge"
import {
  formatPassportVerificationTimestamp,
  PASSPORT_VERIFICATION_OVERRIDE_OPTIONS,
  type PassportVerificationComplianceStatus,
  type PassportVerificationHistoryEntry,
} from "@/lib/passport-verification-management"

type PassportVerificationPanelProps = {
  passportId: string
  initialComplianceStatus: PassportVerificationComplianceStatus
  initialHistory: PassportVerificationHistoryEntry[]
}

export function PassportVerificationPanel({
  passportId,
  initialComplianceStatus,
  initialHistory,
}: PassportVerificationPanelProps) {
  const router = useRouter()
  const [complianceStatus, setComplianceStatus] =
    useState<PassportVerificationComplianceStatus>(initialComplianceStatus)
  const [history, setHistory] = useState<PassportVerificationHistoryEntry[]>(initialHistory)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState<PassportVerificationComplianceStatus>("verified")
  const [justification, setJustification] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canSubmit = justification.trim().length >= 8 && !isPending

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [history],
  )

  function openDialog() {
    setTargetStatus(complianceStatus)
    setJustification("")
    setError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    if (isPending) return
    setDialogOpen(false)
    setJustification("")
    setError(null)
  }

  function handleSubmit() {
    if (!canSubmit) return

    startTransition(async () => {
      setError(null)
      const result = await overridePassportVerificationStatus({
        passportId,
        targetStatus,
        justification: justification.trim(),
      })

      if (!result.success) {
        setError(result.error)
        return
      }

      setComplianceStatus(result.complianceStatus)
      setHistory((prev) => [result.entry, ...prev.filter((row) => row.id !== result.entry.id)])
      closeDialog()
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex flex-wrap items-center gap-2 text-slate-600">
          <span>Current status:</span>
          <PassportVerificationStatusBadge status={complianceStatus} />
        </p>
        <button
          type="button"
          onClick={openDialog}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          Manual Override Status
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden />
        <p>
          OriginPass analyzes your manifest metadata formatting automatically. Note: This
          verification checks for structural data completeness to align with open EU DPP
          templates; it does not constitute formal legal or third-party regulatory
          certification.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">
            Verification Audit History Logs
          </h3>
        </div>

        {sortedHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
            <div className="rounded-full border border-slate-200 bg-white p-3 text-slate-500">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
              No verification changes recorded for this passport asset yet.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Event / Type</th>
                    <th className="px-4 py-3">Determined Status</th>
                    <th className="px-4 py-3">Performed By</th>
                    <th className="px-4 py-3">Notes / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sortedHistory.map((entry) => (
                    <tr key={entry.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                        {formatPassportVerificationTimestamp(entry.createdAt)}
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{entry.eventLabel}</td>
                      <td className="px-4 py-4">
                        <PassportVerificationStatusBadge status={entry.determinedStatus} size="sm" />
                      </td>
                      <td className="px-4 py-4 text-slate-700">{entry.performedBy}</td>
                      <td className="max-w-md px-4 py-4 text-slate-600">
                        {entry.notes?.trim() || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Dialog.Root open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[320] bg-slate-900/45 backdrop-blur-[1px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[330] w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Dialog.Title className="text-lg font-semibold text-slate-900">
                  Manual verification override
                </Dialog.Title>
                <Dialog.Description className="text-sm text-slate-600">
                  Apply an administrative compliance decision and append an immutable audit log entry.
                </Dialog.Description>
              </div>
              <Dialog.Close
                disabled={isPending}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Close override dialog"
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  Target compliance status <span className="text-rose-600">*</span>
                </span>
                <select
                  value={targetStatus}
                  onChange={(event) =>
                    setTargetStatus(event.target.value as PassportVerificationComplianceStatus)
                  }
                  disabled={isPending}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  {PASSPORT_VERIFICATION_OVERRIDE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-900">
                  Change log reason / justification notes <span className="text-rose-600">*</span>
                </span>
                <textarea
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  disabled={isPending}
                  rows={4}
                  placeholder="Document why this compliance status is being changed"
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
                onClick={closeDialog}
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
                  "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {isPending ? "Saving override…" : "Apply override"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
