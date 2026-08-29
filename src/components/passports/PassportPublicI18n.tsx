"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { clsx } from "clsx"
import { Loader2 } from "lucide-react"
import { PassportSharePanel } from "@/components/passports/PassportSharePanel"
import {
  PUBLIC_PASSPORT_LANG_OPTIONS,
  detectPreferredPassportLang,
  type PublicPassportLang,
} from "@/lib/passport-eu-lang"

type Material = { name?: string; source?: string; sustainabilityTag?: string }
type TimelineStep = { stepName?: string; location?: string; date?: string }

type ContentPayload = {
  language: PublicPassportLang
  found: boolean
  story: string
  materialsText: string | null
  origin: string | null
  care: string | null
  materials: Material[]
  timeline: TimelineStep[]
  legacyMaterials: string | null
  source?: "en" | "translations" | "none"
}

type Props = {
  passportId: string
  productName: string
  brandName: string
  initialStory: string | null
  fallbackStory: string
  initialOrigin?: string | null
  initialCare?: string | null
  structuredMaterials: Material[] | null
  legacyMaterialsText: string | null
  timelineSteps: TimelineStep[] | null
  /** Dashboard template preview: share actions are sandboxed. */
  sharePreview?: boolean
  themeVariant?: "classic" | "luxury"
  /** Server-preferred language from Accept-Language or ?lang=. */
  initialLang?: PublicPassportLang
}

export function PassportPublicI18n({
  passportId,
  productName,
  brandName,
  initialStory,
  fallbackStory,
  initialOrigin = null,
  initialCare = null,
  structuredMaterials,
  legacyMaterialsText,
  timelineSteps,
  sharePreview = false,
  themeVariant = "classic",
  initialLang = "en",
}: Props) {
  const isLuxury = themeVariant === "luxury"
  const [lang, setLang] = useState<PublicPassportLang>(initialLang)
  const [story, setStory] = useState<string | null>(initialStory)
  const [origin, setOrigin] = useState<string | null>(initialOrigin)
  const [care, setCare] = useState<string | null>(initialCare)
  const [materials, setMaterials] = useState<Material[] | null>(structuredMaterials)
  const [materialsText, setMaterialsText] = useState<string | null>(legacyMaterialsText)
  const [timeline, setTimeline] = useState<TimelineStep[] | null>(timelineSteps)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailableNote, setUnavailableNote] = useState<string | null>(null)
  const didDetect = useRef(false)

  const applyEnglish = useCallback(() => {
    setStory(initialStory)
    setOrigin(initialOrigin)
    setCare(initialCare)
    setMaterials(structuredMaterials)
    setMaterialsText(legacyMaterialsText)
    setTimeline(timelineSteps)
    setError(null)
    setUnavailableNote(null)
  }, [initialStory, initialOrigin, initialCare, structuredMaterials, legacyMaterialsText, timelineSteps])

  const applyPayload = useCallback(
    (data: ContentPayload, requested: PublicPassportLang) => {
      if (requested !== "en" && !data.found) {
        // Fall back to English copy; keep the switcher on the requested language.
        applyEnglish()
        setUnavailableNote(
          `This passport is not available in ${requested.toUpperCase()} yet. Showing English.`,
        )
        return
      }
      setUnavailableNote(null)
      setStory(data.story || null)
      setOrigin(data.origin)
      setCare(data.care)
      setMaterials(Array.isArray(data.materials) ? data.materials : [])
      setMaterialsText(data.materialsText ?? data.legacyMaterials ?? null)
      setTimeline(Array.isArray(data.timeline) ? data.timeline : [])
    },
    [applyEnglish],
  )

  const loadLanguage = useCallback(
    async (code: PublicPassportLang) => {
      setError(null)
      if (code === "en") {
        applyEnglish()
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/public/passport/${passportId}/content?lang=${code}`)
        const data = (await res.json()) as ContentPayload & { error?: string }
        if (!res.ok) {
          setError(data.error || "Could not load translation")
          applyEnglish()
          return
        }
        applyPayload(data, code)
      } catch {
        setError("Could not load translation")
        applyEnglish()
      } finally {
        setLoading(false)
      }
    },
    [passportId, applyEnglish, applyPayload],
  )

  // Prefer server-provided lang; otherwise auto-detect browser language once.
  useEffect(() => {
    if (didDetect.current) return
    didDetect.current = true
    if (initialLang !== "en") {
      void loadLanguage(initialLang)
      return
    }
    const preferred = detectPreferredPassportLang()
    if (preferred === "en") return
    setLang(preferred)
    void loadLanguage(preferred)
  }, [loadLanguage, initialLang])

  const onChangeLang = async (code: PublicPassportLang) => {
    setLang(code)
    await loadLanguage(code)
  }

  const storyDisplay =
    (story && story.trim()) ||
    fallbackStory ||
    `${brandName} publishes digital product records so customers can verify authenticity in one scan.`

  const matList = materials?.filter((m) => m?.name || m?.source) ?? []
  const timeList = timeline?.filter((t) => t?.stepName || t?.location || t?.date) ?? []
  const showMaterialsText = matList.length === 0 && Boolean(materialsText?.trim())

  return (
    <div className="space-y-4">
      <div
        className={clsx(
          "flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2",
          isLuxury
            ? "border border-amber-200/15 bg-slate-950/30"
            : "border border-ds-border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
        )}
      >
        <span
          className={clsx(
            "text-xs font-semibold uppercase tracking-widest",
            isLuxury ? "text-amber-200/60" : "text-slate-400",
          )}
        >
          Passport language
        </span>
        <div className="flex items-center gap-2">
          <select
            className={clsx(
              "rounded-lg border px-2 py-1.5 text-sm",
              isLuxury
                ? "border-amber-200/20 bg-slate-900 text-amber-50"
                : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
            )}
            value={lang}
            disabled={loading}
            onChange={(e) => void onChangeLang(e.target.value as PublicPassportLang)}
            aria-label="Passport language"
          >
            {PUBLIC_PASSPORT_LANG_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.flag} {o.label}
              </option>
            ))}
          </select>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
        </div>
      </div>

      {unavailableNote ? (
        <div
          className={clsx(
            "rounded-xl border px-3 py-2 text-xs",
            isLuxury
              ? "border-amber-200/20 bg-slate-900/60 text-amber-100/80"
              : "border-slate-200 bg-slate-50 text-slate-600",
          )}
          role="status"
        >
          {unavailableNote}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      <PassportSharePanel
        passportId={passportId}
        productName={productName}
        mode={sharePreview ? "preview" : "live"}
      />

      {(origin?.trim() || care?.trim()) && (
        <div
          className={clsx(
            "grid gap-3 text-sm sm:grid-cols-2",
            isLuxury ? "text-slate-300" : "text-slate-600 dark:text-slate-300",
          )}
        >
          {origin?.trim() ? (
            <div
              className={clsx(
                "space-y-1 p-4",
                isLuxury
                  ? "rounded-2xl border border-amber-200/15"
                  : "rounded-2xl border border-ds-border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
              )}
            >
              <h2
                className={clsx(
                  "text-xs font-semibold uppercase tracking-widest",
                  isLuxury ? "text-amber-200/60" : "text-slate-400",
                )}
              >
                Origin
              </h2>
              <p className={clsx("font-medium", isLuxury ? "text-amber-50" : "text-slate-900")}>
                {origin}
              </p>
            </div>
          ) : null}
          {care?.trim() ? (
            <div
              className={clsx(
                "space-y-1 p-4",
                isLuxury
                  ? "rounded-2xl border border-amber-200/15"
                  : "rounded-2xl border border-ds-border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950",
              )}
            >
              <h2
                className={clsx(
                  "text-xs font-semibold uppercase tracking-widest",
                  isLuxury ? "text-amber-200/60" : "text-slate-400",
                )}
              >
                Care
              </h2>
              <p className={clsx("font-medium", isLuxury ? "text-amber-50" : "text-slate-900")}>
                {care}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <figure
        className={clsx(
          "border-y py-8",
          isLuxury ? "border-amber-200/15" : "border-ds-border dark:border-slate-700/60",
        )}
      >
        <figcaption
          className={clsx(
            "mb-4 text-xs font-semibold uppercase tracking-widest",
            isLuxury ? "text-amber-200/60" : "text-slate-500 dark:text-slate-400",
          )}
        >
          Story
        </figcaption>
        <blockquote
          className={clsx(
            "font-serif text-lg italic leading-relaxed",
            isLuxury ? "text-slate-300" : "text-slate-700 dark:text-slate-300",
          )}
        >
          {storyDisplay}
        </blockquote>
      </figure>

      {matList.length > 0 ? (
        <div
          className={clsx(
            "space-y-3 p-5 text-sm",
            isLuxury
              ? "rounded-3xl border border-amber-200/15 text-slate-300"
              : "rounded-3xl border border-ds-border bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
          )}
        >
          <h2
            className={clsx(
              "text-xs font-semibold uppercase tracking-widest",
              isLuxury ? "text-amber-200/60" : "text-slate-400",
            )}
          >
            Materials
          </h2>
          <ul className="space-y-2">
            {matList.map((m, i) => (
              <li key={i} className="rounded-xl border border-ds-border bg-canvas px-3 py-2">
                <span className="font-medium text-slate-900">{m.name ?? "—"}</span>
                {m.source ? <span className="text-slate-500"> — {m.source}</span> : null}
                {m.sustainabilityTag ? (
                  <span className="mt-1 block text-xs text-emerald-700">{m.sustainabilityTag}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : showMaterialsText ? (
        <div
          className={clsx(
            "space-y-2 p-5 text-sm",
            isLuxury
              ? "rounded-3xl border border-amber-200/15 text-slate-300"
              : "rounded-3xl border border-ds-border bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
          )}
        >
          <h2
            className={clsx(
              "text-xs font-semibold uppercase tracking-widest",
              isLuxury ? "text-amber-200/60" : "text-slate-400",
            )}
          >
            Materials
          </h2>
          <p className="whitespace-pre-wrap">{materialsText}</p>
        </div>
      ) : null}

      {timeList.length > 0 ? (
        <div
          className={clsx(
            "space-y-3 p-5 text-sm",
            isLuxury
              ? "rounded-3xl border border-amber-200/15 text-slate-300"
              : "rounded-3xl border border-ds-border bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
          )}
        >
          <h2
            className={clsx(
              "text-xs font-semibold uppercase tracking-widest",
              isLuxury ? "text-amber-200/60" : "text-slate-400",
            )}
          >
            Timeline
          </h2>
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
