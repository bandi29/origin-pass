"use client"

import { useMemo, useRef, useState } from "react"
import { createComplianceProduct } from "@/actions/create-compliance-product"
import {
  type CategoryKey,
  type SchemaField,
  categorySchemas,
} from "@/lib/compliance/category-schemas"
import { getCategoryComplianceStrategy } from "@/lib/compliance/category-compliance-strategy"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"
import { computeDppReadinessScore } from "@/lib/compliance/validate-category-product"
import type { ProductAiMetadata } from "@/lib/compliance/product-ai-metadata"
import type { ComplianceIngestionResult } from "@/lib/ai-photo-passport"
import { filterComplianceDataForCategory } from "@/lib/ingestion/compliance-ingestion-schema"
import { createClient } from "@/lib/supabase/client"
import { uploadProductImageClient, validateFile } from "@/lib/upload-product-image-client"
import { Loader2, Sparkles, ListChecks, Upload } from "lucide-react"
import { motion } from "framer-motion"
import { clsx } from "clsx"
import {
  ComplianceStrategyFields,
  AI_FILLED_OUTLINE,
} from "@/components/compliance/dynamic-field-renderer"

export default function CategoryAwareProductForm() {
  const [categoryKey, setCategoryKey] = useState<CategoryKey | "">("")
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [complianceData, setComplianceData] = useState<ComplianceData>({})
  const [heroUploading, setHeroUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [aiFilledKeys, setAiFilledKeys] = useState<Set<string>>(() => new Set())
  const [entryMode, setEntryMode] = useState<"ai" | "manual">("ai")
  const [productAiMetadata, setProductAiMetadata] = useState<ProductAiMetadata | null>(null)

  const [aiUploadBusy, setAiUploadBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  const strategy = useMemo(() => getCategoryComplianceStrategy(categoryKey), [categoryKey])
  const schema = useMemo(
    () => (categoryKey ? categorySchemas[categoryKey] : null),
    [categoryKey],
  )

  const dppScore = useMemo(() => {
    if (!categoryKey) return 0
    return computeDppReadinessScore(categoryKey, complianceData)
  }, [categoryKey, complianceData])

  /** Category picker + strategy info: manual path, or after AI has set a category */
  const showCategoryStep = entryMode === "manual" || Boolean(categoryKey)
  /** Name, SKU, hero, compliance sections */
  const showDetailFields = Boolean(categoryKey)

  function applyComplianceIngestion(data: {
    extraction: ComplianceIngestionResult
    aiFilledKeys: string[]
    aiMetadata: ProductAiMetadata | null
  }) {
    const { extraction, aiFilledKeys: keys, aiMetadata } = data
    const cat = extraction.complianceCategory
    const filtered = filterComplianceDataForCategory(
      cat,
      extraction.complianceData as Record<string, unknown>,
    )
    // Order matters: set dropdown + swap strategy sections, then merge compliance_data JSONB
    setCategoryKey(cat)
    setComplianceData((prev) => ({ ...prev, ...filtered }))
    const nextFilled = new Set(keys)
    const suggested = extraction.suggestedProductName?.trim()
    if (suggested && !name.trim()) {
      setName(suggested)
      nextFilled.add("product_name")
    }
    setAiFilledKeys(nextFilled)
    setProductAiMetadata(aiMetadata)
    setFieldErrors([])
    setMessage(null)
    setAiError(null)
  }

  async function runComplianceIngestion(files: File[]) {
    if (!files.length) return
    setAiUploadBusy(true)
    setAiError(null)
    setEntryMode("ai")
    try {
      const fd = new FormData()
      for (const f of files) {
        fd.append("file", f)
      }
      const res = await fetch("/api/ai/photo-to-passport", {
        method: "POST",
        body: fd,
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        extraction?: ComplianceIngestionResult
        aiFilledKeys?: string[]
        aiMetadata?: ProductAiMetadata
      }
      if (!res.ok) {
        throw new Error(json.error || "Request failed")
      }
      if (!json.extraction) {
        throw new Error("Invalid response")
      }
      applyComplianceIngestion({
        extraction: json.extraction,
        aiFilledKeys: json.aiFilledKeys ?? [],
        aiMetadata: json.aiMetadata ?? null,
      })
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setAiUploadBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files
    if (list?.length) void runComplianceIngestion(Array.from(list))
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    if (entryMode === "ai") setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragging(false)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setIsDragging(false)
    if (entryMode !== "ai" || aiUploadBusy) return
    const files = Array.from(e.dataTransfer.files).filter(Boolean)
    if (files.length) void runComplianceIngestion(files)
  }

  function setField(f: SchemaField, value: unknown) {
    if (!strategy) return
    setComplianceData((d) => strategy.setFieldValue(d, f, value))
    setAiFilledKeys((prev) => {
      const next = new Set(prev)
      next.delete(f.key)
      return next
    })
  }

  function readField(f: SchemaField): unknown {
    if (!strategy) return undefined
    return strategy.getFieldValue(complianceData, f)
  }

  async function onHeroImage(file: File) {
    const supabase = createClient()
    setHeroUploading(true)
    try {
      const err = validateFile(file)
      if (err) {
        setMessage(err)
        return
      }
      const r = await uploadProductImageClient(file, supabase)
      if (!r.success || !r.url) {
        setMessage(r.error ?? "Upload failed")
        return
      }
      setComplianceData((d) => ({ ...d, hero_image_url: r.url }))
      setMessage(null)
    } finally {
      setHeroUploading(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setFieldErrors([])
    if (!categoryKey) {
      setMessage("Select a product category or upload a document with AI.")
      return
    }
    setLoading(true)
    try {
      const result = await createComplianceProduct({
        complianceCategoryKey: categoryKey,
        name,
        sku: sku.trim() || null,
        complianceData,
        aiMetadata: productAiMetadata ?? undefined,
      })
      if (!result.success) {
        setFieldErrors([result.error ?? "Could not save"])
        setMessage(result.error ?? "Could not save")
        return
      }
      setMessage(
        `Product created. DPP readiness was ${result.dppReadinessScore ?? 0}% (required fields for this category).`,
      )
      setName("")
      setSku("")
      setComplianceData({})
      setAiFilledKeys(new Set())
      setProductAiMetadata(null)
      setCategoryKey("")
    } finally {
      setLoading(false)
    }
  }

  function selectEntryMode(mode: "ai" | "manual") {
    setEntryMode(mode)
    setAiError(null)
    if (mode === "manual") {
      setProductAiMetadata(null)
      setAiFilledKeys(new Set())
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <fieldset className="space-y-4 min-w-0">
        <legend className="text-sm font-medium text-slate-800">How do you want to add product data?</legend>
        <p className="text-xs text-slate-500 -mt-2">
          Pick one method. You can switch anytime — selection uses the same form below.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
          <label
            className={clsx(
              "relative flex cursor-pointer flex-col rounded-2xl border-2 p-4 text-left transition focus-within:ring-2 focus-within:ring-emerald-500/30",
              entryMode === "ai"
                ? "border-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 shadow-md ring-2 ring-emerald-500/15"
                : "border-slate-200 bg-slate-50/70 hover:border-emerald-200 hover:bg-white",
            )}
          >
            <input
              type="radio"
              name="entry-mode"
              value="ai"
              checked={entryMode === "ai"}
              onChange={() => selectEntryMode("ai")}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <span className="text-base font-semibold text-slate-900">Create with AI</span>
                <p className="mt-1 text-sm text-slate-600 leading-snug">
                  Upload a photo or PDF — we detect category and DPP-ready fields.
                </p>
              </div>
            </div>
          </label>

          <label
            className={clsx(
              "relative flex cursor-pointer flex-col rounded-2xl border-2 p-4 text-left transition focus-within:ring-2 focus-within:ring-slate-400/40",
              entryMode === "manual"
                ? "border-slate-800 bg-white shadow-sm ring-1 ring-slate-900/10"
                : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white",
            )}
          >
            <input
              type="radio"
              name="entry-mode"
              value="manual"
              checked={entryMode === "manual"}
              onChange={() => selectEntryMode("manual")}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-800">
                <ListChecks className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <span className="text-base font-semibold text-slate-900">Manual entry</span>
                <p className="mt-1 text-sm text-slate-600 leading-snug">
                  Choose the compliance category yourself and fill in fields without AI.
                </p>
                <span className="mt-3 inline-block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Alternative path
                </span>
              </div>
            </div>
          </label>
        </div>

        {/* Single panel: AI upload OR manual hint (no duplicate “manual” copy) */}
        <div
          className={clsx(
            "relative min-h-[200px] overflow-hidden rounded-2xl border-2 transition",
            entryMode === "ai"
              ? "border-emerald-400/90 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30"
              : "border-slate-200/90 bg-slate-50/40",
          )}
        >
          <input
            ref={fileInputRef}
            data-testid="photo-to-passport-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            multiple
            className="pointer-events-none sr-only"
            tabIndex={-1}
            onChange={onFileInputChange}
          />

          {entryMode === "ai" ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-emerald-100/80 bg-emerald-600/[0.06] px-5 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-emerald-950">
                      Upload for AI extraction
                    </h2>
                    <p className="mt-0.5 text-xs text-emerald-900/75">
                      We map results into compliance_data for your category
                    </p>
                  </div>
                </div>
              </div>

              {aiUploadBusy ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 px-6 py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-600" aria-hidden />
                  <p className="text-center text-sm font-medium text-slate-800">
                    Analyzing document for DPP compliance…
                  </p>
                  <p className="max-w-sm text-center text-xs text-slate-500">
                    Extracting category, product cues, and compliance_data for your review.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  className={`group flex min-h-[180px] w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center transition ${
                    isDragging
                      ? "bg-emerald-100/80"
                      : "bg-transparent hover:bg-emerald-50/50 active:bg-emerald-50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed transition ${
                      isDragging
                        ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                        : "border-emerald-300/80 bg-white text-emerald-600 group-hover:border-emerald-400"
                    }`}
                  >
                    <Upload className="h-7 w-7" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Drop files here or click to upload
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Photo or PDF · images max 4&nbsp;MB · PDF max 8&nbsp;MB · up to 8 files
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm group-hover:bg-emerald-700">
                    Upload photo or PDF
                  </span>
                </button>
              )}
              {aiError ? (
                <p className="border-t border-rose-100 bg-rose-50/80 px-5 py-3 text-sm text-rose-800">
                  {aiError}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-[160px] flex-col justify-center px-6 py-8">
              <p className="text-sm font-semibold text-slate-800">Manual entry selected</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                Use the <strong>compliance category</strong> dropdown below, then complete product and DPP fields.
                To extract data from a file instead, select <strong>Create with AI</strong> above.
              </p>
            </div>
          )}
        </div>
      </fieldset>

      {productAiMetadata?.source_files?.length ? (
        <p className="text-xs text-slate-600 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2">
          <span className="font-medium text-emerald-900">Audit trail:</span> Source files are stored in your
          workspace storage. Saving persists AI confidence and document URLs in{" "}
          <code className="text-[11px]">ai_metadata</code>.
        </p>
      ) : null}

      {showCategoryStep ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Compliance category *
              </label>
              <select
                value={categoryKey}
                onChange={(e) => {
                  const v = e.target.value as CategoryKey | ""
                  setCategoryKey(v)
                  setComplianceData({})
                  setAiFilledKeys(new Set())
                  setProductAiMetadata(null)
                  setFieldErrors([])
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                required={showCategoryStep}
                aria-describedby="compliance-category-hint"
              >
                <option value="">Select…</option>
                <option value="leather">Leather (EUDR, ESPR)</option>
                <option value="textile">Textile (ESPR)</option>
                <option value="wood">Wood / furniture (EUDR)</option>
                <option value="jewelry">Jewelry (due diligence)</option>
              </select>
              <p id="compliance-category-hint" className="mt-2 text-xs leading-relaxed text-slate-500">
                Form fields update automatically based on the selected category to meet EU regulatory standards.
              </p>
            </div>
            {categoryKey ? (
              <div className="flex flex-col justify-end">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">DPP readiness</span>{" "}
                  <span className="font-semibold text-slate-900">{dppScore}%</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Based on required fields only</p>
                  <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-600 transition-all" style={{ width: `${dppScore}%` }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {schema && categoryKey ? (
        <p className="text-xs text-slate-500">
          Regulations: {schema.regulations.join(" · ")} — {schema.description}
        </p>
      ) : null}

      {showDetailFields ? (
        <>
          <motion.div
            layout
            initial={false}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={clsx(
              aiFilledKeys.has("product_name") && ["rounded-xl p-0.5", AI_FILLED_OUTLINE],
            )}
          >
            <label className="block text-sm font-medium text-slate-700 mb-1">Product name *</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setAiFilledKeys((prev) => {
                  const next = new Set(prev)
                  next.delete("product_name")
                  return next
                })
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
              placeholder="Article or style name"
              required
            />
          </motion.div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SKU (optional)</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-lg border border-slate-100 p-4 space-y-2">
            <p className="text-sm font-medium text-slate-800">Hero image</p>
            <p className="text-xs text-slate-500">Stored in compliance_data.hero_image_url</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={heroUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onHeroImage(f)
                  e.target.value = ""
                }}
                className="text-sm"
              />
              {heroUploading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : null}
            </div>
            {typeof complianceData.hero_image_url === "string" && complianceData.hero_image_url ? (
              <p className="text-xs text-emerald-700 truncate">Linked: {complianceData.hero_image_url}</p>
            ) : null}
          </div>

          {schema && categoryKey ? (
            <ComplianceStrategyFields
              categoryKey={categoryKey}
              schema={schema}
              readField={readField}
              setField={setField}
              aiFilledKeys={aiFilledKeys}
            />
          ) : null}
        </>
      ) : null}

      {fieldErrors.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {fieldErrors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      ) : null}

      {message && !fieldErrors.length ? (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {message}
        </p>
      ) : null}
      {message && fieldErrors.length ? <p className="text-sm text-rose-800">{message}</p> : null}

      {showDetailFields ? (
        <button
          type="submit"
          disabled={loading || !categoryKey}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save product
        </button>
      ) : null}
    </form>
  )
}
