"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { PassportSharePanel } from "@/components/passports/PassportSharePanel"

type Material = { name?: string; source?: string; sustainabilityTag?: string }
type TimelineStep = { stepName?: string; location?: string; date?: string }

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
] as const

type Props = {
  passportId: string
  productName: string
  brandName: string
  initialStory: string | null
  fallbackStory: string
  structuredMaterials: Material[] | null
  legacyMaterialsText: string | null
  timelineSteps: TimelineStep[] | null
}

export function PassportPublicI18n({
  passportId,
  productName,
  brandName,
  initialStory,
  fallbackStory,
  structuredMaterials,
  legacyMaterialsText,
  timelineSteps,
}: Props) {
  const [lang, setLang] = useState<string>("en")
  const [story, setStory] = useState<string | null>(initialStory)
  const [materials, setMaterials] = useState<Material[] | null>(structuredMaterials)
  const [timeline, setTimeline] = useState<TimelineStep[] | null>(timelineSteps)
  const [legacyMat] = useState<string | null>(legacyMaterialsText)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyEnglish = useCallback(() => {
    setStory(initialStory)
    setMaterials(structuredMaterials)
    setTimeline(timelineSteps)
    setError(null)
  }, [initialStory, structuredMaterials, timelineSteps])

  const loadLanguage = useCallback(
    async (code: string) => {
      setError(null)
      if (code === "en") {
        applyEnglish()
        return
      }

      setLoading(true)
      try {
        let res = await fetch(`/api/public/passport/${passportId}/content?lang=${code}`)
        let data = await res.json()

        if (!res.ok) {
          setError(data.error || "Could not load translation")
          return
        }

        if (!data.found) {
          const tr = await fetch("/api/ai/translate-passport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passportId, targetLanguage: code }),
          })
          const trBody = await tr.json()
          if (!tr.ok) {
            setError(trBody.error || "Translation failed")
            return
          }
          res = await fetch(`/api/public/passport/${passportId}/content?lang=${code}`)
          data = await res.json()
          if (!res.ok || !data.found) {
            setError("Translation is still processing. Try again in a moment.")
            return
          }
        }

        setStory(data.story || null)
        setMaterials(Array.isArray(data.materials) ? data.materials : [])
        setTimeline(Array.isArray(data.timeline) ? data.timeline : [])
      } finally {
        setLoading(false)
      }
    },
    [passportId, applyEnglish]
  )

  const onChangeLang = async (code: string) => {
    setLang(code)
    await loadLanguage(code)
  }

  const storyDisplay =
    (story && story.trim()) || fallbackStory || `${brandName} publishes digital product records so customers can verify authenticity in one scan.`

  const matList = materials?.filter((m) => m?.name || m?.source) ?? []
  const timeList = timeline?.filter((t) => t?.stepName || t?.location || t?.date) ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Passport language
        </span>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800"
            value={lang}
            disabled={loading}
            onChange={(e) => void onChangeLang(e.target.value)}
            aria-label="Passport language"
          >
            {LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.code === "en" ? "🌐 English" : `🌐 ${o.label}`}
              </option>
            ))}
          </select>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      <PassportSharePanel passportId={passportId} productName={productName} />

      <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Story</h2>
        <p>{storyDisplay}</p>
      </div>

      {matList.length > 0 ? (
        <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Materials</h2>
          <ul className="space-y-2">
            {matList.map((m, i) => (
              <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                <span className="font-medium text-slate-900">{m.name ?? "—"}</span>
                {m.source ? <span className="text-slate-500"> — {m.source}</span> : null}
                {m.sustainabilityTag ? (
                  <span className="mt-1 block text-xs text-emerald-700">{m.sustainabilityTag}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : legacyMat && lang === "en" ? (
        <div className="space-y-2 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Materials</h2>
          <p>{legacyMat}</p>
        </div>
      ) : null}

      {timeList.length > 0 ? (
        <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Timeline</h2>
          <ol className="space-y-3 border-l border-emerald-200 pl-4">
            {timeList.map((t, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                <p className="font-medium text-slate-900">{t.stepName ?? "Step"}</p>
                <p className="text-xs text-slate-500">
                  {[t.location, t.date].filter(Boolean).join(" · ") || null}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
