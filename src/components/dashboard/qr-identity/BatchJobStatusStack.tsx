import { CheckCircle2, Loader2 } from "lucide-react"
import clsx from "clsx"
import {
  BATCH_ASSETS_GENERATED_BADGE,
  BATCH_COMPLETED_STATUS_BADGE,
  BATCH_DOWNLOADED_INDICATOR,
  type BatchExportTrackingRow,
  jobHasBeenDownloaded,
} from "@/lib/batch-operations-export-state"

export function BatchAssetsGeneratedBadge({ className }: { className?: string }) {
  return (
    <span className={clsx(BATCH_ASSETS_GENERATED_BADGE, className)}>
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
      Assets generated
    </span>
  )
}

export function BatchJobStatusStack({
  job,
  exportedBatchIds,
}: {
  job: BatchExportTrackingRow
  exportedBatchIds: Set<string>
}) {
  if (job.status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Processing
      </span>
    )
  }

  if (job.status !== "completed") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        In Queue
      </span>
    )
  }

  const downloaded = jobHasBeenDownloaded(job, exportedBatchIds)

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={BATCH_COMPLETED_STATUS_BADGE}>Completed</span>
      {downloaded ? (
        <span className={BATCH_DOWNLOADED_INDICATOR}>
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
          Downloaded
        </span>
      ) : null}
    </div>
  )
}
