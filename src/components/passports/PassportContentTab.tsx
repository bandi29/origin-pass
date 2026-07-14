"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import { CheckCircle2, Loader2, BookOpen, Layers, MapPin, RefreshCcw } from "lucide-react"
import { updatePassportContent } from "@/actions/update-passport-content"
import type { PassportContentRecord } from "@/lib/passport-detail-server"

type PassportContentTabProps = {
  passportId: string
  initialContent: PassportContentRecord
}

const FIELD_BASE =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"

export function PassportContentTab({ passportId, initialContent }: PassportContentTabProps) {
  const router = useRouter()
  const [form, setForm] = useState<PassportContentRecord>(initialContent)
  const [saved, setSaved] = useState<PassportContentRecord>(initialContent)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const dirty =
    form.story !== saved.story ||
    form.materials !== saved.materials ||
    form.origin !== saved.origin ||
    form.lifecycle !== saved.lifecycle

  function set<K extends keyof PassportContentRecord>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setJustSaved(false)
    setError(null)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || isPending) return
    startTransition(async () => {
      setError(null)
      const result = await updatePassportContent({ passportId, ...form })
      if (!result.success) {
        setError(result.error)
        return
      }
      setSaved(form)
      setJustSaved(true)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Passport content</h3>
        <p className="mt-1 text-sm text-slate-600">
          Edit the story, materials, and metadata shown on the public verification page. Changes
          publish to the live passport after saving.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="passport-story" className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <BookOpen className="h-4 w-4 text-slate-500" aria-hidden />
          Product story
        </label>
        <textarea
          id="passport-story"
          value={form.story}
          onChange={(e) => set("story", e.target.value)}
          disabled={isPending}
          rows={5}
          placeholder="The provenance, craftsmanship, and narrative behind this product…"
          className={FIELD_BASE}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="passport-materials" className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Layers className="h-4 w-4 text-slate-500" aria-hidden />
          Materials
        </label>
        <textarea
          id="passport-materials"
          value={form.materials}
          onChange={(e) => set("materials", e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="e.g. Full-grain Tuscan vegetable-tanned leather, solid brass hardware"
          className={FIELD_BASE}
        />
        <p className="text-xs text-slate-500">Separate components with commas or new lines.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="passport-origin" className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <MapPin className="h-4 w-4 text-slate-500" aria-hidden />
            Origin
          </label>
          <input
            id="passport-origin"
            value={form.origin}
            onChange={(e) => set("origin", e.target.value)}
            disabled={isPending}
            placeholder="e.g. Florence, Italy"
            className={FIELD_BASE}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="passport-lifecycle" className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <RefreshCcw className="h-4 w-4 text-slate-500" aria-hidden />
            Lifecycle &amp; care
          </label>
          <input
            id="passport-lifecycle"
            value={form.lifecycle}
            onChange={(e) => set("lifecycle", e.target.value)}
            disabled={isPending}
            placeholder="e.g. Repairable hardware · recyclable packaging"
            className={FIELD_BASE}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
        {justSaved && !dirty ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Saved
          </span>
        ) : null}
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  )
}
