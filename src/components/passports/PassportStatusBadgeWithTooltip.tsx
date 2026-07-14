"use client"

import { PassportStatusBadge } from "./PassportStatusBadge"
import { getPassportStatusTooltip } from "@/lib/passport-status-tooltips"
import type { PassportLifecycleAction } from "@/lib/passport-lifecycle-management"

export function PassportStatusBadgeWithTooltip({
  status,
  lifecycleAction = null,
}: {
  status: string
  lifecycleAction?: PassportLifecycleAction | null
}) {
  const tooltip = getPassportStatusTooltip(status, lifecycleAction)

  return (
    <span
      tabIndex={0}
      className="group relative inline-flex max-w-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
    >
      <PassportStatusBadge status={status} lifecycleAction={lifecycleAction} />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-20 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {tooltip}
      </span>
    </span>
  )
}
