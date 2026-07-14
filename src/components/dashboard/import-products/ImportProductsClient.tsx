"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { revalidateProductsCatalog } from "@/actions/revalidate-products-catalog"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import type { ColumnMapping, ImportFieldKey } from "@/lib/import-products/types"
import { IMPORT_FIELD_KEYS, REQUIRED_IMPORT_FIELDS } from "@/lib/import-products/types"
import type { ValidateResult } from "@/lib/import-products/types"
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react"

const PRESET_KEY = "originpass-import-mapping-v1"

const FIELD_LABELS: Record<ImportFieldKey, string> = {
  product_name: "Product name",
  product_id: "Product ID (SKU)",
  category: "Category",
  brand: "Brand",
  origin_country: "Origin country",
  material: "Material",
  batch_number: "Batch number",
  manufacture_date: "Manufacture date",
  certifications: "Certifications",
  qr_code: "QR code (optional)",
}

type Step = "upload" | "mapping" | "review" | "importing" | "done"

const STEP_ORDER: Step[] = ["upload", "mapping", "review", "importing", "done"]

const IMPORT_STEPS = [
  { label: "Upload", index: 0 },
  { label: "Map fields", index: 1 },
  { label: "Validate", index: 2 },
  { label: "Import", index: 3 },
  { label: "Done", index: 4 },
] as const

const PIPELINE_STEPS = [
  { key: "catalog", label: "Step 1: Importing Catalog Items…" },
  { key: "passports", label: "Step 2: Activating Digital Passports…" },
  { key: "qr", label: "Step 3: Minting Secure QR Identities…" },
] as const

type PipelineStage = "catalog" | "passports" | "qr" | "done"

function stepToIndex(s: Step): number {
  return STEP_ORDER.indexOf(s)
}

export function ImportProductsClient() {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<Step>("upload")
  /** Furthest step index (0–4) the user has successfully reached in this session. */
  const [maxAllowedStep, setMaxAllowedStep] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [validation, setValidation] = useState<ValidateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [importResult, setImportResult] = useState<{
    jobId: string | null
    importLogId: string | null
    totalRows: number
    successCount: number
    failureCount: number
    status: string
    failuresCsv: string
    exportReady: boolean
    passportsActivated: number
    qrMinted: number
  } | null>(null)
  /** Mirrors server undo so the Done step and Undo button stay in sync without stale counts. */
  const [isReverted, setIsReverted] = useState(false)
  const [summaryStats, setSummaryStats] = useState({ imported: 0, failed: 0 })
  const [importProgress, setImportProgress] = useState<{
    totalRows: number
    processedRows: number
    successCount: number
    failureCount: number
    percent: number
    status: string
    pipelineStage: PipelineStage | null
    passportsDone: number
    qrDone: number
    exportReady: boolean
  } | null>(null)
  const [activeImportJobId, setActiveImportJobId] = useState<string | null>(null)
  const importStartedAtRef = useRef<number>(0)

  const currentStepIndex = stepToIndex(step)

  const goToStepIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex > 4) return
      if (step === "importing") return
      if (targetIndex > maxAllowedStep) return
      if (targetIndex >= currentStepIndex) return
      if (targetIndex === 1 && !sessionId) return
      if (targetIndex === 2 && !validation) return
      // Breadcrumb "Import" is the `importing` step, but that screen only makes sense while a job runs.
      // After Done (including reverted), send users to Validate — that is where "Run import" lives.
      if (targetIndex === 3 && step === "done") {
        if (sessionId && validation) setStep("review")
        return
      }
      setStep(STEP_ORDER[targetIndex]!)
    },
    [currentStepIndex, maxAllowedStep, sessionId, step, validation],
  )

  const requiredOk = useMemo(() => {
    return REQUIRED_IMPORT_FIELDS.every((f) => mapping[f]?.trim())
  }, [mapping])

  const loadPreset = useCallback(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as ColumnMapping
      setMapping(parsed)
      toast.info("Loaded saved column mapping.")
    } catch {
      /* ignore */
    }
  }, [toast])

  const savePreset = useCallback(() => {
    try {
      localStorage.setItem(PRESET_KEY, JSON.stringify(mapping))
      toast.success("Mapping saved for next time.")
    } catch {
      toast.error("Could not save mapping.")
    }
  }, [mapping, toast])

  async function onFile(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      const res = await fetch("/api/products/import/upload", {
        method: "POST",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Upload failed")
      }
      setSessionId(data.sessionId)
      setFileName(data.fileName)
      setHeaders(data.headers)
      setPreview(data.preview || [])
      setTotalRows(data.totalRows)
      setMapping(data.suggestedMapping || {})
      setValidation(null)
      setImportResult(null)
      setIsReverted(false)
      setSummaryStats({ imported: 0, failed: 0 })
      setStep("mapping")
      setMaxAllowedStep((m) => Math.max(m, 1))
      if (data.resumed) {
        toast.info("Same catalog as a recent upload — continuing with your staged file. Column headers were refreshed.")
      } else {
        toast.success("File staged. Map your columns next.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) void onFile(f)
  }

  async function runValidate() {
    if (!sessionId) return
    setBusy(true)
    try {
      const res = await fetch("/api/products/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, mapping }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Validation failed")
      }
      setValidation({
        totalRows: data.totalRows,
        validRows: data.validRows,
        failedRows: data.failedRows,
        errors: data.errors || [],
        mappedPreview: data.mappedPreview || [],
      })
      setStep("review")
      setMaxAllowedStep((m) => Math.max(m, 2))
      if (data.mappingIncomplete) {
        toast.info("Map all required fields before continuing.")
      } else if (data.failedRows > 0) {
        toast.info("Validation found rows to fix or they will be skipped on import.")
      } else {
        toast.success("All rows look valid. Ready to import.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Validation failed")
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    if (!sessionId) return
    setStep("importing")
    setMaxAllowedStep((m) => Math.max(m, 3))
    setBusy(true)
    setImportProgress(null)
    importStartedAtRef.current = Date.now()
    try {
      const res = await fetch("/api/products/import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, mapping }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Import failed")
      }
      const jobId = (data.jobId as string) ?? sessionId
      setActiveImportJobId(jobId)
      const maxPolls = 4000
      let lastStatus: string | null = null
      for (let i = 0; i < maxPolls; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const stRes = await fetch(`/api/products/import/status/${jobId}`)
        const p = await stRes.json().catch(() => ({}))
        if (!stRes.ok) {
          throw new Error(p.error || "Could not read import status")
        }
        lastStatus = p.status as string
        setImportProgress({
          totalRows: p.totalRows ?? 0,
          processedRows: p.processedRows ?? 0,
          successCount: p.successCount ?? 0,
          failureCount: p.failureCount ?? 0,
          percent: p.percent ?? 0,
          status: lastStatus,
          pipelineStage: (p.pipelineStage as PipelineStage | null) ?? null,
          passportsDone: p.pipeline?.passportsDone ?? 0,
          qrDone: p.pipeline?.qrDone ?? 0,
          exportReady: Boolean(p.exportReady),
        })
        if (
          lastStatus === "COMPLETED" ||
          lastStatus === "FAILED" ||
          lastStatus === "PARTIAL_SUCCESS"
        ) {
          let failuresCsv = ""
          if ((p.failureCount ?? 0) > 0) {
            const lines: string[] = ["row,error"]
            let offset = 0
            const limit = 500
            for (;;) {
              const er = await fetch(
                `/api/products/import/errors/${jobId}?limit=${limit}&offset=${offset}`,
              )
              const ed = await er.json().catch(() => ({}))
              if (!er.ok) break
              for (const row of ed.errors ?? []) {
                const msg = String(row.error_message ?? "").replace(/"/g, '""')
                lines.push(`${row.row_number},"${msg}"`)
              }
              const batch = ed.errors as unknown[] | undefined
              if (!batch?.length || batch.length < limit) break
              offset += limit
            }
            failuresCsv = lines.join("\n")
          }
          const displayStatus =
            lastStatus === "COMPLETED"
              ? "completed"
              : lastStatus === "PARTIAL_SUCCESS"
                ? "partial"
                : lastStatus === "FAILED"
                  ? "failed"
                  : String(lastStatus).toLowerCase()
          const successCount = p.successCount ?? 0
          const failureCount = p.failureCount ?? 0
          setIsReverted(false)
          setSummaryStats({ imported: successCount, failed: failureCount })
          setImportResult({
            jobId,
            importLogId: (p.productImportLogId as string) ?? null,
            totalRows: p.totalRows ?? 0,
            successCount,
            failureCount,
            status: displayStatus,
            failuresCsv,
            exportReady: Boolean(p.exportReady),
            passportsActivated: p.pipeline?.passportsDone ?? 0,
            qrMinted: p.pipeline?.qrDone ?? 0,
          })
          setStep("done")
          setMaxAllowedStep((m) => Math.max(m, 4))
          if ((p.successCount ?? 0) > 0) {
            const qrCount = p.pipeline?.qrDone ?? 0
            toast.success(
              qrCount > 0
                ? `Imported ${p.successCount} product(s) with ${qrCount} secure QR identit${qrCount === 1 ? "y" : "ies"}.`
                : `Imported ${p.successCount} product(s).`,
            )
          } else if (lastStatus !== "FAILED") {
            toast.info("Import finished with no successful rows.")
          } else {
            toast.error(p.lastError || "Import failed.")
          }
          break
        }
      }
      if (lastStatus !== "COMPLETED" && lastStatus !== "FAILED" && lastStatus !== "PARTIAL_SUCCESS") {
        throw new Error("Import is taking longer than expected. Refresh this page later or check Import status in the database.")
      }
    } catch (e) {
      setStep("review")
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setBusy(false)
    }
  }

  async function undoImport() {
    if (!importResult?.importLogId?.trim()) return
    setBusy(true)
    try {
      const res = await fetch("/api/products/import/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importLogId: importResult.importLogId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Undo failed")

      if (data.alreadyReverted) {
        toast.info("This import was already undone — products stay archived in your catalog.")
        setIsReverted(true)
        setSummaryStats((s) => ({ ...s, imported: 0 }))
        setImportResult((prev) =>
          prev
            ? {
                ...prev,
                successCount: 0,
                status: "reverted",
                importLogId: null,
              }
            : null,
        )
        return
      }

      const n = Number(data.archivedCount ?? 0)
      toast.success(
        n > 0
          ? `Archived ${n} product(s) from this import. They no longer appear in your active catalog.`
          : "No active products left to archive for this import (they may already be archived).",
      )
      setIsReverted(true)
      setSummaryStats((s) => ({ ...s, imported: 0 }))
      setImportResult((prev) =>
        prev
          ? {
              ...prev,
              successCount: 0,
              status: "reverted",
              importLogId: null,
            }
          : null,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed")
    } finally {
      setBusy(false)
    }
  }

  async function goToProductsCatalog() {
    const importLogId = importResult?.importLogId?.trim()
    try {
      await revalidateProductsCatalog()
    } catch {
      /* navigation still proceeds; revalidate is best-effort */
    }
    const params = new URLSearchParams({ imported: "1" })
    if (importLogId) params.set("importLogId", importLogId)
    router.push(`/dashboard/products?${params.toString()}`)
    router.refresh()
  }

  function downloadFailures() {
    if (!importResult?.failuresCsv) return
    const blob = new Blob([importResult.failuresCsv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "import-failures.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  function resetWizard() {
    setStep("upload")
    setMaxAllowedStep(0)
    setSessionId(null)
    setFileName("")
    setHeaders([])
    setPreview([])
    setTotalRows(0)
    setMapping({})
    setValidation(null)
    setImportResult(null)
    setIsReverted(false)
    setSummaryStats({ imported: 0, failed: 0 })
    setImportProgress(null)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Import products</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload your product catalog to generate digital passports. Map columns, validate, then import in bulk
            with full traceability fields.
          </p>
        </div>
      </div>

      <nav aria-label="Import progress" className="flex flex-wrap items-center gap-1 text-xs">
        {IMPORT_STEPS.map((s, idx) => {
          const isCurrent = s.index === currentStepIndex
          const isFuture = s.index > currentStepIndex
          const canReopenImportFromDone =
            step === "done" && s.index === 3 && Boolean(sessionId && validation)
          const isClickable =
            s.index < currentStepIndex &&
            s.index <= maxAllowedStep &&
            (s.index !== 3 || step !== "done" || canReopenImportFromDone) &&
            (s.index !== 1 || Boolean(sessionId)) &&
            (s.index !== 2 || validation != null)

          const base = "rounded px-0.5 transition-colors"
          let className = base
          if (isCurrent) {
            className += " font-semibold text-slate-900"
          } else if (isFuture) {
            className += " text-slate-400 pointer-events-none cursor-not-allowed select-none"
          } else if (isClickable) {
            className +=
              " cursor-pointer text-slate-600 hover:text-slate-900 hover:underline underline-offset-2"
          } else {
            className += " text-slate-500"
          }

          return (
            <span key={s.label} className="flex items-center gap-1">
              {idx > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
              ) : null}
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => goToStepIndex(s.index)}
                  className={className}
                >
                  {s.label}
                </button>
              ) : (
                <span className={className} aria-current={isCurrent ? "step" : undefined}>
                  {s.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {step === "upload" ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">Upload catalog file</h2>
              <p className="mt-1 text-sm text-slate-500">
                CSV or Excel (.xlsx), up to 50MB. Apple Numbers: use File → Export To → CSV or Excel — .numbers files are not supported. Large files stream asynchronously.
              </p>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={onDrop}
              className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center transition hover:border-slate-300 hover:bg-slate-50"
            >
              <FileSpreadsheet className="h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">Drag &amp; drop your file here</p>
              <p className="mt-1 text-xs text-slate-500">or choose a file from your computer</p>
              <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Browse files
                <input
                  type="file"
                  accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  title="Use CSV or Excel exported from your spreadsheet app — not Apple .numbers files"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void onFile(f)
                    e.target.value = ""
                  }}
                />
              </label>
              <a
                href="/api/products/import/template"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download sample CSV template
              </a>
            </div>
            {busy ? (
              <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing file…
              </p>
            ) : null}
          </section>
        ) : null}

        {step === "mapping" ? (
          <section className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-slate-900">Map your data fields</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Match each OriginPass field to a column from <span className="font-medium">{fileName}</span> (
                  {totalRows} rows).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={loadPreset}>
                  Load saved mapping
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={savePreset}>
                  Save mapping
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {IMPORT_FIELD_KEYS.map((key) => (
                <div
                  key={key}
                  className="grid gap-2 border-b border-slate-100 pb-4 last:border-0 sm:grid-cols-[1fr,1.2fr]"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    {FIELD_LABELS[key]}
                    {REQUIRED_IMPORT_FIELDS.includes(key) ? (
                      <span className="text-rose-500">*</span>
                    ) : (
                      <span className="text-xs font-normal text-slate-400">(optional)</span>
                    )}
                  </div>
                  <select
                    value={mapping[key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [key]: e.target.value || undefined,
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">— Not mapped —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[18px] font-semibold text-slate-900">Preview (first 10 rows)</p>
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {headers.slice(0, 8).map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.map((row, ri) => (
                      <tr key={ri}>
                        {headers.slice(0, 8).map((h) => (
                          <td key={h} className="max-w-[140px] truncate px-3 py-2 text-slate-600" title={row[h]}>
                            {row[h] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => goToStepIndex(0)}>
                Back
              </Button>
              <Button type="button" variant="primary" disabled={!requiredOk || busy} onClick={() => void runValidate()}>
                Validate before import
              </Button>
            </div>
          </section>
        ) : null}

        {step === "review" && validation ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">Validate before import</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fix issues in your file and re-upload, or proceed — invalid rows will be skipped.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total rows</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{validation.totalRows}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">Valid rows</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{validation.validRows}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-rose-800">Failed rows</p>
                <p className="mt-1 text-2xl font-bold text-rose-900">{validation.failedRows}</p>
              </div>
            </div>

            {validation.errors.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-xl border border-rose-100 bg-rose-50/40">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rose-100 bg-white">
                      <th className="px-3 py-2 font-semibold text-slate-700">Row</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Field</th>
                      <th className="px-3 py-2 font-semibold text-slate-700">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.errors.slice(0, 80).map((err, i) => (
                      <tr key={`${err.rowIndex}-${i}`} className="border-b border-rose-50">
                        <td className="px-3 py-1.5 text-slate-800">{err.rowIndex + 1}</td>
                        <td className="px-3 py-1.5 text-slate-600">{err.field ?? "—"}</td>
                        <td className="px-3 py-1.5 text-rose-800">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.errors.length > 80 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Showing first 80 issues.</p>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                No blocking issues detected for mapped rows.
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => goToStepIndex(1)}>
                Edit mapping
              </Button>
              <Button type="button" variant="primary" disabled={busy} onClick={() => void runImport()}>
                Run import
              </Button>
            </div>
          </section>
        ) : null}

        {step === "importing" ? (
          <section className="space-y-6 py-6">
            <div className="text-center">
              <h2 className="text-[18px] font-semibold text-slate-900">Running automated import pipeline</h2>
              <p className="mt-1 text-sm text-slate-500">
                Products, passports, and secure QR identities are provisioned in sequence — no wizard steps required.
              </p>
            </div>

            <ol className="mx-auto max-w-lg space-y-3 text-left">
              {PIPELINE_STEPS.map((pipelineStep, index) => {
                const stage = importProgress?.pipelineStage ?? "catalog"
                const stageOrder: PipelineStage[] = ["catalog", "passports", "qr", "done"]
                const currentIndex = stageOrder.indexOf(stage)
                const stepIndex = index
                const isComplete = currentIndex > stepIndex || stage === "done"
                const isActive = currentIndex === stepIndex && stage !== "done"

                return (
                  <li
                    key={pipelineStep.key}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : isComplete
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-white text-slate-900"
                          : isComplete
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${isActive ? "text-white" : "text-slate-900"}`}>
                        {pipelineStep.label.replace("…", isComplete ? "" : "…")}
                      </p>
                      {pipelineStep.key === "catalog" && importProgress ? (
                        <p className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                          {importProgress.processedRows.toLocaleString()} / {importProgress.totalRows.toLocaleString()} rows
                          {importProgress.successCount > 0
                            ? ` · ${importProgress.successCount.toLocaleString()} catalog items`
                            : null}
                        </p>
                      ) : null}
                      {pipelineStep.key === "passports" && importProgress && importProgress.passportsDone > 0 ? (
                        <p className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                          {importProgress.passportsDone.toLocaleString()} passport
                          {importProgress.passportsDone === 1 ? "" : "s"} activated
                        </p>
                      ) : null}
                      {pipelineStep.key === "qr" && importProgress && importProgress.qrDone > 0 ? (
                        <p className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                          {importProgress.qrDone.toLocaleString()} secure QR identit
                          {importProgress.qrDone === 1 ? "y" : "ies"} minted
                        </p>
                      ) : null}
                    </div>
                    {isActive ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" aria-hidden /> : null}
                  </li>
                )
              })}
            </ol>

            {importProgress && importProgress.pipelineStage === "catalog" ? (
              <div className="mx-auto h-2 max-w-lg overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, importProgress.percent)}%` }}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "done" && importResult ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">
                {isReverted ? "Import reverted" : "Import complete"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isReverted
                  ? "Imported products from this run were archived. Counts below reflect the current state of this summary."
                  : "Catalog items, digital passports, and secure QR identities were provisioned automatically."}
              </p>
            </div>

            {!isReverted && importResult.exportReady ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="font-semibold text-emerald-900">Pipeline complete</p>
                  <p className="mt-1 text-emerald-900/90">
                    {importResult.qrMinted.toLocaleString()} secure QR identit
                    {importResult.qrMinted === 1 ? "y" : "ies"} ready for download across{" "}
                    {importResult.passportsActivated.toLocaleString()} activated passport
                    {importResult.passportsActivated === 1 ? "" : "s"}.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  {isReverted ? "Active from this run" : "Imported"}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summaryStats.imported}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Failed / skipped</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{summaryStats.failed}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Status</p>
                <p className="mt-1 text-lg font-semibold capitalize text-slate-900">
                  {isReverted ? "reverted" : importResult.status}
                </p>
              </div>
            </div>

            {summaryStats.failed > 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
                <AlertCircle className="h-5 w-5 shrink-0" />
                Some rows were not imported. Download the report to fix and retry.
                <Button type="button" variant="secondary" size="sm" onClick={downloadFailures}>
                  <Download className="mr-1 h-4 w-4" />
                  Download failures CSV
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {!isReverted && importResult.exportReady && importResult.jobId ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    window.location.href = `/api/products/import/export/${importResult.jobId}`
                  }}
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download QR export
                </Button>
              ) : null}
              <Button type="button" variant={importResult.exportReady ? "secondary" : "primary"} onClick={() => void goToProductsCatalog()}>
                View products
              </Button>
              <Button type="button" variant="secondary" onClick={resetWizard}>
                Import more
              </Button>
              {!isReverted && summaryStats.imported > 0 && importResult.importLogId ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void undoImport()}
                  className="border border-rose-200 text-rose-800 hover:bg-rose-50"
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Undo last import
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
