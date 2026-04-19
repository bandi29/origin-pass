"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { Link } from "@/i18n/navigation"
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react"
import clsx from "clsx"
import { getCountryOptions, getStateOptionsByCountryName } from "@/lib/location-options"
import type { MaterialRow, TimelineRow } from "@/lib/passport-wizard-schemas"

const CATEGORIES = ["Fashion", "Food", "Electronics", "Home", "Crafts", "Other"] as const

const STEPS = [
  { n: 1, label: "Product Info" },
  { n: 2, label: "Passport Details" },
  { n: 3, label: "QR Generate" },
  { n: 4, label: "Done" },
] as const

function useDebouncedCallback<T extends unknown[]>(
  fn: (...args: T) => void | Promise<void>,
  delay: number
) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback(
    (...args: T) => {
      if (t.current) clearTimeout(t.current)
      t.current = setTimeout(() => {
        void fn(...args)
      }, delay)
    },
    [fn, delay]
  )
}

export function PassportCreationWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const step = Math.min(4, Math.max(1, Number(searchParams.get("step")) || 1))
  const productIdParam = searchParams.get("productId") || ""
  const passportIdParam = searchParams.get("passportId") || ""

  const [productId, setProductId] = useState(productIdParam)
  const [passportId, setPassportId] = useState(passportIdParam)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [originRegion, setOriginRegion] = useState("")

  const [story, setStory] = useState("")
  const [materials, setMaterials] = useState<MaterialRow[]>([{ name: "", source: "", sustainabilityTag: "" }])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [draftHydrated, setDraftHydrated] = useState(() => !productIdParam)

  const countryOptions = useMemo(() => getCountryOptions(), [])
  const regionOptions = useMemo(
    () => getStateOptionsByCountryName(originCountry),
    [originCountry]
  )

  /** Heuristic 0–100 score from wizard fields (real-time feedback in sidebar). */
  const dppReadinessScore = useMemo(() => {
    let pts = 0
    if (name.trim().length >= 3) pts += 22
    if (description.trim().length > 0) pts += 10
    if (category) pts += 10
    if (originCountry) pts += 14
    if (originRegion) pts += 10
    if (story.trim().length > 40) pts += 14
    const mat = materials.filter((m) => m.name?.trim() || m.source?.trim())
    pts += Math.min(16, mat.length * 5)
    const tl = timeline.filter((t) => t.stepName?.trim())
    if (tl.length) pts += Math.min(4, tl.length * 2)
    return Math.min(100, Math.round(pts))
  }, [name, description, category, originCountry, originRegion, story, materials, timeline])

  useEffect(() => {
    setProductId(productIdParam)
  }, [productIdParam])

  useEffect(() => {
    setPassportId(passportIdParam)
  }, [passportIdParam])

  useEffect(() => {
    if (!productIdParam) return
    let cancelled = false
    setLoadError(null)
    ;(async () => {
      const res = await fetch(`/api/products/${productIdParam}`)
      if (!res.ok) {
        if (!cancelled) {
          setLoadError("Could not load saved data.")
          setDraftHydrated(true)
        }
        return
      }
      const data = await res.json()
      if (cancelled) return
      const p = data.product
      if (p) {
        setName(p.name ?? "")
        setDescription(p.description ?? "")
        setCategory(p.category ?? "")
        setOriginCountry(p.originCountry ?? "")
        setOriginRegion(p.originRegion ?? "")
      }
      const pass = data.passport
      if (pass) {
        setPassportId(pass.id)
        setStory(pass.story ?? "")
        if (Array.isArray(pass.materials) && pass.materials.length) {
          setMaterials(
            pass.materials.map((m: MaterialRow) => ({
              name: m.name ?? "",
              source: m.source ?? "",
              sustainabilityTag: m.sustainabilityTag ?? "",
            }))
          )
        }
        if (Array.isArray(pass.timeline) && pass.timeline.length) {
          setTimeline(
            pass.timeline.map((t: TimelineRow) => ({
              stepName: t.stepName ?? "",
              location: t.location ?? "",
              date: t.date ?? "",
            }))
          )
        }
      }
      if (!cancelled) setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [productIdParam])

  const setQuery = useCallback(
    (next: { step: number; productId?: string; passportId?: string }) => {
      const q = new URLSearchParams()
      q.set("step", String(next.step))
      if (next.productId) q.set("productId", next.productId)
      if (next.passportId) q.set("passportId", next.passportId)
      router.push(`/dashboard/products/passport-wizard?${q.toString()}`)
    },
    [router]
  )

  const saveProductPatch = useCallback(async () => {
    if (!productId || name.trim().length < 3) return
    await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description || null,
        category: category || null,
        originCountry: originCountry || null,
        originRegion: originRegion || null,
      }),
    })
  }, [productId, name, description, category, originCountry, originRegion])

  const debouncedSaveProduct = useDebouncedCallback(saveProductPatch, 800)

  useEffect(() => {
    if (step === 1 && productId && draftHydrated) {
      debouncedSaveProduct()
    }
  }, [
    step,
    productId,
    draftHydrated,
    name,
    description,
    category,
    originCountry,
    originRegion,
    debouncedSaveProduct,
  ])

  const savePassportPost = useCallback(async () => {
    if (!productId) return
    const res = await fetch("/api/passport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        story: story || null,
        materials: materials.filter((m) => m.name || m.source || m.sustainabilityTag),
        timeline: timeline.filter((t) => t.stepName || t.location || t.date),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.passportId) {
      setPassportId(data.passportId)
    }
  }, [productId, story, materials, timeline])

  const debouncedSavePassport = useDebouncedCallback(savePassportPost, 800)

  useEffect(() => {
    if (step === 2 && productId && draftHydrated) {
      debouncedSavePassport()
    }
  }, [step, productId, draftHydrated, story, materials, timeline, debouncedSavePassport])

  async function handleContinueStep1(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    if (name.trim().length < 3) {
      setActionError("Product name must be at least 3 characters.")
      return
    }
    setLoading(true)
    try {
      if (productId) {
        await saveProductPatch()
        setQuery({ step: 2, productId, passportId: passportId || undefined })
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description || null,
            category: category || null,
            originCountry: originCountry || null,
            originRegion: originRegion || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionError(data.error || "Could not save product.")
          return
        }
        setProductId(data.productId)
        setQuery({ step: 2, productId: data.productId })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleContinueStep2(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    if (!productId) {
      setActionError("Missing product. Go back to step 1.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          story: story || null,
          materials: materials.filter((m) => m.name || m.source || m.sustainabilityTag),
          timeline: timeline.filter((t) => t.stepName || t.location || t.date),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "Could not save passport.")
        return
      }
      setPassportId(data.passportId)
      setQuery({ step: 3, productId, passportId: data.passportId })
    } finally {
      setLoading(false)
    }
  }

  async function handleAiGenerateStory() {
    if (!productId) {
      setActionError("Save product info first (step 1).")
      return
    }
    setActionError(null)
    setAiGenLoading(true)
    try {
      const res = await fetch("/api/ai/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "Could not generate story.")
        return
      }
      if (typeof data.story === "string") setStory(data.story)
    } finally {
      setAiGenLoading(false)
    }
  }

  async function handleGenerateQr() {
    setActionError(null)
    if (!passportId) {
      setActionError("Passport is not ready. Complete step 2 first.")
      return
    }
    setGeneratingQr(true)
    try {
      const res = await fetch("/api/qrcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "QR generation failed.")
        return
      }
      setQrPreview(data.imageDataUrl)
      setPublicUrl(data.publicPageUrl)
      try {
        sessionStorage.setItem(
          `passportQr:${passportId}`,
          JSON.stringify({ imageDataUrl: data.imageDataUrl, publicPageUrl: data.publicPageUrl })
        )
      } catch {
        /* ignore */
      }
    } finally {
      setGeneratingQr(false)
    }
  }

  function copyLink() {
    if (!publicUrl) return
    void navigator.clipboard.writeText(publicUrl)
  }

  async function shareLink() {
    if (!publicUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: "Product passport", url: publicUrl })
      } catch {
        copyLink()
      }
    } else {
      copyLink()
    }
  }

  useEffect(() => {
    if (step !== 4 || !passportId || typeof window === "undefined") return
    const raw = sessionStorage.getItem(`passportQr:${passportId}`)
    if (!raw) return
    try {
      const { imageDataUrl, publicPageUrl: u } = JSON.parse(raw) as {
        imageDataUrl?: string
        publicPageUrl?: string
      }
      if (imageDataUrl) setQrPreview(imageDataUrl)
      if (u) setPublicUrl(u)
    } catch {
      /* ignore */
    }
  }, [step, passportId])

  function downloadQr() {
    if (!qrPreview) return
    const a = document.createElement("a")
    a.href = qrPreview
    a.download = `passport-qr-${passportId || "qr"}.png`
    a.click()
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-300 transition focus:ring-2"
  const cardClass = "rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"

  return (
    <div className="w-full rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-10">
          <div className="min-w-0 w-full max-w-4xl flex-1 space-y-10">
            <div className="sticky top-0 z-20 -mx-2 border-b border-slate-200/90 bg-slate-50/95 px-2 pb-4 pt-1 backdrop-blur-md sm:-mx-4 sm:px-4">
              <div className="flex w-full flex-col gap-4">
                <div className="flex w-full min-w-0 items-start justify-between gap-1 sm:gap-3">
                  {STEPS.map((s) => (
                    <div
                      key={s.n}
                      className={clsx(
                        "flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-2.5 sm:text-left",
                        step >= s.n ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                          step > s.n
                            ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/25"
                            : step === s.n
                              ? "bg-slate-900 text-white shadow-md"
                              : "border border-slate-200 bg-white text-slate-400",
                        )}
                        aria-label={
                          step > s.n ? `${s.label} completed` : step === s.n ? `${s.label} current` : `${s.label} pending`
                        }
                      >
                        {step > s.n ? <Check className="h-4 w-4" strokeWidth={2.5} /> : s.n}
                      </span>
                      <span className="w-full max-w-[5.5rem] truncate text-[10px] font-semibold uppercase leading-tight tracking-wide sm:max-w-none sm:text-xs sm:font-medium sm:normal-case sm:leading-snug sm:tracking-normal">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${Math.min(100, (step / 4) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {loadError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            )}

            {actionError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {actionError}
              </div>
            )}

            {step === 1 && (
              <form onSubmit={handleContinueStep1} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">Create product</h2>
                  <p className="text-base text-slate-600">Basic catalog information for this item.</p>
                </div>

                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Product info</h3>
                  <p className="mt-1 text-xs text-slate-500">Name and description as shown in your catalog.</p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Product name *</label>
                      <input
                        className={inputClass}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        minLength={3}
                        placeholder="e.g. Linen tote bag"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Description</label>
                      <textarea
                        className={`${inputClass} min-h-[100px]`}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description for your catalog"
                      />
                    </div>
                  </div>
                </div>

                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Category</h3>
                  <p className="mt-1 text-xs text-slate-500">Helps structure passport and compliance fields.</p>
                  <select
                    className={`${inputClass} mt-4 bg-white`}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Origin</h3>
                  <p className="mt-1 text-xs text-slate-500">Where this product is made or sourced.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Origin country</label>
                      <select
                        className={`${inputClass} bg-white`}
                        value={originCountry}
                        onChange={(e) => {
                          setOriginCountry(e.target.value)
                          setOriginRegion("")
                        }}
                      >
                        <option value="">Select country</option>
                        {countryOptions.map((c) => (
                          <option key={c.isoCode} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Region</label>
                      {regionOptions.length > 0 ? (
                        <select
                          className={`${inputClass} bg-white`}
                          value={originRegion}
                          onChange={(e) => setOriginRegion(e.target.value)}
                        >
                          <option value="">Select region</option>
                          {regionOptions.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={inputClass}
                          value={originRegion}
                          onChange={(e) => setOriginRegion(e.target.value)}
                          placeholder="State / region"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
          <form onSubmit={handleContinueStep2} className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">Passport details</h2>
              <p className="text-base text-slate-600">Tell the story behind your product.</p>
            </div>

            <div className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Story</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Brand narrative for the digital passport</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={aiGenLoading || !productId}
                    onClick={() => void handleAiGenerateStory()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 transition hover:bg-violet-100 disabled:opacity-50"
                  >
                    {aiGenLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    ✨ Generate story
                  </button>
                  {story.trim() ? (
                    <button
                      type="button"
                      disabled={aiGenLoading || !productId}
                      onClick={() => void handleAiGenerateStory()}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  ) : null}
                </div>
              </div>
              <textarea
                className={`${inputClass} mt-4 min-h-[120px]`}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Craft heritage, makers, and what makes this product special."
              />
              <p className="mt-2 text-xs text-slate-400">
                Uses product name, category, origin, and description from step 1. Edit freely after generation.
              </p>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Materials</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Components and provenance</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMaterials((m) => [...m, { name: "", source: "", sustainabilityTag: "" }])
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Add material
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {materials.map((row, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-3"
                  >
                    <input
                      placeholder="Material name"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={row.name ?? ""}
                      onChange={(e) => {
                        const next = [...materials]
                        next[i] = { ...next[i], name: e.target.value }
                        setMaterials(next)
                      }}
                    />
                    <input
                      placeholder="Source"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={row.source ?? ""}
                      onChange={(e) => {
                        const next = [...materials]
                        next[i] = { ...next[i], source: e.target.value }
                        setMaterials(next)
                      }}
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="Sustainability tag"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                        value={row.sustainabilityTag ?? ""}
                        onChange={(e) => {
                          const next = [...materials]
                          next[i] = { ...next[i], sustainabilityTag: e.target.value }
                          setMaterials(next)
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                        onClick={() => setMaterials((m) => m.filter((_, j) => j !== i))}
                        aria-label="Remove material"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Timeline (optional)</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Supply chain or production milestones</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTimeline((t) => [...t, { stepName: "", location: "", date: "" }])
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Add step
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {timeline.map((row, i) => (
                  <div
                    key={i}
                    className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      placeholder="Step name"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={row.stepName ?? ""}
                      onChange={(e) => {
                        const next = [...timeline]
                        next[i] = { ...next[i], stepName: e.target.value }
                        setTimeline(next)
                      }}
                    />
                    <input
                      placeholder="Location"
                      className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                      value={row.location ?? ""}
                      onChange={(e) => {
                        const next = [...timeline]
                        next[i] = { ...next[i], location: e.target.value }
                        setTimeline(next)
                      }}
                    />
                    <div className="flex gap-2 sm:col-span-1">
                      <input
                        type="date"
                        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                        value={row.date ?? ""}
                        onChange={(e) => {
                          const next = [...timeline]
                          next[i] = { ...next[i], date: e.target.value }
                          setTimeline(next)
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-white hover:text-rose-600"
                        onClick={() => setTimeline((t) => t.filter((_, j) => j !== i))}
                        aria-label="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuery({ step: 1, productId })}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </form>
            )}

            {step === 3 && (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">QR code</h2>
              <p className="text-base text-slate-600">
                QR opens{" "}
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-sm">/scan/{"{passportId}"}</code>{" "}
                (tracked) then the public passport page.
              </p>
            </div>

            <div className={cardClass}>
            {!qrPreview ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12">
                <button
                  type="button"
                  onClick={() => void handleGenerateQr()}
                  disabled={generatingQr || !passportId}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate QR
                </button>
                {!passportId && (
                  <p className="mt-3 text-center text-xs text-rose-600">Complete passport details first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrPreview} alt="QR code" className="h-full w-full object-contain" />
                </div>
                {publicUrl && (
                  <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
                    {publicUrl}
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => downloadQr()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" /> Download QR
                  </button>
                  <button
                    type="button"
                    onClick={() => copyLink()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" /> Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareLink()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>
              </div>
            )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuery({ step: 2, productId, passportId })}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!qrPreview}
                onClick={() => setQuery({ step: 4, productId, passportId })}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
            )}

            {step === 4 && (
          <div className={`${cardClass} space-y-6 text-center`}>
            <div className="text-4xl" aria-hidden>
              🎉
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your Product Passport is Live</h2>
            <p className="text-sm text-slate-600">
              Customers can scan your QR or open the public link to see verified product information.
            </p>
            {qrPreview && (
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrPreview} alt="" className="h-full w-full object-contain" />
              </div>
            )}
            {publicUrl && (
              <p className="mx-auto max-w-md break-all rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
                {publicUrl}
              </p>
            )}
            <div className="flex flex-col items-stretch gap-2 sm:mx-auto sm:max-w-sm">
              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  View public page
                </a>
              )}
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                disabled
                title="Coming soon"
              >
                Download PDF (soon)
              </button>
              <Link
                href="/dashboard/products/passport-wizard?step=1"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => {
                  try {
                    if (passportId) sessionStorage.removeItem(`passportQr:${passportId}`)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Create another product
              </Link>
            </div>
          </div>
            )}
          </div>

          <aside className="w-full shrink-0 space-y-4 lg:w-72 lg:max-w-[20rem] xl:w-80 lg:sticky lg:top-20 lg:self-start">
            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DPP readiness</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{dppReadinessScore}%</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${dppReadinessScore}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Live estimate from fields in this wizard — not a legal certification.
              </p>
            </div>

            <div className={cardClass}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI story</p>
              </div>
              {aiGenLoading ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-violet-800">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Generating draft…
                </p>
              ) : story.trim() ? (
                <p className="mt-3 text-sm font-medium text-emerald-800">Draft ready — refine in passport details.</p>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Idle — run Generate on step 2 when ready.</p>
              )}
            </div>

            <div className={cardClass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR code</p>
              {generatingQr ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Generating…
                </p>
              ) : qrPreview ? (
                <p className="mt-3 text-sm font-medium text-emerald-800">Ready — download or share in step 3.</p>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Not generated yet — complete step 3.</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Changes save automatically while you work (debounced).
      </p>
    </div>
  )
}
