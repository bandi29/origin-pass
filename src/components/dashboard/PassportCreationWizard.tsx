"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { Link } from "@/i18n/navigation"
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Link as LinkIcon,
  Loader2,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"
import clsx from "clsx"
import { getCountryOptions, getStateOptionsByCountryName } from "@/lib/location-options"
import type { MaterialRow, TimelineRow, GpsrData } from "@/lib/passport-wizard-schemas"
import { EMPTY_GPSR } from "@/lib/passport-wizard-schemas"
import {
  emptyCustomFieldsFromTemplate,
  getIndustryTemplate,
  type IndustryTemplateId,
} from "@/lib/templates"
import { IndustryTemplatePicker } from "@/components/passports/IndustryTemplatePicker"
import { GpsrComplianceSection } from "@/components/passports/GpsrComplianceSection"
import type { CategoryKey, SchemaField } from "@/lib/compliance/category-schemas"
import { categorySchemas } from "@/lib/compliance/category-schemas"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"
import { getCategoryComplianceStrategy } from "@/lib/compliance/category-compliance-strategy"
import {
  computeDppReadinessScore,
  getComplianceFieldErrors,
  getFirstMissingRequiredFieldKeyForHighlight,
} from "@/lib/compliance/validate-category-product"
import {
  ComplianceStrategyFields,
  wizardComplianceFieldDomId,
} from "@/components/compliance/dynamic-field-renderer"
import { StudioNativeSelect } from "@/components/ui/StudioNativeSelect"
import { createClient } from "@/lib/supabase/client"
import { uploadProductImageClient, validateFile } from "@/lib/upload-product-image-client"
import {
  certificationWizardHrefFromHints,
  resolveCertificationProductIdFromHints,
} from "@/lib/dashboard-notification-routing"
import { productNameToQuerySlug } from "@/lib/passport-registry-map"

const CATEGORIES = ["Fashion", "Food", "Electronics", "Home", "Crafts", "Other"] as const

const COMPLIANCE_CATEGORY_OPTIONS: { value: CategoryKey; label: string }[] = [
  { value: "leather", label: "Leather (EUDR, ESPR)" },
  { value: "textile", label: "Textile (ESPR)" },
  { value: "wood", label: "Wood / furniture (EUDR)" },
  { value: "jewelry", label: "Jewelry (due diligence)" },
]

const STEPS = [
  { n: 1, label: "Product Info" },
  { n: 2, label: "Passport Details" },
  { n: 3, label: "QR Generate" },
  { n: 4, label: "Review & Submit" },
] as const

function focusComplianceFieldRoot(fieldKey: string): boolean {
  const el = document.getElementById(wizardComplianceFieldDomId(fieldKey))
  if (!el) return false
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  requestAnimationFrame(() => {
    const focusable = el.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
    )
    focusable?.focus()
  })
  return true
}

function useDebouncedCallback<T extends unknown[]>(
  fn: (...args: T) => unknown,
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

export function PassportCreationWizard({ editProductId }: { editProductId?: string } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const stepQueryRaw = searchParams.get("step") ?? ""
  const isComplianceStepDeepLink = stepQueryRaw === "compliance"
  const highlightParam = searchParams.get("highlight") ?? ""
  const highlightTargetsCompliance =
    highlightParam.trim().toLowerCase() === "authenticity" ||
    highlightParam.trim().toLowerCase() === "compliance"

  const isComplianceFlow =
    searchParams.get("flow") === "compliance" || isComplianceStepDeepLink || Boolean(editProductId)
  const productIdParam = (editProductId ?? searchParams.get("productId")) || ""
  const certSkuParam = searchParams.get("certSku")?.trim() ?? ""
  const certNameParam = searchParams.get("certName")?.trim() ?? ""
  const hasProductContext = Boolean(productIdParam || editProductId)
  const hasCertHintsNav =
    Boolean(certSkuParam || certNameParam) && !editProductId && !productIdParam

  const stepNumOrDefault = Math.min(4, Math.max(1, Number(stepQueryRaw) || 1))
  /** Notification URLs: flow + highlight + productId but step missing or still 1 → open compliance (step 2). */
  const recoverComplianceDeepStep =
    isComplianceFlow &&
    highlightTargetsCompliance &&
    hasProductContext &&
    !isComplianceStepDeepLink &&
    (stepQueryRaw === "" || stepNumOrDefault === 1)

  const step = isComplianceStepDeepLink ? 2 : recoverComplianceDeepStep ? 2 : stepNumOrDefault

  const passportIdParam = searchParams.get("passportId") || ""

  const [productId, setProductId] = useState(productIdParam)
  const [passportId, setPassportId] = useState(passportIdParam)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [sku, setSku] = useState("")
  const [complianceCategoryKey, setComplianceCategoryKey] = useState<CategoryKey | "">("")
  const [complianceData, setComplianceData] = useState<ComplianceData>({})
  const [heroUploading, setHeroUploading] = useState(false)
  const [heroFileLabel, setHeroFileLabel] = useState<string | null>(null)
  const [draftSavedFlash, setDraftSavedFlash] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const draftFlashTimerRef = useRef<number | null>(null)
  const heroFileInputRef = useRef<HTMLInputElement>(null)
  const [aiFilledKeys] = useState<Set<string>>(() => new Set())
  const [originCountry, setOriginCountry] = useState("")
  const [originRegion, setOriginRegion] = useState("")

  const [story, setStory] = useState("")
  const [materials, setMaterials] = useState<MaterialRow[]>([{ name: "", source: "", sustainabilityTag: "" }])
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [industryTemplateId, setIndustryTemplateId] = useState<IndustryTemplateId | "">("")
  const [customFields, setCustomFields] = useState<Record<string, string>>({})
  const [gpsr, setGpsr] = useState<GpsrData>(EMPTY_GPSR)
  const [gpsrOpen, setGpsrOpen] = useState(false)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [publicLinkCopied, setPublicLinkCopied] = useState(false)
  const publicLinkCopiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)
  const [mintQuantity, setMintQuantity] = useState(1)
  const [mintedCount, setMintedCount] = useState<number | null>(null)
  /** Step 4 shows “completed” (green) only after QR/public URL is persisted via `/api/qrcode` (or restored from session). */
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [aiGenLoading, setAiGenLoading] = useState(false)
  const [draftHydrated, setDraftHydrated] = useState(() => !productIdParam && !editProductId)
  /** One-shot guard: same step/highlight/product/category URL intent should not re-steal focus on every keystroke. */
  const deepLinkFocusHandledRef = useRef<string | null>(null)

  const [certHintOutcome, setCertHintOutcome] = useState<"failed" | null>(null)
  const resolvingCertHints = hasCertHintsNav && !productIdParam && certHintOutcome === null

  useEffect(() => {
    if (!certSkuParam && !certNameParam) setCertHintOutcome(null)
  }, [certSkuParam, certNameParam])

  useEffect(() => {
    if (editProductId || productIdParam) return
    if (!certSkuParam && !certNameParam) return
    setCertHintOutcome(null)
    let cancelled = false
    ;(async () => {
      const id = await resolveCertificationProductIdFromHints({
        sku: certSkuParam || undefined,
        productName: certNameParam || undefined,
      })
      if (cancelled) return
      if (id) {
        router.replace(certificationWizardHrefFromHints({ productId: id }))
        return
      }
      setCertHintOutcome("failed")
    })()
    return () => {
      cancelled = true
    }
  }, [editProductId, productIdParam, certSkuParam, certNameParam, router])

  useEffect(() => {
    return () => {
      if (draftFlashTimerRef.current) clearTimeout(draftFlashTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!draftSavedFlash || typeof document === "undefined") return
    document.getElementById("wizard-draft-saved-banner")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [draftSavedFlash])

  function triggerDraftSavedFlash() {
    setDraftSavedFlash(true)
    if (draftFlashTimerRef.current) clearTimeout(draftFlashTimerRef.current)
    draftFlashTimerRef.current = window.setTimeout(() => {
      setDraftSavedFlash(false)
      draftFlashTimerRef.current = null
    }, 4500)
  }

  const countryOptions = useMemo(() => getCountryOptions(), [])
  const regionOptions = useMemo(
    () => getStateOptionsByCountryName(originCountry),
    [originCountry]
  )

  const complianceStrategy = useMemo(
    () => (complianceCategoryKey ? getCategoryComplianceStrategy(complianceCategoryKey) : null),
    [complianceCategoryKey],
  )
  const complianceSchema = useMemo(
    () => (complianceCategoryKey ? categorySchemas[complianceCategoryKey] : null),
    [complianceCategoryKey],
  )

  /** DPP score: compliance registry when in compliance wizard; otherwise heuristic from catalog fields. */
  const dppReadinessScore = useMemo(() => {
    if (isComplianceFlow && complianceCategoryKey) {
      return computeDppReadinessScore(complianceCategoryKey, complianceData)
    }
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
  }, [
    isComplianceFlow,
    complianceCategoryKey,
    complianceData,
    name,
    description,
    category,
    originCountry,
    originRegion,
    story,
    materials,
    timeline,
  ])

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
      const p = data.product as {
        name?: string
        description?: string | null
        category?: string | null
        originCountry?: string
        originRegion?: string
        sku?: string | null
        complianceCategoryKey?: CategoryKey | null
        complianceData?: ComplianceData | null
      }
      if (p) {
        setName(p.name ?? "")
        setDescription(p.description ?? "")
        setCategory(p.category ?? "")
        setOriginCountry(p.originCountry ?? "")
        setOriginRegion(p.originRegion ?? "")
        setSku(typeof p.sku === "string" ? p.sku : "")
        if (p.complianceCategoryKey) {
          setComplianceCategoryKey(p.complianceCategoryKey)
        }
        if (p.complianceData && typeof p.complianceData === "object") {
          setComplianceData(p.complianceData as ComplianceData)
        }
      }
      const pass = data.passport as {
        id?: string
        story?: string | null
        materials?: MaterialRow[]
        timeline?: TimelineRow[]
        industryTemplateId?: IndustryTemplateId | null
        customFields?: Record<string, string>
        gpsr?: GpsrData | null
      } | null
      if (pass) {
        setPassportId(pass.id ?? "")
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
        if (pass.industryTemplateId) {
          setIndustryTemplateId(pass.industryTemplateId)
        }
        if (pass.customFields && typeof pass.customFields === "object") {
          setCustomFields(pass.customFields)
        }
        if (pass.gpsr && typeof pass.gpsr === "object") {
          setGpsr({
            euResponsiblePerson: {
              ...EMPTY_GPSR.euResponsiblePerson,
              ...pass.gpsr.euResponsiblePerson,
            },
            safetyInformation: Array.isArray(pass.gpsr.safetyInformation)
              ? pass.gpsr.safetyInformation
              : [],
            productIdentifiers: {
              ...EMPTY_GPSR.productIdentifiers,
              ...pass.gpsr.productIdentifiers,
            },
          })
          const hasGpsr =
            Boolean(pass.gpsr.euResponsiblePerson?.name) ||
            Boolean(pass.gpsr.euResponsiblePerson?.company) ||
            Boolean(pass.gpsr.euResponsiblePerson?.email) ||
            (pass.gpsr.safetyInformation?.length ?? 0) > 0 ||
            Boolean(pass.gpsr.productIdentifiers?.gtin)
          if (hasGpsr) setGpsrOpen(true)
        }
      }
      if (!cancelled) setDraftHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [productIdParam])

  useEffect(() => {
    if (step !== 2 || !draftHydrated || !isComplianceFlow) return
    const hl = highlightParam.trim().toLowerCase()
    if (hl !== "authenticity" && hl !== "compliance") return
    if (!complianceCategoryKey || !complianceSchema) return

    const sig = `${stepQueryRaw}|${highlightParam}|${productIdParam}|${editProductId ?? ""}|${complianceCategoryKey}`
    if (deepLinkFocusHandledRef.current === sig) return

    const missingKey = getFirstMissingRequiredFieldKeyForHighlight(
      complianceCategoryKey,
      complianceData,
      highlightParam,
    )
    const sectionId =
      hl === "authenticity" ? "wizard-highlight-authenticity" : "wizard-highlight-compliance"

    let cancelled = false
    const attempt = (attemptIndex: number) => {
      if (cancelled) return
      let focused = false
      if (missingKey) focused = focusComplianceFieldRoot(missingKey)
      if (!focused && missingKey && attemptIndex < 1) {
        window.setTimeout(() => attempt(attemptIndex + 1), 220)
        return
      }
      if (!focused) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      deepLinkFocusHandledRef.current = sig
    }

    const t = window.setTimeout(() => attempt(0), 150)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [
    step,
    highlightParam,
    stepQueryRaw,
    draftHydrated,
    isComplianceFlow,
    complianceCategoryKey,
    complianceSchema,
    complianceData,
    productIdParam,
    editProductId,
  ])

  const setQuery = useCallback(
    (next: { step: number; productId?: string; passportId?: string }) => {
      const q = new URLSearchParams()
      q.set("step", String(next.step))
      if (isComplianceFlow) q.set("flow", "compliance")
      if (next.step !== 1) {
        const hl = searchParams.get("highlight")
        if (hl) q.set("highlight", hl)
      }
      if (next.passportId) q.set("passportId", next.passportId)
      if (editProductId) {
        router.push(`/dashboard/products/edit/${editProductId}?${q.toString()}`)
        return
      }
      const pid = next.productId ?? productId
      if (pid) q.set("productId", pid)
      router.push(`/dashboard/products/passport-wizard?${q.toString()}`)
    },
    [router, isComplianceFlow, editProductId, productId, searchParams],
  )

  useEffect(() => {
    if (!recoverComplianceDeepStep) return
    const q = new URLSearchParams(searchParams.toString())
    q.set("step", "compliance")
    if (isComplianceFlow) q.set("flow", "compliance")
    const path = editProductId
      ? `/dashboard/products/edit/${editProductId}?${q.toString()}`
      : `/dashboard/products/passport-wizard?${q.toString()}`
    router.replace(path)
  }, [recoverComplianceDeepStep, editProductId, isComplianceFlow, router, searchParams])

  const saveProductPatch = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!productId) return { ok: false, error: "No product to save yet." }
    if (name.trim().length < 3) {
      return { ok: false, error: "Product name must be at least 3 characters." }
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description || null,
      category: category || null,
      originCountry: originCountry || null,
      originRegion: originRegion || null,
    }
    if (isComplianceFlow) {
      body.sku = sku.trim() || null
    }
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Could not save product." }
    }
    return { ok: true }
  }, [productId, name, description, category, originCountry, originRegion, isComplianceFlow, sku])

  const saveCompliancePatch = useCallback(
    async (complianceDataOverride?: ComplianceData): Promise<{ ok: boolean; error?: string }> => {
      if (!productId || !isComplianceFlow) return { ok: false, error: "Nothing to save." }
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim() || null,
          description: description || null,
          complianceData: complianceDataOverride ?? complianceData,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        return { ok: false, error: data.error ?? "Could not save draft." }
      }
      return { ok: true }
    },
    [productId, isComplianceFlow, name, sku, description, complianceData],
  )

  const debouncedSaveCompliance = useDebouncedCallback(saveCompliancePatch, 800)

  const debouncedSaveProduct = useDebouncedCallback(saveProductPatch, 800)

  useEffect(() => {
    if (step === 1 && productId && draftHydrated && !isComplianceFlow) {
      debouncedSaveProduct()
    }
  }, [
    step,
    productId,
    draftHydrated,
    isComplianceFlow,
    name,
    description,
    category,
    originCountry,
    originRegion,
    debouncedSaveProduct,
  ])

  const savePassportPost = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!productId) return { ok: false, error: "No product." }
    const res = await fetch("/api/passport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        story: story || null,
        materials: materials.filter((m) => m.name || m.source || m.sustainabilityTag),
        timeline: timeline.filter((t) => t.stepName || t.location || t.date),
        industryTemplateId: industryTemplateId || null,
        customFields,
        gpsr,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as { passportId?: string; error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? "Could not save passport draft." }
    }
    if (data.passportId) setPassportId(data.passportId)
    return { ok: true }
  }, [productId, story, materials, timeline, industryTemplateId, customFields, gpsr])

  const debouncedSavePassport = useDebouncedCallback(savePassportPost, 800)

  useEffect(() => {
    if (step === 2 && productId && draftHydrated && !isComplianceFlow) {
      debouncedSavePassport()
    }
  }, [
    step,
    productId,
    draftHydrated,
    isComplianceFlow,
    story,
    materials,
    timeline,
    industryTemplateId,
    customFields,
    gpsr,
    debouncedSavePassport,
  ])

  function applyIndustryTemplate(id: IndustryTemplateId) {
    const tpl = getIndustryTemplate(id)
    if (!tpl) return
    setIndustryTemplateId(id)
    setStory(tpl.story)
    setMaterials(tpl.materials.map((m) => ({ ...m })))
    setTimeline(tpl.timeline.map((t) => ({ ...t })))
    setCustomFields(emptyCustomFieldsFromTemplate(tpl))
    if (!category.trim()) setCategory(tpl.categoryHint)
  }
  useEffect(() => {
    if (!productId || !draftHydrated || !isComplianceFlow) return
    if (step === 1 || step === 2) {
      debouncedSaveCompliance()
    }
  }, [step, productId, draftHydrated, isComplianceFlow, name, sku, description, complianceData, debouncedSaveCompliance])

  function setComplianceField(f: SchemaField, value: unknown) {
    if (!complianceStrategy) return
    setComplianceData((d) => complianceStrategy.setFieldValue(d, f, value))
  }

  function readComplianceField(f: SchemaField): unknown {
    if (!complianceStrategy) return undefined
    return complianceStrategy.getFieldValue(complianceData, f)
  }

  async function flushSaveDraft() {
    setActionError(null)
    if (!productId) {
      setActionError("Continue once to create your product, then you can save drafts from here.")
      return
    }
    setSavingDraft(true)
    try {
      if (isComplianceFlow) {
        if (name.trim().length < 3) {
          setActionError("Product name must be at least 3 characters to save.")
          return
        }
        const cr = await saveCompliancePatch()
        if (!cr.ok) {
          setActionError(cr.error ?? "Could not save draft.")
          return
        }
        triggerDraftSavedFlash()
        return
      }
      const pr = await saveProductPatch()
      if (!pr.ok) {
        setActionError(pr.error ?? "Could not save draft.")
        return
      }
      if (step === 2) {
        const passportResult = await savePassportPost()
        if (!passportResult.ok) {
          setActionError(passportResult.error ?? "Product saved, but passport draft failed.")
          return
        }
      }
      triggerDraftSavedFlash()
    } catch {
      setActionError("Could not save draft.")
    } finally {
      setSavingDraft(false)
    }
  }

  async function onHeroImage(file: File) {
    const supabase = createClient()
    setHeroUploading(true)
    try {
      const err = validateFile(file)
      if (err) {
        setActionError(err)
        return
      }
      const r = await uploadProductImageClient(file, supabase)
      if (!r.success || !r.url) {
        setActionError(r.error ?? "Upload failed")
        return
      }
      const nextComplianceData: ComplianceData = { ...complianceData, hero_image_url: r.url }
      setComplianceData(nextComplianceData)
      setActionError(null)
      if (productId && isComplianceFlow) {
        const saved = await saveCompliancePatch(nextComplianceData)
        if (!saved.ok) {
          setActionError(saved.error ?? "Image uploaded but could not save to product.")
        }
      }
    } finally {
      setHeroUploading(false)
    }
  }

  const heroImageUrl =
    typeof complianceData.hero_image_url === "string" ? complianceData.hero_image_url.trim() : ""

  async function handleContinueStep1(e: React.FormEvent) {
    e.preventDefault()
    setActionError(null)
    if (name.trim().length < 3) {
      setActionError("Product name must be at least 3 characters.")
      return
    }
    setLoading(true)
    try {
      if (isComplianceFlow) {
        if (!complianceCategoryKey) {
          setActionError("Select a compliance category first.")
          return
        }
        if (productId) {
          await saveCompliancePatch()
          setQuery({ step: 2, productId, passportId: passportId || undefined })
        } else {
          const res = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wizardStep1: true as const,
              complianceCategoryKey,
              name: name.trim(),
              sku: sku.trim() || null,
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
        return
      }

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
      if (isComplianceFlow) {
        if (!complianceCategoryKey) {
          setActionError("Missing compliance category.")
          return
        }
        const errs = getComplianceFieldErrors(complianceCategoryKey, complianceData)
        if (errs.length) {
          setActionError(errs.join(" "))
          return
        }
        await saveCompliancePatch()
        const passStory = String(complianceData.product_story ?? "").trim() || story.trim() || null
        const res = await fetch("/api/passport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            story: passStory,
            materials: [],
            timeline: [],
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          setActionError(data.error || "Could not save passport.")
          return
        }
        setPassportId(data.passportId)
        setQuery({ step: 3, productId, passportId: data.passportId })
        return
      }

      const res = await fetch("/api/passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          story: story || null,
          materials: materials.filter((m) => m.name || m.source || m.sustainabilityTag),
          timeline: timeline.filter((t) => t.stepName || t.location || t.date),
          industryTemplateId: industryTemplateId || null,
          customFields,
          gpsr,
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
      if (typeof data.story === "string") {
        setStory(data.story)
        if (isComplianceFlow) {
          setComplianceData((d) => ({ ...d, product_story: data.story as string }))
        }
      }
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
    const quantity = Math.max(1, Math.min(1000, Math.floor(mintQuantity) || 1))
    setGeneratingQr(true)
    try {
      const res = await fetch("/api/qrcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportId, quantity }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || "QR generation failed.")
        return
      }
      setQrPreview(data.imageDataUrl)
      setPublicUrl(data.publicPageUrl)
      setMintedCount(typeof data.mintedCount === "number" ? data.mintedCount : quantity)
      setIsSubmitted(true)
      try {
        sessionStorage.setItem(
          `passportQr:${passportId}`,
          JSON.stringify({
            imageDataUrl: data.imageDataUrl,
            publicPageUrl: data.publicPageUrl,
            mintedCount: typeof data.mintedCount === "number" ? data.mintedCount : quantity,
          })
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

  function copyPublicLinkWithFeedback() {
    if (!publicUrl) return
    void navigator.clipboard.writeText(publicUrl)
    setPublicLinkCopied(true)
    if (publicLinkCopiedTimer.current) clearTimeout(publicLinkCopiedTimer.current)
    publicLinkCopiedTimer.current = setTimeout(() => {
      setPublicLinkCopied(false)
      publicLinkCopiedTimer.current = null
    }, 2200)
  }

  useEffect(() => {
    return () => {
      if (publicLinkCopiedTimer.current) clearTimeout(publicLinkCopiedTimer.current)
    }
  }, [])

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
      const { imageDataUrl, publicPageUrl: u, mintedCount: storedMintedCount } = JSON.parse(raw) as {
        imageDataUrl?: string
        publicPageUrl?: string
        mintedCount?: number
      }
      if (imageDataUrl) setQrPreview(imageDataUrl)
      if (u) setPublicUrl(u)
      if (typeof storedMintedCount === "number") setMintedCount(storedMintedCount)
      if (imageDataUrl) setIsSubmitted(true)
    } catch {
      /* ignore */
    }
  }, [step, passportId])

  /** Refresh / return visit: restore QR preview state from session when revisiting step 4. */
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!passportId) {
      setIsSubmitted(false)
      return
    }
    const raw = sessionStorage.getItem(`passportQr:${passportId}`)
    if (!raw) {
      setIsSubmitted(false)
      return
    }
    try {
      const { imageDataUrl, mintedCount: storedMintedCount } = JSON.parse(raw) as {
        imageDataUrl?: string
        mintedCount?: number
      }
      if (imageDataUrl) setIsSubmitted(true)
      if (typeof storedMintedCount === "number") setMintedCount(storedMintedCount)
    } catch {
      setIsSubmitted(false)
    }
  }, [passportId])

  function downloadQr() {
    if (!qrPreview) return
    const a = document.createElement("a")
    a.href = qrPreview
    a.download = `passport-qr-${passportId || "qr"}.png`
    a.click()
  }

  function finishAndGoToPassports() {
    const params = new URLSearchParams({ success: "true" })
    const productSlug = productNameToQuerySlug(name)
    if (productSlug) params.set("product", productSlug)
    router.push(`/dashboard/product-passports?${params.toString()}`)
  }

  /** Clears wizard session state before starting a fresh product flow at step 1. */
  function resetWizardForNewProduct() {
    const previousPassportId = passportId
    if (draftFlashTimerRef.current) {
      clearTimeout(draftFlashTimerRef.current)
      draftFlashTimerRef.current = null
    }
    if (publicLinkCopiedTimer.current) {
      clearTimeout(publicLinkCopiedTimer.current)
      publicLinkCopiedTimer.current = null
    }
    setProductId("")
    setPassportId("")
    setName("")
    setDescription("")
    setCategory("")
    setSku("")
    setComplianceCategoryKey("")
    setComplianceData({})
    setHeroFileLabel(null)
    setOriginCountry("")
    setOriginRegion("")
    setStory("")
    setMaterials([{ name: "", source: "", sustainabilityTag: "" }])
    setTimeline([])
    setIndustryTemplateId("")
    setCustomFields({})
    setGpsr(EMPTY_GPSR)
    setGpsrOpen(false)
    setQrPreview(null)
    setPublicUrl(null)
    setMintQuantity(1)
    setMintedCount(null)
    setPublicLinkCopied(false)
    setIsSubmitted(false)
    setGeneratingQr(false)
    setActionError(null)
    setLoadError(null)
    setDraftSavedFlash(false)
    setDraftHydrated(true)
    deepLinkFocusHandledRef.current = null
    try {
      if (previousPassportId) sessionStorage.removeItem(`passportQr:${previousPassportId}`)
    } catch {
      /* ignore */
    }
    router.push(
      isComplianceFlow
        ? "/dashboard/products/passport-wizard?step=1&flow=compliance"
        : "/dashboard/products/passport-wizard?step=1",
    )
  }

  const inputClass =
    "mt-1.5 box-border min-h-10 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm leading-normal outline-none ring-slate-300 transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
  const cardClass = "rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"

  const isWizardComplete = step === 4 && isSubmitted
  const isStepCompleted = (stepNumber: number) =>
    stepNumber < step || (stepNumber === 4 && isWizardComplete)
  const isStepCurrent = (stepNumber: number) => stepNumber === step && !isWizardComplete

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
                        isStepCompleted(s.n) || isStepCurrent(s.n) ? "text-slate-900" : "text-slate-400",
                      )}
                    >
                      <span
                        className={clsx(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                          isStepCompleted(s.n)
                            ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/25"
                            : isStepCurrent(s.n)
                              ? "bg-slate-900 text-white shadow-md"
                              : "border border-slate-200 bg-white text-slate-400",
                        )}
                        aria-label={
                          isStepCompleted(s.n)
                            ? `${s.label} completed`
                            : isStepCurrent(s.n)
                              ? `${s.label} current step`
                              : `${s.label} upcoming`
                        }
                      >
                        {isStepCompleted(s.n) ? (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                          s.n
                        )}
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
                    style={{
                      width: `${isWizardComplete ? 100 : Math.min(100, (step / 4) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {loadError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {loadError}
              </div>
            )}

            {resolvingCertHints ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
              >
                <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" aria-hidden />
                <div>
                  <p className="font-semibold text-sky-900">Matching alert to your catalog</p>
                  <p className="mt-1 text-sky-900/90">
                    Resolving{" "}
                    {certSkuParam ? (
                      <>
                        SKU <span className="font-mono text-xs">{certSkuParam}</span>
                      </>
                    ) : null}
                    {certSkuParam && certNameParam ? " · " : null}
                    {certNameParam ? <>“{certNameParam}”</> : null} to a product record…
                  </p>
                </div>
              </div>
            ) : null}

            {actionError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {actionError}
              </div>
            )}

            {draftSavedFlash ? (
              <div
                id="wizard-draft-saved-banner"
                role="status"
                aria-live="polite"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  <div>
                    <p className="font-semibold text-emerald-900">Draft saved</p>
                    <p className="mt-1 text-emerald-800/95">
                      Your latest changes are stored on this product. You can leave and come back anytime.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!productIdParam &&
            !editProductId &&
            isComplianceFlow &&
            step === 2 &&
            draftHydrated &&
            !resolvingCertHints &&
            (!hasCertHintsNav || certHintOutcome === "failed") ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">No product is linked to this page</p>
                <p className="mt-1 text-amber-900/95">
                  Your catalog record was not loaded — the URL is missing a{" "}
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-xs">productId</code>, or we could not match
                  the alert to a row in your catalog
                  {certSkuParam || certNameParam ? (
                    <>
                      {" "}
                      (tried
                      {certSkuParam ? (
                        <>
                          {" "}
                          SKU <code className="rounded bg-amber-100/90 px-1 font-mono text-xs">{certSkuParam}</code>
                        </>
                      ) : null}
                      {certNameParam ? <> · “{certNameParam}”</> : null}).
                    </>
                  ) : null}
                  . Open the correct item from{" "}
                  <Link
                    href="/dashboard/products"
                    className="font-semibold text-amber-950 underline decoration-amber-700/60 underline-offset-2"
                  >
                    Products
                  </Link>{" "}
                  and edit compliance from there. For local testing, set{" "}
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-xs">NEXT_PUBLIC_NOTIFICATION_DEMO_PRODUCT_ID</code>{" "}
                  in <code className="rounded bg-amber-100/90 px-1 font-mono text-xs">.env.local</code>.
                </p>
              </div>
            ) : null}

            {step === 1 && (
              <form onSubmit={handleContinueStep1} className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">Create product</h2>
                  <p className="text-base text-slate-600">
                    {isComplianceFlow
                      ? "Select your compliance category first, then add catalog basics."
                      : "Basic catalog information for this item."}
                  </p>
                </div>

                {isComplianceFlow ? (
                  <>
                    <div className={cardClass}>
                      <h3 className="text-sm font-semibold text-slate-900">Compliance category *</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Required — unlocks category-specific materials, lifecycle, and traceability fields in step 2.
                      </p>
                      <div className="mt-4">
                        <label htmlFor="wizard-compliance-cat" className="sr-only">
                          Compliance category
                        </label>
                        <StudioNativeSelect
                          id="wizard-compliance-cat"
                          value={complianceCategoryKey}
                          onChange={(e) => setComplianceCategoryKey((e.target.value || "") as CategoryKey | "")}
                          required
                        >
                          <option value="">Select category…</option>
                          {COMPLIANCE_CATEGORY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </StudioNativeSelect>
                      </div>
                    </div>

                    <div className={cardClass}>
                      <h3 className="text-sm font-semibold text-slate-900">Product info</h3>
                      <p className="mt-1 text-xs text-slate-500">Name and SKU stored on the product record.</p>
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
                          <label className="block text-sm font-medium text-slate-700">SKU (optional)</label>
                          <input
                            className={inputClass}
                            value={sku}
                            onChange={(e) => setSku(e.target.value)}
                            placeholder="Internal reference"
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
                        {heroImageUrl ? (
                          <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={heroImageUrl}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-lg border border-white object-cover shadow-sm"
                            />
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-medium text-emerald-900">Hero image saved</p>
                              <p className="mt-0.5 text-xs text-emerald-800/85">
                                Replace it in Compliance details (step 2).
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                      <div className="mt-4">
                        <StudioNativeSelect
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          aria-label="Product category"
                        >
                          <option value="">Select category</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </StudioNativeSelect>
                      </div>
                    </div>

                    <div className={cardClass}>
                      <h3 className="text-sm font-semibold text-slate-900">Origin</h3>
                      <p className="mt-1 text-xs text-slate-500">Where this product is made or sourced.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Origin country</label>
                          <StudioNativeSelect
                            wrapClassName="mt-1.5"
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
                          </StudioNativeSelect>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700">Region</label>
                          {regionOptions.length > 0 ? (
                            <StudioNativeSelect
                              wrapClassName="mt-1.5"
                              value={originRegion}
                              onChange={(e) => setOriginRegion(e.target.value)}
                            >
                              <option value="">Select region</option>
                              {regionOptions.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </StudioNativeSelect>
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
                  </>
                )}

                <div className="flex w-full flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={savingDraft}
                      onClick={() => void flushSaveDraft()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      Save draft
                    </button>
                    {draftSavedFlash ? (
                      <span className="text-xs font-medium text-emerald-700">Saved</span>
                    ) : null}
                  </div>
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
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                {isComplianceFlow ? "Compliance details" : "Passport details"}
              </h2>
              <p className="text-base text-slate-600">
                {isComplianceFlow
                  ? "Review and adjust category-specific materials, lifecycle, traceability, and certifications before generating your passport QR."
                  : "Tell the story behind your product."}
              </p>
            </div>

            {!isComplianceFlow ? (
              <>
                <IndustryTemplatePicker
                  value={industryTemplateId}
                  onSelect={applyIndustryTemplate}
                  cardClass={cardClass}
                />

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

            {industryTemplateId
              ? (() => {
                  const tpl = getIndustryTemplate(industryTemplateId)
                  if (!tpl?.customFields.length) return null
                  return (
                    <div className={cardClass}>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {tpl.label} fields
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Industry-specific details seeded by your template
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {tpl.customFields.map((field) => (
                          <div key={field.key} className="sm:col-span-1">
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                              {field.label}
                            </label>
                            <input
                              className={inputClass}
                              value={customFields[field.key] ?? ""}
                              onChange={(e) =>
                                setCustomFields((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              placeholder={field.placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()
              : null}

            <GpsrComplianceSection
              value={gpsr}
              onChange={setGpsr}
              inputClass={inputClass}
              cardClass={cardClass}
              open={gpsrOpen}
              onOpenChange={setGpsrOpen}
            />
              </>
            ) : complianceCategoryKey && complianceSchema ? (
              <>
                <div className={cardClass}>
                  <h3 className="text-sm font-semibold text-slate-900">Hero image</h3>
                  <p className="mt-1 text-xs text-slate-500">Shown on the passport and catalog.</p>
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    tabIndex={-1}
                    disabled={heroUploading}
                    aria-label="Choose hero image"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) {
                        setHeroFileLabel(f.name)
                        void onHeroImage(f)
                      }
                      e.target.value = ""
                    }}
                  />
                  <div className="mt-4 flex min-h-[2.75rem] flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={heroUploading}
                      onClick={() => heroFileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Upload className="h-4 w-4 text-slate-600" aria-hidden />
                      {typeof complianceData.hero_image_url === "string" && complianceData.hero_image_url
                        ? "Replace image"
                        : "Upload image"}
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600" title={heroFileLabel ?? undefined}>
                      {heroUploading ? "Uploading…" : heroFileLabel ?? (heroImageUrl ? "Image linked" : "No file selected")}
                    </span>
                    {heroUploading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" aria-hidden /> : null}
                  </div>
                  {heroImageUrl ? (
                    <div className="mt-4 space-y-2 text-left">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={heroImageUrl}
                          alt="Hero image preview"
                          className="mx-auto max-h-40 w-auto max-w-full rounded-lg object-contain"
                        />
                      </div>
                      <p className="text-xs font-medium text-emerald-700">Uploaded and saved to this product.</p>
                    </div>
                  ) : null}
                </div>

                <div className={cardClass}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">AI story</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Drafts product story into compliance fields when available</p>
                    </div>
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
                      Generate story
                    </button>
                  </div>
                </div>

                <ComplianceStrategyFields
                  categoryKey={complianceCategoryKey}
                  schema={complianceSchema}
                  readField={readComplianceField}
                  setField={setComplianceField}
                  aiFilledKeys={aiFilledKeys}
                />
              </>
            ) : (
              <div className={clsx(cardClass, "border-amber-200/90 bg-amber-50/40")}>
                <h3 className="text-sm font-semibold text-slate-900">Compliance category</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Notifications and deep links can open this step directly. Choose the category for this product to
                  load EUDR / ESPR fields — or go back to step 1 for full product details.
                </p>
                <div className="mt-4 space-y-3">
                  <label htmlFor="wizard-compliance-cat-step2" className="sr-only">
                    Compliance category
                  </label>
                  <StudioNativeSelect
                    id="wizard-compliance-cat-step2"
                    value={complianceCategoryKey}
                    onChange={(e) => {
                      const v = (e.target.value || "") as CategoryKey | ""
                      setComplianceCategoryKey(v)
                      if (productId && v) {
                        void fetch(`/api/products/${productId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ complianceCategoryKey: v }),
                        })
                      }
                    }}
                  >
                    <option value="">Select category…</option>
                    {COMPLIANCE_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </StudioNativeSelect>
                  <button
                    type="button"
                    onClick={() => setQuery({ step: 1, productId })}
                    className="text-xs font-medium text-slate-700 underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
                  >
                    Open step 1 — name, SKU, and category together
                  </button>
                </div>
              </div>
            )}

            <div className="flex w-full flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuery({ step: 1, productId })}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Back
              </button>
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={savingDraft}
                  onClick={() => void flushSaveDraft()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save draft
                </button>
                {draftSavedFlash ? (
                  <span className="text-xs font-medium text-emerald-700">Saved</span>
                ) : null}
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
              <div className="space-y-2 border-b border-slate-100 pb-5">
                <label htmlFor="mint-quantity" className="block text-sm font-medium text-slate-900">
                  Quantity to Mint
                </label>
                <input
                  id="mint-quantity"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={mintQuantity}
                  disabled={generatingQr || Boolean(qrPreview)}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10)
                    setMintQuantity(Number.isFinite(next) && next >= 1 ? Math.min(1000, next) : 1)
                  }}
                  className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
                <p className="max-w-xl text-sm leading-relaxed text-slate-500">
                  Specify how many unique, secure QR tracking labels you need to print for this
                  product&apos;s manufacturing run.
                </p>
              </div>

            {!qrPreview ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12">
                <button
                  type="button"
                  onClick={() => void handleGenerateQr()}
                  disabled={generatingQr || !passportId}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {generatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {mintQuantity > 1 ? `Mint ${mintQuantity} QR labels` : "Generate QR"}
                </button>
                {!passportId && (
                  <p className="mt-3 text-center text-xs text-rose-600">Complete passport details first.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4 pt-5 text-center">
                {mintedCount != null && mintedCount > 1 ? (
                  <p className="text-sm font-medium text-emerald-700">
                    {mintedCount.toLocaleString()} unique QR tracking labels minted for this passport.
                  </p>
                ) : null}
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
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100"
              aria-hidden
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-600" strokeWidth={1.75} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Your Product Passport is Live</h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-600">
              {mintedCount != null && mintedCount > 1
                ? `${mintedCount.toLocaleString()} unique QR tracking labels are ready to print. Customers can scan any label to see verified product information.`
                : "Customers can scan your QR or open the public link to see verified product information."}
            </p>
            {qrPreview && (
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrPreview} alt="" className="h-full w-full object-contain" />
              </div>
            )}
            <div className="flex flex-col items-stretch gap-3 sm:mx-auto sm:max-w-sm">
              {publicUrl && (
                <>
                  <a
                    href={publicUrl}
                    target="originpass_preview"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    View public page
                  </a>
                  <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <button
                        type="button"
                        onClick={() => copyPublicLinkWithFeedback()}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <LinkIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadQr()}
                        disabled={!qrPreview}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Download className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                        Download QR Code
                      </button>
                    </div>
                    {publicLinkCopied ? (
                      <p
                        className="mt-2 text-center text-xs font-medium text-emerald-600 transition-opacity duration-200"
                        role="status"
                        aria-live="polite"
                      >
                        Copied!
                      </p>
                    ) : null}
                  </div>
                </>
              )}
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                disabled
                title="Coming soon"
              >
                Download PDF (soon)
              </button>
              <button
                type="button"
                onClick={finishAndGoToPassports}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Finish & Go to Passports
              </button>
              <button
                type="button"
                onClick={resetWizardForNewProduct}
                className="inline-flex items-center justify-center px-2 py-1.5 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900 hover:decoration-slate-500"
              >
                Create another product
              </button>
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
