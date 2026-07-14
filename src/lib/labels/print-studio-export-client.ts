import type { PrintJobRow } from "@/lib/label-print-studio-server-data"
import type { LabelQueueRequest } from "@/components/dashboard/qr-identity/print-labels/types"

type ApiPrintJob = {
  id: string
  quantity: number
  printer_type: string
  status: string
  export_format: string
  created_at: string
  template?: { name?: string | null } | null
}

function mapApiJob(job: ApiPrintJob, templateName: string): PrintJobRow {
  return {
    id: job.id,
    templateName: job.template?.name ?? templateName,
    quantity: job.quantity,
    printerType: job.printer_type,
    status: job.status as PrintJobRow["status"],
    exportFormat: job.export_format,
    createdBy: "You",
    createdAt: job.created_at,
  }
}

export function createOptimisticPrintJob(params: LabelQueueRequest): PrintJobRow {
  return {
    id: `local-${Date.now()}`,
    templateName: params.templateName,
    quantity: params.labelCount,
    printerType: params.printerType ?? "PDF standard",
    status: params.labelCount >= 12 ? "queued" : "processing",
    exportFormat: params.format,
    createdBy: "You",
    createdAt: new Date().toISOString(),
  }
}

export async function queueLabelStudioJob(
  params: LabelQueueRequest,
): Promise<{ job: PrintJobRow; exportRecordId?: string }> {
  const printRes = await fetch("/api/labels/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      templateId: params.templateId,
      templateName: params.templateName,
      quantity: params.labelCount,
      printerType: params.printerType ?? "PDF standard",
      exportFormat: params.format,
      productIds: params.productIds,
      layoutMode: params.layoutMode,
      action: params.action,
    }),
  })

  if (!printRes.ok) {
    const err = (await printRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? "Failed to queue print job")
  }

  const { job: rawJob } = (await printRes.json()) as { job: ApiPrintJob }
  const job = mapApiJob(rawJob, params.templateName)

  const exportRes = await fetch("/api/labels/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      printJobId: rawJob.id,
      format: params.format,
      assetCount: params.labelCount,
      status: params.labelCount >= 12 ? "queued" : "processing",
    }),
  })

  let exportRecordId: string | undefined
  if (exportRes.ok) {
    const payload = (await exportRes.json()) as { export?: { id?: string } }
    exportRecordId = payload.export?.id
  }

  return { job, exportRecordId }
}
