"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import type { ColumnMapping, ImportFieldKey } from "@/lib/import-products/types"
import { IMPORT_FIELD_KEYS, REQUIRED_IMPORT_FIELDS } from "@/lib/import-products/types"
import type { ValidateResult } from "@/lib/import-products/types"
import {
  AlertCircle,
  ArrowLeft,
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

export function ImportProductsClient() {
  const toast = useToast()
  const [step, setStep] = useState<Step>("upload")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [validation, setValidation] = useState<ValidateResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [importResult, setImportResult] = useState<{
    importLogId: string | null
    totalRows: number
    successCount: number
    failureCount: number
    status: string
    failuresCsv: string
  } | null>(null)
  const [importProgress, setImportProgress] = useState<{
    totalRows: number
    processedRows: number
    successCount: number
    failureCount: number
    percent: number
    status: string
  } | null>(null)
  const importStartedAtRef = useRef<number>(0)

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
      setStep("mapping")
      toast.success("File staged. Map your columns next.")
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
          setImportResult({
            importLogId: (p.productImportLogId as string) ?? null,
            totalRows: p.totalRows ?? 0,
            successCount: p.successCount ?? 0,
            failureCount: p.failureCount ?? 0,
            status: displayStatus,
            failuresCsv,
          })
          setStep("done")
          if ((p.successCount ?? 0) > 0) {
            toast.success(`Imported ${p.successCount} product(s).`)
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
      toast.success(`Archived ${data.archivedCount ?? 0} product(s) from this import.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed")
    } finally {
      setBusy(false)
    }
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
    setSessionId(null)
    setFileName("")
    setHeaders([])
    setPreview([])
    setTotalRows(0)
    setMapping({})
    setValidation(null)
    setImportResult(null)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/products"
            className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Import products</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Upload your product catalog to generate digital passports. Map columns, validate, then import in bulk
            with full traceability fields.
          </p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-slate-500">
        {["Upload", "Map fields", "Validate", "Import", "Done"].map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? <ChevronRight className="h-3 w-3 opacity-50" /> : null}
            <span
              className={
                (step === "upload" && i === 0) ||
                (step === "mapping" && i === 1) ||
                (step === "review" && i === 2) ||
                (step === "importing" && i === 3) ||
                (step === "done" && i === 4)
                  ? "font-semibold text-slate-900"
                  : ""
              }
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        {step === "upload" ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">Upload catalog file</h2>
              <p className="mt-1 text-sm text-slate-500">
                CSV or Excel (.xlsx), up to 50MB. Large files are streamed and processed asynchronously.
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
              <Button type="button" variant="secondary" onClick={() => setStep("upload")}>
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
              <Button type="button" variant="secondary" onClick={() => setStep("mapping")}>
                Edit mapping
              </Button>
              <Button type="button" variant="primary" disabled={busy} onClick={() => void runImport()}>
                Run import
              </Button>
            </div>
          </section>
        ) : null}

        {step === "importing" ? (
          <section className="space-y-6 py-8 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-slate-400" />
            <h2 className="text-[18px] font-semibold text-slate-900">Importing products…</h2>
            <p className="text-sm text-slate-500">
              Processing runs in the background. You can leave this page — progress updates every few seconds.
            </p>
            {importProgress ? (
              <>
                <p className="text-sm font-medium text-slate-800">
                  {importProgress.processedRows.toLocaleString()} / {importProgress.totalRows.toLocaleString()} rows
                  <span className="text-slate-500"> · {importProgress.percent}%</span>
                </p>
                <p className="text-xs text-slate-500">
                  {importProgress.successCount.toLocaleString()} succeeded ·{" "}
                  {importProgress.failureCount.toLocaleString()} failed/skipped
                  {importProgress.processedRows > 100 && importProgress.totalRows > importProgress.processedRows
                    ? (() => {
                        const elapsed = (Date.now() - importStartedAtRef.current) / 1000
                        const rate = importProgress.processedRows / elapsed
                        const remaining = (importProgress.totalRows - importProgress.processedRows) / Math.max(rate, 0.01)
                        return ` · ~${Math.max(0, Math.round(remaining / 60))} min remaining`
                      })()
                    : null}
                </p>
                <div className="mx-auto h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, importProgress.percent)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="mx-auto h-2 max-w-md overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-slate-800" />
              </div>
            )}
          </section>
        ) : null}

        {step === "done" && importResult ? (
          <section className="space-y-6">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900">Import complete</h2>
              <p className="mt-1 text-sm text-slate-500">Review counts below. You can undo this run or download failed rows.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Imported</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{importResult.successCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Failed / skipped</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{importResult.failureCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Status</p>
                <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{importResult.status}</p>
              </div>
            </div>

            {importResult.failureCount > 0 ? (
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
              <Button href="/dashboard/products" variant="primary">
                View products
              </Button>
              <Button type="button" variant="secondary" onClick={resetWizard}>
                Import more
              </Button>
              {importResult.successCount > 0 && importResult.importLogId ? (
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
