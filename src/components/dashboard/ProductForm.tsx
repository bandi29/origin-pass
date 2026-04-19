"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { createProduct } from "@/actions/create-product"
import { createClient } from "@/lib/supabase/client"
import { uploadProductImageClient, validateFile } from "@/lib/upload-product-image-client"
import { isSafeImageUrl } from "@/lib/security"
import { getCountryOptions, getStateOptionsByCountryName } from "@/lib/location-options"
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, Circle, Eye, ArrowRight, X, Upload, Link2 } from "lucide-react"
import { PassportPagePreviewCard } from "@/components/passports/PassportPagePreviewCard"
import { PhotoToPassportCard } from "@/components/dashboard/PhotoToPassportCard"
import { FieldTooltip } from "@/components/ui/FieldTooltip"
import { useRouter } from "@/i18n/navigation"

const COMMON_MATERIALS = [
  "Leather",
  "Cotton",
  "Wool",
  "Silk",
  "Linen",
  "Metal",
  "Brass",
  "Wood",
  "Bamboo",
  "Recycled materials",
  "Organic cotton",
  "Vegetable-tanned leather",
]

// Future: Consider multi-step form (Step 1: Basic Info, Step 2: Materials & Origin, Step 3: Sustainability & Lifecycle, Step 4: Review)

const LIFESPAN_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "1-5", label: "1–5 years" },
  { value: "5-10", label: "5–10 years" },
  { value: "10-20", label: "10–20 years" },
  { value: "20+", label: "20+ years" },
]

import { loadDraft, saveDraft, clearDraft, type ProductFormDraft } from "@/lib/product-form-draft"

const DEBUG_PRODUCT_FORM = process.env.NODE_ENV !== "production"

export default function ProductForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [story, setStory] = useState("")
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
  const [materialsOther, setMaterialsOther] = useState("")
  const [originCountry, setOriginCountry] = useState("")
  const [originState, setOriginState] = useState("")
  const [originCity, setOriginCity] = useState("")
  const [originOther, setOriginOther] = useState("")
  const [repairable, setRepairable] = useState<string>("")
  const [lifespan, setLifespan] = useState("")
  const [recyclable, setRecyclable] = useState<string>("")
  const [lastCreatedProduct, setLastCreatedProduct] = useState<{
    name: string
    story: string
    materials: string
    origin: string
    lifecycle: string
    imageUrl: string
  } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload")
  const [imageUrl, setImageUrl] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [fieldHints, setFieldHints] = useState<{ sustainability?: string; lifecycle?: string }>({})
  const [pendingDraft, setPendingDraft] = useState<ProductFormDraft | null>(null)
  const [citySuggestions, setCitySuggestions] = useState<string[]>([])
  const [loadingCitySuggestions, setLoadingCitySuggestions] = useState(false)
  const [cityLookupMessage, setCityLookupMessage] = useState<string | null>(null)
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const countryOptions = useMemo(() => getCountryOptions(), [])
  const stateOptions = useMemo(() => {
    if (!originCountry || originCountry === "Other") return []
    return getStateOptionsByCountryName(originCountry)
  }, [originCountry])

  useEffect(() => {
    const query = originCity.trim()
    if (!originCountry || originCountry === "Other" || query.length < 2) {
      setCitySuggestions([])
      setLoadingCitySuggestions(false)
      setCityLookupMessage(null)
      return
    }

    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoadingCitySuggestions(true)
      setCityLookupMessage(null)
      try {
        const params = new URLSearchParams({
          q: query,
          country: originCountry,
        })
        if (originState.trim()) {
          params.set("state", originState.trim())
        }
        const response = await fetch(`/api/geocoding/cities?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          setCitySuggestions([])
          setCityLookupMessage("Could not load city suggestions. You can type manually.")
          return
        }
        const payload = (await response.json()) as {
          suggestions?: string[]
          fallback?: boolean
          reason?: "rate_limited" | "provider_error" | "invalid_request"
        }
        const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
        setCitySuggestions(suggestions)
        if (payload.fallback && suggestions.length === 0) {
          setCityLookupMessage(
            payload.reason === "rate_limited"
              ? "Autocomplete is temporarily busy. Please type city/place manually."
              : "Could not load city suggestions. You can type manually."
          )
        }
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return
        setCitySuggestions([])
        setCityLookupMessage("Could not load city suggestions. You can type manually.")
      } finally {
        setLoadingCitySuggestions(false)
      }
    }, 350)

    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [originCountry, originState, originCity])

  const basicInfoRef = useRef<HTMLDivElement>(null)
  const sustainabilityRef = useRef<HTMLDivElement>(null)
  const lifecycleRef = useRef<HTMLDivElement>(null)

  // Ref holds latest form state - avoids stale closure when saving draft during upload
  const formStateRef = useRef({
    productName,
    story,
    selectedMaterials,
    materialsOther,
    originCountry,
    originState,
    originCity,
    originOther,
    repairable,
    lifespan,
    recyclable,
    imageUrl,
  })
  formStateRef.current = {
    productName,
    story,
    selectedMaterials,
    materialsOther,
    originCountry,
    originState,
    originCity,
    originOther,
    repairable,
    lifespan,
    recyclable,
    imageUrl,
  }

  // Persist draft when form has content (debounced) - ensures we have latest state before upload
  useEffect(() => {
    const hasContent =
      productName.trim() ||
      story.trim() ||
      selectedMaterials.length > 0 ||
      materialsOther.trim() ||
      originCountry ||
      originState.trim() ||
      originCity.trim() ||
      originOther.trim() ||
      repairable ||
      lifespan ||
      recyclable ||
      imageUrl
    if (!hasContent) return
    const t = setTimeout(() => {
      formStateRef.current = {
        productName,
        story,
        selectedMaterials,
        materialsOther,
        originCountry,
        originState,
        originCity,
        originOther,
        repairable,
        lifespan,
        recyclable,
        imageUrl,
      }
      saveDraft(formStateRef.current)
    }, 500)
    return () => clearTimeout(t)
  }, [
    productName,
    story,
    selectedMaterials,
    materialsOther,
    originCountry,
    originState,
    originCity,
    originOther,
    repairable,
    lifespan,
    recyclable,
    imageUrl,
  ])

  // Detect draft on mount and let user decide to resume or discard.
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setPendingDraft(draft)
    }
  }, [])

  function applyDraft(draft: ProductFormDraft) {
    const normalizedDraft: ProductFormDraft = {
      productName: draft.productName ?? "",
      story: draft.story ?? "",
      selectedMaterials: Array.isArray(draft.selectedMaterials) ? draft.selectedMaterials : [],
      materialsOther: draft.materialsOther ?? "",
      originCountry: draft.originCountry ?? "",
      originState: draft.originState ?? "",
      originCity: draft.originCity ?? "",
      originOther: draft.originOther ?? "",
      repairable: draft.repairable ?? "",
      lifespan: draft.lifespan ?? "",
      recyclable: draft.recyclable ?? "",
      imageUrl: draft.imageUrl ?? "",
    }

    setProductName(normalizedDraft.productName)
    setStory(normalizedDraft.story)
    setSelectedMaterials(normalizedDraft.selectedMaterials)
    setMaterialsOther(normalizedDraft.materialsOther)
    setOriginCountry(normalizedDraft.originCountry)
    setOriginState(normalizedDraft.originState)
    setOriginCity(normalizedDraft.originCity)
    setOriginOther(normalizedDraft.originOther)
    setRepairable(normalizedDraft.repairable)
    setLifespan(normalizedDraft.lifespan)
    setRecyclable(normalizedDraft.recyclable)
    if (normalizedDraft.imageUrl) {
      setImageUrl(normalizedDraft.imageUrl)
      setImagePreview(normalizedDraft.imageUrl)
    } else {
      setImageUrl("")
      setImagePreview(null)
    }
    formStateRef.current = normalizedDraft
    saveDraft(normalizedDraft)
    setPendingDraft(null)
    setCitySuggestions([])
    setShowCitySuggestions(false)
    setMessage("Draft restored. You can continue editing where you left off.")
  }

  function discardPendingDraft() {
    clearDraft()
    setPendingDraft(null)
    setMessage("Saved draft removed.")
  }

  function getCurrentDraftForAi(): ProductFormDraft {
    const s = formStateRef.current
    return {
      productName: s.productName,
      story: s.story,
      selectedMaterials: s.selectedMaterials,
      materialsOther: s.materialsOther,
      originCountry: s.originCountry,
      originState: s.originState,
      originCity: s.originCity,
      originOther: s.originOther,
      repairable: s.repairable,
      lifespan: s.lifespan,
      recyclable: s.recyclable,
      imageUrl: s.imageUrl,
    }
  }

  function applyImportedPhotoDraft(draft: ProductFormDraft) {
    setProductName(draft.productName)
    setStory(draft.story)
    setSelectedMaterials(draft.selectedMaterials)
    setMaterialsOther(draft.materialsOther)
    setOriginCountry(draft.originCountry)
    setOriginState(draft.originState)
    setOriginCity(draft.originCity)
    setOriginOther(draft.originOther)
    setRepairable(draft.repairable)
    setLifespan(draft.lifespan)
    setRecyclable(draft.recyclable)
    if (draft.imageUrl) {
      setImageUrl(draft.imageUrl)
      setImagePreview(draft.imageUrl)
    }
    formStateRef.current = {
      productName: draft.productName,
      story: draft.story,
      selectedMaterials: draft.selectedMaterials,
      materialsOther: draft.materialsOther,
      originCountry: draft.originCountry,
      originState: draft.originState,
      originCity: draft.originCity,
      originOther: draft.originOther,
      repairable: draft.repairable,
      lifespan: draft.lifespan,
      recyclable: draft.recyclable,
      imageUrl: draft.imageUrl,
    }
    saveDraft(draft)
    setPendingDraft(null)
    setCitySuggestions([])
    setShowCitySuggestions(false)
    setMessage("Draft filled from your photo. Review and edit before creating the product.")
    scrollToSection("basic")
  }

  function formatDraftAge(savedAt?: number): string {
    if (!savedAt) return "Saved recently"
    const diffMs = Date.now() - savedAt
    const mins = Math.floor(diffMs / (60 * 1000))
    if (mins < 1) return "Saved just now"
    if (mins < 60) return `Saved ${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Saved ${hours}h ago`
    const days = Math.floor(hours / 24)
    return `Saved ${days}d ago`
  }

  // Clear field hints when user completes the section
  useEffect(() => {
    const hasMaterials = selectedMaterials.length > 0 || materialsOther.trim().length > 0
    const hasOrigin = (originCountry && originCountry !== "Other") || (originCountry === "Other" && originOther.trim()) || originState.trim().length > 0 || originCity.trim().length > 0
    const hasLifecycle = repairable && lifespan && recyclable
    setFieldHints((prev) => ({
      sustainability: hasMaterials && hasOrigin ? undefined : prev.sustainability,
      lifecycle: hasLifecycle ? undefined : prev.lifecycle,
    }))
  }, [selectedMaterials, materialsOther, originCountry, originState, originOther, originCity, repairable, lifespan, recyclable])

  function scrollToSection(section: "basic" | "sustainability" | "lifecycle") {
    const ref = section === "basic" ? basicInfoRef : section === "sustainability" ? sustainabilityRef : lifecycleRef
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Completion indicator: Basic Info ✓, Sustainability ⚠, Lifecycle ☐
  const completion = useMemo(() => {
    const basicComplete = productName.trim().length > 0
    const hasMaterials = selectedMaterials.length > 0 || materialsOther.trim().length > 0
    const hasOrigin = (originCountry && originCountry !== "Other") || (originCountry === "Other" && originOther.trim()) || originState.trim().length > 0 || originCity.trim().length > 0
    const sustainabilityComplete = hasMaterials && hasOrigin
    const sustainabilityPartial = hasMaterials || hasOrigin
    const lifecycleComplete = repairable && lifespan && recyclable
    const lifecyclePartial = repairable || lifespan || recyclable

    const basic = basicComplete ? "complete" : "empty"
    const sustainability = sustainabilityComplete ? "complete" : sustainabilityPartial ? "partial" : "empty"
    const lifecycle = lifecycleComplete ? "complete" : lifecyclePartial ? "partial" : "empty"

    const total = [basic, sustainability, lifecycle]
    const filled = total.filter((s) => s === "complete").length
    const partial = total.filter((s) => s === "partial").length
    const pct = Math.round(((filled * 100 + partial * 40) / 3))

    return { basic, sustainability, lifecycle, pct: Math.min(100, pct) }
  }, [productName, selectedMaterials, materialsOther, originCountry, originState, originOther, originCity, repairable, lifespan, recyclable])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const continueToBatch = submitter?.getAttribute("data-continue") === "true"

    // Persist draft immediately before submit - ensures image and all fields are saved
    // if create fails or user navigates away during the request
    const state = formStateRef.current
    saveDraft({
      productName: state.productName,
      story: state.story,
      selectedMaterials: state.selectedMaterials,
      materialsOther: state.materialsOther,
      originCountry: state.originCountry,
      originState: state.originState,
      originCity: state.originCity,
      originOther: state.originOther,
      repairable: state.repairable,
      lifespan: state.lifespan,
      recyclable: state.recyclable,
      imageUrl: state.imageUrl,
    })

    // Field-level validation hints (soft - don't block)
    const hasMaterials = selectedMaterials.length > 0 || materialsOther.trim().length > 0
    const hasOrigin = (originCountry && originCountry !== "Other") || (originCountry === "Other" && originOther.trim()) || originState.trim().length > 0 || originCity.trim().length > 0
    const hasLifecycle = repairable && lifespan && recyclable
    setFieldHints({
      sustainability: !hasMaterials || !hasOrigin ? "Materials and Origin data improve EU DPP compliance score." : undefined,
      lifecycle: !hasLifecycle ? "Lifecycle data improves EU DPP compliance score." : undefined,
    })

    setLoading(true)
    setMessage(null)

    const form = event.currentTarget
    const formData = new FormData(form)

    // Build materials from multi-select + other
    const materialsParts = [...selectedMaterials]
    if (materialsOther.trim()) materialsParts.push(materialsOther.trim())
    formData.set("materials", materialsParts.join(", ") || "")

    // Build origin from country (+ other if "Other") + city
    const countryDisplay = originCountry === "Other" ? originOther.trim() : originCountry
    const originParts = [countryDisplay, originState, originCity].filter(Boolean)
    formData.set("origin", originParts.join(", ") || "")

    // Use image from upload or URL
    const finalImageUrl = imageUrl || String(formData.get("imageUrl") || "").trim()
    formData.set("imageUrl", finalImageUrl)
    if (DEBUG_PRODUCT_FORM) {
      console.info("[ProductForm] submit_start", {
        hasImageUrl: !!finalImageUrl,
        imageUrlLength: finalImageUrl.length,
        mode: imageMode,
      })
    }

    // Build lifecycle from structured fields
    const lifecycleParts: string[] = []
    if (repairable) lifecycleParts.push(`Repairable: ${repairable}`)
    if (lifespan) lifecycleParts.push(`Expected lifespan: ${LIFESPAN_OPTIONS.find((o) => o.value === lifespan)?.label || lifespan}`)
    if (recyclable) lifecycleParts.push(`Recyclable: ${recyclable}`)
    formData.set("lifecycle", lifecycleParts.join(". ") || "")

    try {
      const result = await createProduct(formData)
      if (DEBUG_PRODUCT_FORM) {
        console.info("[ProductForm] submit_result", {
          success: result.success,
          error: result.success ? null : result.error ?? null,
          productId: result.success ? (result.productId ?? null) : null,
        })
      }

      if (!result.success) {
        setMessage(result.error || "Unable to create product")
      } else {
        const materialsStr = materialsParts.join(", ")
        const originStr = originParts.join(", ")
        const lifecycleStr = lifecycleParts.join(". ")
        const finalImageUrl = imageUrl || String(formData.get("imageUrl") || "").trim()
        setLastCreatedProduct({
          name: formData.get("name") as string,
          story: formData.get("story") as string,
          materials: materialsStr,
          origin: originStr,
          lifecycle: lifecycleStr,
          imageUrl: finalImageUrl,
        })
        setMessage(continueToBatch ? "Product created. Redirecting…" : "Product saved. Add another or preview your passport.")
        setFieldHints({})
        form.reset()
        setProductName("")
        setStory("")
        setSelectedMaterials([])
        setMaterialsOther("")
        setOriginCountry("")
        setOriginState("")
        setOriginCity("")
        setOriginOther("")
        setCitySuggestions([])
        setShowCitySuggestions(false)
        setRepairable("")
        setLifespan("")
        setRecyclable("")
        setImageUrl("")
        setImagePreview(null)
        if (continueToBatch && result.productId) {
          router.push(`/dashboard/batches?productId=${result.productId}`)
        }
      }
    } catch (error) {
      console.error(error)
      if (DEBUG_PRODUCT_FORM) {
        console.error("[ProductForm] submit_exception", {
          message: error instanceof Error ? error.message : String(error),
        })
      }
      setMessage(error instanceof Error ? error.message : "Unable to create product")
    } finally {
      setLoading(false)
    }
  }

  function toggleMaterial(m: string) {
    setSelectedMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    )
  }

  function handleSaveDraft() {
    const state = formStateRef.current
    saveDraft({
      productName: state.productName,
      story: state.story,
      selectedMaterials: state.selectedMaterials,
      materialsOther: state.materialsOther,
      originCountry: state.originCountry,
      originState: state.originState,
      originCity: state.originCity,
      originOther: state.originOther,
      repairable: state.repairable,
      lifespan: state.lifespan,
      recyclable: state.recyclable,
      imageUrl: state.imageUrl,
    })
    setMessage("Draft saved. It will be available when you return, even after signing out.")
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* EU DPP Readiness Score - interactive, clickable sections */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          EU DPP Readiness Score: {completion.pct}%
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => scrollToSection("basic")}
            className={`flex items-center gap-2 text-left w-full py-1 px-2 -mx-2 rounded-lg transition hover:bg-slate-100 ${
              completion.basic === "complete" ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {completion.basic === "complete" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-300 shrink-0" />
            )}
            Basic Info {completion.basic === "complete" ? "✓" : ""}
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection("sustainability"); (sustainabilityRef.current?.querySelector("details") as HTMLDetailsElement)?.setAttribute("open", ""); }}
            className={`flex items-center gap-2 text-left w-full py-1 px-2 -mx-2 rounded-lg transition hover:bg-slate-100 ${
              completion.sustainability === "complete"
                ? "text-emerald-700"
                : completion.sustainability === "partial"
                  ? "text-amber-700"
                  : "text-slate-500"
            }`}
          >
            {completion.sustainability === "complete" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : completion.sustainability === "partial" ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-300 shrink-0" />
            )}
            Sustainability {completion.sustainability === "partial" ? "⚠" : completion.sustainability === "complete" ? "✓" : "☐"}
          </button>
          <button
            type="button"
            onClick={() => { scrollToSection("lifecycle"); (sustainabilityRef.current?.querySelector("details") as HTMLDetailsElement)?.setAttribute("open", ""); }}
            className={`flex items-center gap-2 text-left w-full py-1 px-2 -mx-2 rounded-lg transition hover:bg-slate-100 ${
              completion.lifecycle === "complete"
                ? "text-emerald-700"
                : completion.lifecycle === "partial"
                  ? "text-amber-700"
                  : "text-slate-500"
            }`}
          >
            {completion.lifecycle === "complete" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : completion.lifecycle === "partial" ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-slate-300 shrink-0" />
            )}
            Lifecycle {completion.lifecycle === "partial" ? "⚠" : completion.lifecycle === "complete" ? "✓" : "☐"}
          </button>
        </div>
      </div>

      {/* 1. Helper text block at top */}
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-900">
            Products created here are structured to align with EU Digital Product Passport requirements.
          </p>
          <p className="text-xs text-emerald-700 mt-1">
            Complete the fields below to support traceability and strengthen consumer trust.
          </p>
        </div>
      </div>

      <PhotoToPassportCard
        getCurrentDraft={getCurrentDraftForAi}
        onApplyDraft={applyImportedPhotoDraft}
      />

      {pendingDraft && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-amber-900">
              You have a saved draft from an earlier session. Resume editing or remove it.
            </p>
            <p className="text-xs text-amber-700 mt-0.5">{formatDraftAge(pendingDraft.savedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyDraft(pendingDraft)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
            >
              Resume draft
            </button>
            <button
              type="button"
              onClick={discardPendingDraft}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100 transition"
            >
              Delete draft
            </button>
          </div>
        </div>
      )}

      {/* Basic info */}
      <div
        ref={basicInfoRef}
        className={`rounded-xl p-4 transition-colors ${
          completion.basic !== "complete" ? "bg-amber-50/50 border border-amber-100" : "border border-transparent"
        }`}
      >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Product Name <span className="text-rose-500">*</span>
          </label>
          <input
            name="name"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Handcrafted Leather Satchel"
            className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Product Image (Optional)</label>
          <p className="text-xs text-slate-500">
            Upload from your device or provide an image URL. Max file size: 10MB.
            Recommended: JPG/PNG/WebP around 1-4MB for faster upload.
          </p>

          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                if (imageMode !== "upload") {
                  setImageUrl("")
                  setImagePreview(null)
                }
                setImageMode("upload")
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                imageMode === "upload"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload image
            </button>
            <button
              type="button"
              onClick={() => {
                if (imageMode !== "url") {
                  setImageUrl("")
                  setImagePreview(null)
                }
                setImageMode("url")
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                imageMode === "url"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Link2 className="w-4 h-4" />
              Add image URL
            </button>
          </div>

          {imageMode === "upload" ? (
            <div className="space-y-2">
              <input
                id="product-image-upload"
                data-testid="product-image-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (DEBUG_PRODUCT_FORM) {
                    console.info("[ProductForm] file_selected", {
                      name: file.name,
                      type: file.type,
                      size: file.size,
                    })
                  }
                  const validationError = validateFile(file)
                  if (validationError) {
                    if (DEBUG_PRODUCT_FORM) {
                      console.warn("[ProductForm] file_validation_failed", { validationError })
                    }
                    setMessage(validationError)
                    e.target.value = ""
                    return
                  }
                  setUploadingImage(true)
                  setMessage(null)
                  const state = formStateRef.current
                  saveDraft({
                    productName: state.productName,
                    story: state.story,
                    selectedMaterials: state.selectedMaterials,
                    materialsOther: state.materialsOther,
                    originCountry: state.originCountry,
                    originState: state.originState,
                    originCity: state.originCity,
                    originOther: state.originOther,
                    repairable: state.repairable,
                    lifespan: state.lifespan,
                    recyclable: state.recyclable,
                    imageUrl: state.imageUrl,
                  })
                  try {
                    const supabase = createClient()
                    if (DEBUG_PRODUCT_FORM) {
                      console.info("[ProductForm] upload_call_start")
                    }
                    const timeout = new Promise<never>((_, reject) =>
                      setTimeout(() => reject(new Error("Upload timed out. Check your connection and try again.")), 15000)
                    )
                    const res = await Promise.race([uploadProductImageClient(file, supabase), timeout])
                    if (res.success && res.url) {
                      if (DEBUG_PRODUCT_FORM) {
                        console.info("[ProductForm] upload_call_success", { url: res.url })
                      }
                      setImageUrl(res.url)
                      setImagePreview(res.url)
                      const state = formStateRef.current
                      saveDraft({
                        productName: state.productName,
                        story: state.story,
                        selectedMaterials: state.selectedMaterials,
                        materialsOther: state.materialsOther,
                        originCountry: state.originCountry,
                        originState: state.originState,
                        originCity: state.originCity,
                        originOther: state.originOther,
                        repairable: state.repairable,
                        lifespan: state.lifespan,
                        recyclable: state.recyclable,
                        imageUrl: res.url,
                      })
                    } else {
                      if (DEBUG_PRODUCT_FORM) {
                        console.warn("[ProductForm] upload_call_failed", { error: res.error ?? null })
                      }
                      setMessage(res.error || "Upload failed")
                    }
                  } catch (err) {
                    if (DEBUG_PRODUCT_FORM) {
                      console.error("[ProductForm] upload_call_exception", {
                        message: err instanceof Error ? err.message : String(err),
                      })
                    }
                    setMessage(err instanceof Error ? err.message : "Upload failed")
                  } finally {
                    setUploadingImage(false)
                  }
                  e.target.value = ""
                }}
                disabled={uploadingImage}
              />
              <label
                htmlFor="product-image-upload"
                className={`group block rounded-xl border-2 border-dashed p-5 text-center transition ${
                  uploadingImage
                    ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 pointer-events-none opacity-70"
                    : "cursor-pointer border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/70"
                }`}
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  Drop your image here, or <span className="text-slate-900 underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  JPG, JPEG, PNG, WebP, GIF • Max 10MB
                </p>
              </label>
              {uploadingImage && <span className="text-xs text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</span>}
              {imagePreview && (
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-16 w-16 shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                        const fallback = e.currentTarget.nextElementSibling
                        if (fallback) (fallback as HTMLElement).classList.remove("hidden")
                      }}
                    />
                    <span className="hidden absolute inset-0 flex items-center justify-center text-xs text-amber-600 bg-amber-50/90">Unavailable</span>
                  </div>
                  <button type="button" onClick={() => { setImageUrl(""); setImagePreview(null); }} className="text-xs text-rose-600 hover:underline">Remove</button>
                </div>
              )}
            </div>
          ) : (
            <input
              name="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => {
                const v = e.target.value
                setImageUrl(v)
                setImagePreview(v ? v : null)
              }}
              placeholder="https://..."
              className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
            />
          )}
          {imagePreview && imageMode === "url" && isSafeImageUrl(imagePreview) && (
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    const fallback = e.currentTarget.nextElementSibling
                    if (fallback) (fallback as HTMLElement).classList.remove("hidden")
                  }}
                />
                <span className="hidden absolute inset-0 flex items-center justify-center text-xs text-amber-600 bg-amber-50/90">Unavailable</span>
              </div>
              <button type="button" onClick={() => { setImageUrl(""); setImagePreview(null); }} className="text-xs text-rose-600 hover:underline">Remove</button>
            </div>
          )}
          {imageMode === "upload" && <input type="hidden" name="imageUrl" value={imageUrl} />}
        </div>
      </div>
      </div>

      {/* 2. Compliance & Sustainability Details - no "optional" in label */}
      <div ref={sustainabilityRef}>
      <details
        className={`rounded-xl border px-4 py-3 transition-colors ${
          completion.sustainability !== "complete" ? "border-amber-200 bg-amber-50/30" : "border-slate-200 bg-slate-50 open:bg-slate-50/80"
        }`}
        open
      >
        <summary className="cursor-pointer text-sm font-semibold text-slate-800 flex items-center gap-2 py-1">
          Compliance & Sustainability Details
        </summary>
        <div className="pt-4 space-y-5">
          {fieldHints.sustainability && (
            <p className="flex items-center gap-2 text-amber-700 text-sm bg-amber-100/80 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {fieldHints.sustainability}
            </p>
          )}
          {/* Required vs optional legend */}
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="text-rose-500">*</span> Required for EU DPP
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              (optional) Nice to have
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Story</label>
            <span className="text-xs text-slate-400 ml-1">(optional)</span>
            <textarea
              name="story"
              rows={3}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Short craftsmanship story"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
            />
          </div>

          {/* 3. Materials with tooltip */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              Materials
              <FieldTooltip
                label="Materials"
                description="Primary materials used in this product."
                whyMatters="EU DPP requires material composition for transparency and recyclability assessment."
              />
            </label>
            <span className="text-xs text-slate-500 block">Select all that apply, or add custom below</span>
            <div className="flex flex-wrap gap-2">
              {COMMON_MATERIALS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMaterial(m)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    selectedMaterials.includes(m)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={materialsOther}
              onChange={(e) => setMaterialsOther(e.target.value)}
              placeholder="Other materials (e.g. brass hardware)"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400 mt-2"
            />
          </div>

          {/* Origin with tooltip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="origin-country" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                Country
                <FieldTooltip
                  label="Country"
                  description="Where the product was made or assembled."
                  whyMatters="Origin disclosure is mandatory under EU DPP for supply chain transparency."
                />
              </label>
              <select
                id="origin-country"
                value={originCountry}
                onChange={(e) => {
                  const nextCountry = e.target.value
                  setOriginCountry(nextCountry)
                  setOriginState("")
                  setOriginCity("")
                  setCitySuggestions([])
                  setShowCitySuggestions(false)
                  if (nextCountry !== "Other") {
                    setOriginOther("")
                  }
                }}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
              >
                <option value="">Select country…</option>
                {countryOptions.map((country) => (
                  <option key={country.isoCode} value={country.name}>{country.name}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              {originCountry === "Other" && (
                <input
                  type="text"
                  value={originOther}
                  onChange={(e) => setOriginOther(e.target.value)}
                  placeholder="Enter country name"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400 mt-2"
                />
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="origin-state" className="text-sm font-medium text-gray-700">State / Region</label>
              <span className="text-xs text-slate-400 ml-1">(optional)</span>
              {originCountry && originCountry !== "Other" && stateOptions.length > 0 ? (
                <select
                  id="origin-state"
                  value={originState}
                  onChange={(e) => {
                    setOriginState(e.target.value)
                    setShowCitySuggestions(false)
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
                >
                  <option value="">Select state/region…</option>
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="origin-state"
                  value={originState}
                  onChange={(e) => {
                    setOriginState(e.target.value)
                    setShowCitySuggestions(false)
                  }}
                  placeholder={originCountry ? "Enter state/region" : "Select country first"}
                  disabled={!originCountry}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
                />
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="origin-city" className="text-sm font-medium text-gray-700">City / Place</label>
              <span className="text-xs text-slate-400 ml-1">(optional)</span>
              <input
                id="origin-city"
                type="text"
                value={originCity}
                onChange={(e) => {
                  setOriginCity(e.target.value)
                  setShowCitySuggestions(true)
                }}
                onFocus={() => setShowCitySuggestions(true)}
                placeholder="e.g. Florence"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
              />
              {loadingCitySuggestions && (
                <p className="text-xs text-slate-500">Loading city suggestions…</p>
              )}
              {cityLookupMessage && (
                <p className="text-xs text-amber-700">{cityLookupMessage}</p>
              )}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white shadow-sm max-h-40 overflow-auto">
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setOriginCity(suggestion)
                        setShowCitySuggestions(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">
                Optional autocomplete. You can always type city/place manually.
              </p>
            </div>
          </div>

          {/* Lifecycle with tooltip - structured inputs */}
          <div
            ref={lifecycleRef}
            className={`space-y-2 p-4 rounded-xl transition-colors ${
              completion.lifecycle !== "complete" ? "bg-amber-50/50 border border-amber-100" : ""
            }`}
          >
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              Lifecycle
              <FieldTooltip
                label="Lifecycle"
                description="Repairability, expected lifespan, and recyclability."
                whyMatters="EU DPP requires circularity information for end-of-life and repair decisions."
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500">Repairable</span>
                <select
                  value={repairable}
                  onChange={(e) => setRepairable(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
                >
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500">Expected lifespan</span>
                <select
                  value={lifespan}
                  onChange={(e) => setLifespan(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
                >
                  {LIFESPAN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500">Recyclable</span>
                <select
                  value={recyclable}
                  onChange={(e) => setRecyclable(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 outline-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
                >
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
          {fieldHints.lifecycle && (
            <p className="flex items-center gap-2 text-amber-700 text-sm bg-amber-100/80 px-3 py-2 rounded-lg mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {fieldHints.lifecycle}
            </p>
          )}
          </div>
        </div>
      </details>
      </div>

      {/* CTA area: Save Draft + Create & Continue */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={loading || uploadingImage}
          className="flex-1 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading || uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Draft
        </button>
        <button
          type="submit"
          data-continue="true"
          disabled={loading}
          className="flex-1 px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Create & Continue
        </button>
      </div>

      {/* Preview Passport - disabled until saved */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={!lastCreatedProduct}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Eye className="w-4 h-4" />
          Preview Passport
        </button>
        {!lastCreatedProduct && (
          <span className="text-xs text-slate-400">Save your product to preview its Digital Passport</span>
        )}
      </div>

      {message && (
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          {message}
        </div>
      )}

      {/* Preview Passport modal */}
      {showPreview && lastCreatedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Passport Preview</h3>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <PassportPagePreviewCard
                productName={lastCreatedProduct.name}
                subtitle={lastCreatedProduct.origin || undefined}
                productStory={lastCreatedProduct.story || undefined}
                materials={lastCreatedProduct.materials || undefined}
                showEmptyState
                scanHint="Customers verify in the browser — no app install. Create a batch to generate QR codes and live passports for this product."
                className="max-w-full shadow-sm"
              />
              {lastCreatedProduct.lifecycle ? (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Lifecycle
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{lastCreatedProduct.lifecycle}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
