"use client"

import { useCallback, useRef, useState } from "react"
import { Download, Loader2, Upload } from "lucide-react"
import clsx from "clsx"
import { Modal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { queuePassportBatchImportAction } from "@/actions/queue-passport-batch-import"
import {
  detectManifestFileKind,
  parsePassportManifestFile,
  PASSPORT_MANIFEST_MAX_ROWS,
  type PassportManifestRow,
} from "@/lib/passport-batch-manifest"

export type BulkImportQueuedJob = {
  id: string
  recordCount: number
  jobName: string | null
  createdAt: string
}

type BulkImportModalProps = {
  open: boolean
  onClose: () => void
  onQueued: (job: BulkImportQueuedJob) => void
}

const REQUIRED_COLUMNS_LABEL = "product_name, sku, batch_id, origin_geo, description"

export function BulkImportModal({ open, onClose, onQueued }: BulkImportModalProps) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsedRows, setParsedRows] = useState<PassportManifestRow[] | null>(null)
  const [uniqueCount, setUniqueCount] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsingLabel, setParsingLabel] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)

  const resetImportState = useCallback(() => {
    setParsedRows(null)
    setUniqueCount(0)
    setParseError(null)
    setParsingLabel(null)
    setSelectedFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const handleClose = useCallback(() => {
    if (queueLoading) return
    resetImportState()
    onClose()
  }, [onClose, queueLoading, resetImportState])

  const handleFileSelect = useCallback(
    async (file: File | null) => {
      if (!file || queueLoading) return

      const kind = detectManifestFileKind(file)
      setParsingLabel(
        kind === "xlsx"
          ? "Reading Excel workbook…"
          : kind === "csv"
            ? "Reading CSV…"
            : "Reading file…",
      )
      setParseError(null)
      setParsedRows(null)
      setSelectedFileName(file.name)

      const result = await parsePassportManifestFile(file)
      setParsingLabel(null)

      if (!result.ok) {
        setParseError(result.error)
        setParsedRows(null)
        setUniqueCount(0)
        if (fileInputRef.current) fileInputRef.current.value = ""
        setSelectedFileName(null)
        return
      }

      if (result.rows.length > PASSPORT_MANIFEST_MAX_ROWS) {
        toast.error(
          "Row limit exceeded",
          `This file has ${result.rows.length.toLocaleString()} rows. The maximum is ${PASSPORT_MANIFEST_MAX_ROWS.toLocaleString()} rows per batch.`,
        )
        resetImportState()
        return
      }

      setParsedRows(result.rows)
      setUniqueCount(result.uniqueCount)
    },
    [queueLoading, resetImportState, toast],
  )

  const submitBatchImport = useCallback(async () => {
    if (!parsedRows?.length || queueLoading) return

    setQueueLoading(true)
    try {
      const result = await queuePassportBatchImportAction({
        items: parsedRows.map((row) => ({
          product_name: row.product_name,
          sku: row.sku,
          batch_id: row.batch_id,
          origin_geo: row.origin_geo,
          description: row.description,
          artisan_identifier: row.artisan_identifier,
        })),
        jobName: selectedFileName?.replace(/\.(csv|xlsx|xls|xlsm)$/i, "") ?? null,
      })

      if (!result.success) {
        toast.error(result.error ?? "Batch import failed")
        return
      }

      toast.success(result.message)
      onQueued({
        id: result.jobId,
        recordCount: result.recordCount,
        jobName: result.jobName,
        createdAt: new Date().toISOString(),
      })
      resetImportState()
      onClose()
    } finally {
      setQueueLoading(false)
    }
  }, [onClose, onQueued, parsedRows, queueLoading, resetImportState, selectedFileName, toast])

  const isBusy = Boolean(parsingLabel) || queueLoading

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk Import (CSV)"
      description={`Upload a .csv or .xlsx manifest to bulk-create passport profiles. Required columns: ${REQUIRED_COLUMNS_LABEL}.`}
      size="md"
    >
      <div className="space-y-4">
        <a
          href="/templates/originpass_import_template.csv"
          download
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download sample template
        </a>

        <div
          className={clsx(
            "relative rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            parsingLabel ? "border-slate-200 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={isBusy}
            onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
          />
          <Upload className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
          <p className="mt-2 text-sm font-medium text-slate-800">
            {selectedFileName ?? "Drop a .csv or .xlsx file here"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            .csv recommended · .xlsx supported via SheetJS · up to 1,000 rows
          </p>
          {parsingLabel ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {parsingLabel}
            </p>
          ) : null}
        </div>

        {parseError ? (
          <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {parseError}
          </p>
        ) : null}

        {parsedRows?.length ? (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Ready to import {uniqueCount.toLocaleString()} unique passport item
            {uniqueCount === 1 ? "" : "s"} ({parsedRows.length.toLocaleString()} rows parsed).
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={queueLoading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitBatchImport()}
            disabled={!parsedRows?.length || isBusy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {queueLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {queueLoading ? "Scheduling…" : "Queue Batch Job"}
          </button>
        </div>
      </div>
    </Modal>
  )
}
