"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import {
  CheckCircle2,
  Languages,
  Loader2,
  BookOpen,
  Layers,
  MapPin,
  RefreshCcw,
  Leaf,
} from "lucide-react"
import { updatePassportContent } from "@/actions/update-passport-content"
import type { PassportContentRecord } from "@/lib/passport-detail-server"
import {
  EU_TRANSLATE_LANGS,
  englishSourceFromProduct,
  type EuTranslateLang,
  type PassportTranslationFields,
  type PassportTranslationsColumn,
} from "@/lib/passport-eu-fields"

type PassportContentTabProps = {
  passportId: string
  initialContent: PassportContentRecord
}

type PreviewLang = "en" | EuTranslateLang

const LANG_TABS: { id: PreviewLang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "fr", label: "FR" },
  { id: "de", label: "DE" },
  { id: "es", label: "ES" },
  { id: "it", label: "IT" },
]

const EMPTY_FIELDS: PassportTranslationFields = {
  materials: "",
  origin: "",
  care: "",
  sustainability: "",
}

const FIELD_BASE =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"

export function PassportContentTab({ passportId, initialContent }: PassportContentTabProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    story: initialContent.story,
    materials: initialContent.materials,
    origin: initialContent.origin,
    lifecycle: initialContent.lifecycle,
  })
  const [saved, setSaved] = useState(form)
  const [translations, setTranslations] = useState<PassportTranslationsColumn>(
    initialContent.translations ?? {},
  )
  const [previewLang, setPreviewLang] = useState<PreviewLang>("en")
  const [euDraft, setEuDraft] = useState<PassportTranslationFields>(EMPTY_FIELDS)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSavingTranslation, setIsSavingTranslation] = useState(false)

  const dirty =
    form.story !== saved.story ||
    form.materials !== saved.materials ||
    form.origin !== saved.origin ||
    form.lifecycle !== saved.lifecycle

  const enSource = useMemo(() => englishSourceFromProduct(form), [form])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setJustSaved(false)
    setError(null)
    setStatus(null)
  }

  function selectLang(lang: PreviewLang) {
    setPreviewLang(lang)
    setError(null)
    setStatus(null)
    if (lang === "en") return
    const existing = translations[lang]
    setEuDraft(
      existing
        ? {
            materials: existing.materials ?? "",
            origin: existing.origin ?? "",
            care: existing.care ?? "",
            sustainability: existing.sustainability ?? "",
          }
        : { ...EMPTY_FIELDS },
    )
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

  async function handleTranslate() {
    if (isTranslating) return
    setIsTranslating(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportId,
          targetLangs: [...EU_TRANSLATE_LANGS],
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        translations?: PassportTranslationsColumn
        translated?: string[]
        cached?: string[]
        charactersUsed?: number
      } | null
      if (!res.ok || !body?.ok || !body.translations) {
        setError(body?.error ?? "Translation failed.")
        return
      }
      setTranslations(body.translations)
      const translatedN = body.translated?.length ?? 0
      const cachedN = body.cached?.length ?? 0
      setStatus(
        translatedN === 0
          ? `Using cached FR/DE/ES/IT (${cachedN} languages).`
          : `Translated ${translatedN} language(s)${cachedN ? `, ${cachedN} cached` : ""}${
              body.charactersUsed ? ` · ${body.charactersUsed} chars` : ""
            }.`,
      )
      if (previewLang !== "en") {
        const row = body.translations[previewLang]
        if (row) {
          setEuDraft({
            materials: row.materials ?? "",
            origin: row.origin ?? "",
            care: row.care ?? "",
            sustainability: row.sustainability ?? "",
          })
        }
      } else {
        setPreviewLang("fr")
        const row = body.translations.fr
        setEuDraft(
          row
            ? {
                materials: row.materials ?? "",
                origin: row.origin ?? "",
                care: row.care ?? "",
                sustainability: row.sustainability ?? "",
              }
            : { ...EMPTY_FIELDS },
        )
      }
      router.refresh()
    } catch {
      setError("Network error while translating.")
    } finally {
      setIsTranslating(false)
    }
  }

  async function handleSaveTranslation() {
    if (previewLang === "en" || isSavingTranslation) return
    setIsSavingTranslation(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch("/api/translate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportId,
          translations: { [previewLang]: euDraft },
        }),
      })
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean
        error?: string
        translations?: PassportTranslationsColumn
      } | null
      if (!res.ok || !body?.ok || !body.translations) {
        setError(body?.error ?? "Could not save translation.")
        return
      }
      setTranslations(body.translations)
      setStatus(`Saved ${previewLang.toUpperCase()} translation.`)
      router.refresh()
    } catch {
      setError("Network error while saving translation.")
    } finally {
      setIsSavingTranslation(false)
    }
  }

  const showingEn = previewLang === "en"

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Passport content</h3>
          <p className="mt-1 text-sm text-slate-600">
            Edit English source fields, then generate FR / DE / ES / IT for EU DPP review. Care maps
            from lifecycle; sustainability maps from the product story.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={isTranslating || isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isTranslating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Languages className="h-4 w-4" aria-hidden />
          )}
          {isTranslating ? "Translating…" : "Translate to EU Languages"}
        </button>
      </div>
      {error?.includes("PLAN_TRANSLATIONS_LOCKED") || error?.includes("English only") ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          EU automated translations unlock on Pro ($29/mo). Starter Free stays English-only.
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Passport language preview"
        className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
      >
        {LANG_TABS.map((tab) => {
          const active = previewLang === tab.id
          const hasCache = tab.id !== "en" && Boolean(translations[tab.id])
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectLang(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition ${
                active
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {hasCache ? <span className="ml-1 text-emerald-600">•</span> : null}
            </button>
          )
        })}
      </div>

      {showingEn ? (
        <>
          <div className="space-y-2">
            <label htmlFor="passport-story" className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <BookOpen className="h-4 w-4 text-slate-500" aria-hidden />
              Product story / sustainability
            </label>
            <textarea
              id="passport-story"
              value={form.story}
              onChange={(e) => set("story", e.target.value)}
              disabled={isPending}
              rows={5}
              placeholder="The provenance, craftsmanship, and sustainability narrative…"
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
        </>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Review / edit {previewLang.toUpperCase()} (EN source stays authoritative until you
            re-translate)
          </p>
          {(
            [
              { key: "materials" as const, label: "Materials", Icon: Layers, multiline: true },
              { key: "origin" as const, label: "Origin", Icon: MapPin, multiline: false },
              { key: "care" as const, label: "Care", Icon: RefreshCcw, multiline: true },
              {
                key: "sustainability" as const,
                label: "Sustainability",
                Icon: Leaf,
                multiline: true,
              },
            ] as const
          ).map(({ key, label, Icon, multiline }) => (
            <div key={key} className="space-y-2">
              <label
                htmlFor={`passport-${previewLang}-${key}`}
                className="flex items-center gap-2 text-sm font-medium text-slate-900"
              >
                <Icon className="h-4 w-4 text-slate-500" aria-hidden />
                {label}
              </label>
              {multiline ? (
                <textarea
                  id={`passport-${previewLang}-${key}`}
                  value={euDraft[key]}
                  onChange={(e) => setEuDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={isSavingTranslation}
                  rows={3}
                  placeholder={enSource[key] ? `Translated from: ${enSource[key].slice(0, 80)}` : "—"}
                  className={FIELD_BASE}
                />
              ) : (
                <input
                  id={`passport-${previewLang}-${key}`}
                  value={euDraft[key]}
                  onChange={(e) => setEuDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                  disabled={isSavingTranslation}
                  placeholder={enSource[key] || "—"}
                  className={FIELD_BASE}
                />
              )}
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSaveTranslation()}
              disabled={isSavingTranslation}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingTranslation ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save {previewLang.toUpperCase()} edits
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      ) : null}
      {status ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {status}
        </p>
      ) : null}

      {showingEn ? (
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
      ) : null}
    </form>
  )
}
