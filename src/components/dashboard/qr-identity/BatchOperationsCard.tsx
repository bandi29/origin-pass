"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
} from "lucide-react"
import clsx from "clsx"
import { useToast } from "@/components/ui/Toast"
import {
  batchExportActionLabel,
  batchTopExportActionLabel,
  jobHasBeenDownloaded,
  jobHasGeneratedAssets,
  mergeExportedBatchIds,
  persistExportedBatchIds,
  readExportedBatchIdsFromStorage,
  type BatchExportTrackingRow,
} from "@/lib/batch-operations-export-state"
import { BatchAssetsGeneratedBadge, BatchJobStatusStack } from "@/components/dashboard/qr-identity/BatchJobStatusStack"
import {
  BulkImportModal,
  type BulkImportQueuedJob,
} from "@/components/dashboard/qr-identity/BulkImportModal"

const EXPORT_FAILED_TITLE = "Export Failed"
const EXPORT_FAILED_DESCRIPTION =
  "Could not build the label ZIP for this batch. Try again or re-import the manifest."

async function readExportErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as { error?: string; code?: string }
    if (data?.error) return data.error
  } catch {
    // not JSON — fall through
  }
  return EXPORT_FAILED_DESCRIPTION
}

type BatchHistoryRow = BatchExportTrackingRow & {
  createdAt: string
  jobName: string | null
  exportFolderName?: string | null
}

function isZipDownloadResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) return false
  if (
    contentType.includes("application/zip") ||
    contentType.includes("application/x-zip") ||
    contentType.includes("octet-stream")
  ) {
    return true
  }
  const disposition = response.headers.get("content-disposition") ?? ""
  return response.ok && disposition.includes("attachment")
}

export function BatchOperationsCard() {
  const router = useRouter()
  const toast = useToast()
  const exportingRef = useRef<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [exportedBatchIds, setExportedBatchIds] = useState<Set<string>>(() => new Set())

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<BatchHistoryRow[]>([])

  const newestBatch = history[0] ?? null
  const pendingExportBatch = history.find(
    (job) => job.status === "completed" && !job.assetsGenerated,
  )
  const topExportTarget =
    pendingExportBatch ?? (newestBatch?.status === "completed" ? newestBatch : null)
  const topExportBatchId = topExportTarget?.id ?? null
  const topExportDisabled = history.length === 0 || !topExportBatchId || exportingId !== null
  const topExportIsReExport = topExportBatchId
    ? jobHasBeenDownloaded(
        topExportTarget ?? { id: topExportBatchId, status: "completed", recordCount: 0 },
        exportedBatchIds,
      )
    : false

  const markBatchExported = useCallback((batchId: string) => {
    setExportedBatchIds((prev) => {
      const next = new Set(prev)
      next.add(batchId)
      persistExportedBatchIds(next)
      return next
    })
    setHistory((prev) =>
      prev.map((row) =>
        row.id === batchId ? { ...row, hasBeenExported: true, assetsGenerated: true } : row,
      ),
    )
  }, [])

  const hasBeenExported = useCallback(
    (batchId: string) => {
      const row = history.find((job) => job.id === batchId)
      return row
        ? jobHasBeenDownloaded(row, exportedBatchIds)
        : exportedBatchIds.has(batchId)
    },
    [exportedBatchIds, history],
  )

  const resetImportState = useCallback(() => {
    setImportOpen(false)
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch("/api/passports/batch-history")
      const data = (await res.json().catch(() => null)) as {
        jobs?: BatchHistoryRow[]
        error?: string
      }
      if (!res.ok) {
        toast.error(data?.error ?? "Could not load batch history")
        return
      }

      const jobs = data?.jobs ?? []
      setHistory(jobs)

      setExportedBatchIds((prev) => {
        const next = mergeExportedBatchIds(prev, jobs)
        persistExportedBatchIds(next)
        return next
      })
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  const handleImportQueued = useCallback(
    (job: BulkImportQueuedJob) => {
      setHistoryOpen(true)
      setHistory((prev) => {
        if (prev.some((row) => row.id === job.id)) return prev
        const optimistic: BatchHistoryRow = {
          id: job.id,
          status: "processing",
          recordCount: job.recordCount,
          inputCount: job.recordCount,
          successCount: 0,
          createdAt: job.createdAt,
          jobName: job.jobName,
        }
        return [optimistic, ...prev]
      })
      void loadHistory()
      router.refresh()
    },
    [loadHistory, router],
  )

  useEffect(() => {
    setExportedBatchIds(readExportedBatchIdsFromStorage())
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    const hasActiveJobs = history.some(
      (job) => job.status === "processing" || job.status === "queued",
    )
    if (!hasActiveJobs) return

    const timer = window.setInterval(() => {
      void loadHistory()
    }, 4000)

    return () => window.clearInterval(timer)
  }, [history, loadHistory])

  const handleToggleHistory = useCallback(async () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && history.length === 0) {
      await loadHistory()
    }
  }, [history.length, historyOpen, loadHistory])

  const handleExportZip = useCallback(
    async (batchId: string, jobName: string | null = null) => {
      if (!batchId || exportingRef.current === batchId) return

      const isReExport = hasBeenExported(batchId)
      exportingRef.current = batchId
      setExportingId(batchId)

      const triggerDownload = async (response: Response) => {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `originpass-labels-${batchId}.zip`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
      }

      const generateAndExportUrl = `/api/passports/generate-and-export?batchId=${encodeURIComponent(batchId)}`

      try {
        const response = await fetch(generateAndExportUrl)

        if (!isZipDownloadResponse(response)) {
          const message = await readExportErrorMessage(response)
          toast.error(EXPORT_FAILED_TITLE, message)
          return
        }

        await triggerDownload(response)
        markBatchExported(batchId)
        await loadHistory()
        router.refresh()
        const labelCountHeader = response.headers.get("X-OriginPass-Label-Count")
        const labelCount = labelCountHeader ? Number(labelCountHeader) : null
        const serialNumbers = response.headers.get("X-OriginPass-Serial-Numbers")
        const resolvedJobName =
          response.headers.get("X-OriginPass-Job-Name")?.trim() || jobName?.trim() || null
        const batchLabel = resolvedJobName ? ` for ${resolvedJobName}` : ""
        const serialLabel = serialNumbers ? ` (${serialNumbers})` : ""
        toast.success(
          isReExport
            ? labelCount
              ? `${labelCount} label${labelCount === 1 ? "" : "s"} re-downloaded${batchLabel}${serialLabel}.`
              : `Label ZIP re-downloaded${batchLabel}${serialLabel}.`
            : labelCount
              ? `${labelCount} label${labelCount === 1 ? "" : "s"} downloaded${batchLabel}${serialLabel}.`
              : `Label ZIP downloaded${batchLabel}${serialLabel}.`,
        )
      } catch {
        toast.error(EXPORT_FAILED_TITLE, EXPORT_FAILED_DESCRIPTION)
      } finally {
        exportingRef.current = null
        setExportingId(null)
      }
    },
    [hasBeenExported, loadHistory, markBatchExported, router, toast],
  )

  const handleTopExportZip = useCallback(() => {
    if (!topExportBatchId || !topExportTarget) return
    void handleExportZip(topExportBatchId, topExportTarget.jobName)
  }, [handleExportZip, topExportBatchId, topExportTarget])

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Batch operations</h3>
      <p className="mt-1 text-sm text-slate-500">
        Generate 1000+ immutable QR identities with async jobs and ZIP export.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Bulk Import (CSV)
        </button>

        <button
          type="button"
          onClick={handleTopExportZip}
          disabled={topExportDisabled}
          title={
            history.length === 0
              ? "Import a batch before exporting labels"
              : !topExportBatchId
                ? "Latest batch is not ready for export yet"
                : topExportTarget?.jobName
                  ? `Export labels for ${topExportTarget.jobName}`
                  : undefined
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exportingId === topExportBatchId ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : topExportIsReExport ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
          {exportingId === topExportBatchId
            ? batchTopExportActionLabel(topExportIsReExport, true)
            : batchTopExportActionLabel(topExportIsReExport, false)}
        </button>

        <button
          type="button"
          onClick={() => void handleToggleHistory()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <History className="h-4 w-4" aria-hidden />
          View batch history
          <ChevronDown
            className={clsx("h-4 w-4 transition-transform", historyOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      <div
        className={clsx(
          "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
          historyOpen ? "mt-4 max-h-[480px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="rounded-xl border border-slate-100 bg-slate-50/80">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Batch identifier</span>
            <span className="text-right">Records</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading history…
            </div>
          ) : history.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No batch jobs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((job) => {
                const downloaded = jobHasBeenDownloaded(job, exportedBatchIds)
                const assetsReady = jobHasGeneratedAssets(job)
                const isExporting = exportingId === job.id
                return (
                  <li
                    key={job.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isExporting ? (
                          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-slate-500" aria-hidden />
                        ) : null}
                        <p className="truncate font-mono text-xs text-slate-800">
                          {job.id.slice(0, 8)}…
                        </p>
                        {assetsReady ? <BatchAssetsGeneratedBadge /> : null}
                      </div>
                      {job.jobName ? (
                        <p className="truncate text-xs text-slate-500">{job.jobName}</p>
                      ) : null}
                      {job.exportFolderName ? (
                        <p className="truncate text-[11px] text-slate-400">
                          Export folder: {job.exportFolderName}/
                        </p>
                      ) : null}
                    </div>
                    <span className="text-right tabular-nums text-slate-700">
                      {job.recordCount.toLocaleString()}
                    </span>
                    <BatchJobStatusStack job={job} exportedBatchIds={exportedBatchIds} />
                    <button
                      type="button"
                      onClick={() => void handleExportZip(job.id, job.jobName)}
                      disabled={isExporting || job.status !== "completed"}
                      className="inline-flex items-center justify-end gap-1 text-right text-xs font-medium text-slate-700 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                    >
                      {isExporting ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : downloaded ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden />
                      ) : null}
                      {batchExportActionLabel(downloaded, isExporting)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <BulkImportModal
        open={importOpen}
        onClose={resetImportState}
        onQueued={handleImportQueued}
      />
    </div>
  )
}
