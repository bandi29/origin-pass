"use client"

import { useState, type FormEvent } from "react"
import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { DPP_CHECKLIST_PDF_PATH } from "@/lib/dpp-checklist-content"

type Result = { ok: boolean; status: string; message: string }

/**
 * Email-gate for the DPP checklist. No login, no local storage of subscribers —
 * posts to /api/lead-magnet/subscribe, which registers with the email provider.
 * Submit is blocked until GDPR consent is explicitly ticked.
 */
export function DppChecklistForm() {
  const [email, setEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const succeeded = result?.ok === true

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !consent) return
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch("/api/lead-magnet/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent }),
      })
      const data = (await res.json().catch(() => null)) as Result | null
      setResult(
        data ?? { ok: false, status: "error", message: "Something went wrong — please try again." },
      )
    } catch {
      setResult({ ok: false, status: "error", message: "Network hiccup — please try again in a moment." })
    } finally {
      setSubmitting(false)
    }
  }

  if (succeeded) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center"
      >
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
        <p className="mt-3 text-base font-semibold text-slate-900">{result?.message}</p>
        <p className="mt-1 text-sm text-slate-600">
          It can take a minute to arrive. If it doesn&apos;t, check your spam folder.
        </p>
        <a
          href={DPP_CHECKLIST_PDF_PATH}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Or download it directly
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm">
      <label htmlFor="lead-email" className="block text-sm font-medium text-slate-900">
        Work email
      </label>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900">
        <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbrand.com"
          className="w-full bg-transparent py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-1 focus:ring-slate-900"
        />
        <span>I agree to receive the checklist and occasional emails from OriginPass.</span>
      </label>

      <button
        type="submit"
        disabled={submitting || !consent}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Send me the checklist
      </button>

      {result && !result.ok ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {result.message}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        No spam. Unsubscribe in one click. We never share your address.
      </p>
    </form>
  )
}
